// functions/account-api.js
//
// Cockney Cards — Account API. Handles magic-link login, sessions, and
// birthday reminder CRUD, plus a daily cron job that emails customers 2
// weeks before a saved date.
//
// Ported directly from old-bush-4d25cockney-cards-api's standalone Worker
// script (the only copy of this logic that ever existed — old-bush was
// never git-connected, so this file itself IS the source of truth going
// forward). old-bush's checkout/webhook handlers were NOT ported here —
// those were older, buggier duplicates of what cockney-cards's own
// create-checkout*.js / stripe-webhook.js already do properly (basket
// support, correct pricing, delivery options, etc.) — see old-bush's own
// comment: "moved here from the site's Pages Functions, which turned out
// not to be executing", the exact same deploy problem this project's
// _worker.js/wrangler.jsonc setup already fixed.
//
// Bindings required (all already set up on cockney-cards from earlier
// work — nothing new to add):
//  - DB              (D1 database, binding "DB")
//  - ZEPTOMAIL_TOKEN  (secret — full value including "Zoho-enczapikey " prefix)
//  - FROM_EMAIL       (e.g. "reminders@cockneycards.com")
//  - SITE_URL         (e.g. "https://cockneycards.com")
//  - ALLOWED_ORIGIN    (e.g. "https://cockneycards.com")
//
// D1 schema this expects (already exists — old-bush was writing to the
// same cockney-cards-db this project now also uses):
//  - users            (id, email, created_at, referral_code)
//  - sessions         (token, user_id, expires_at)
//  - magic_tokens     (token, email, expires_at, used, ref)
//  - reminders        (id, user_id, occasion_name, relationship, month, day, created_at)
//  - orders           (id, email, product_type, custom_name, custom_age,
//                       custom_name2, custom_age2, size, amount_total, created_at)
//  - referrals, reward_codes — see referrals.js and referrals-schema.sql
//    for the "Refer a Friend" tables this file now also touches.

import { generateUniqueReferralCode, recordReferralIfAny, getReferralSummary } from './referrals.js';

const SESSION_DAYS = 30;
const MAGIC_LINK_MINUTES = 15;

export function corsHeaders(env) {
    return {
        'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
}

function json(data, status, env) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
    });
}

function uid() {
    return crypto.randomUUID();
}

async function sendEmail(env, { to, toName, subject, html, attachments }) {
    const body = {
        from: { address: env.FROM_EMAIL, name: 'Cockney Cards' },
        to: [{ email_address: { address: to, name: toName || to } }],
        subject,
        htmlbody: html,
    };
    if (attachments && attachments.length) {
        body.attachments = attachments.map((a) => ({
            content: a.content,
            mime_type: a.mimeType || 'application/pdf',
            name: a.filename,
        }));
    }

    // Same account/region as stripe-webhook.js's sendViaZeptoMail — ZEPTOMAIL_TOKEN
    // is stored WITH the "Zoho-enczapikey " prefix already included, so it's
    // used directly here, and this account is on ZeptoMail's EU cluster.
    const res = await fetch('https://api.zeptomail.eu/v1.1/email', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: env.ZEPTOMAIL_TOKEN,
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const errText = await res.text();
        console.error('ZeptoMail send failed:', res.status, errText);
    }
    return res.ok;
}

export async function getUserFromAuth(request, env) {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return null;

    const now = Date.now();
    const session = await env.DB.prepare(
        'SELECT user_id, expires_at FROM sessions WHERE token = ?'
    ).bind(token).first();

    if (!session || session.expires_at < now) return null;

    const user = await env.DB.prepare(
        'SELECT id, email, plus_active, plus_current_period_end, referral_code FROM users WHERE id = ?'
    ).bind(session.user_id).first();

    return user || null;
}

// Used by the checkout functions to decide whether to waive postage for
// Cockney Cards Club members. Never trust a client-supplied "I'm a member"
// flag for something that affects price — this always re-verifies against
// the customer's actual session + D1 record. Returns false (not a member)
// for guests, expired sessions, or lapsed/cancelled subscriptions — never
// throws, so a broken/missing Authorization header just means standard
// postage applies rather than the checkout failing outright.
export async function checkPlusMembership(request, env) {
    try {
        const user = await getUserFromAuth(request, env);
        if (!user || !user.plus_active) return false;
        // Belt-and-braces expiry check in case a subscription.deleted/
        // updated webhook was ever missed — plus_active should already be
        // kept in sync by stripe-webhook.js, but this catches drift rather
        // than silently honouring a stale "active" flag forever.
        if (user.plus_current_period_end && user.plus_current_period_end < Date.now()) return false;
        return true;
    } catch (err) {
        console.error('checkPlusMembership failed, defaulting to non-member:', err);
        return false;
    }
}

// ---------- Route handlers ----------

export async function handleRequestLink(request, env) {
    const { email, ref } = await request.json();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ error: 'Please enter a valid email address.' }, 400, env);
    }
    const normalizedEmail = email.trim().toLowerCase();

    const token = uid();
    const expiresAt = Date.now() + MAGIC_LINK_MINUTES * 60 * 1000;
    // `ref` is whatever referral code (if any) the visitor's browser had
    // stashed from a ?ref= link — carried here so it survives the round
    // trip through the login email and is still available at handleVerify
    // time, when we actually know whether this is a brand-new signup.
    const refCode = (ref || '').toString().trim().toUpperCase().slice(0, 20) || null;

    await env.DB.prepare(
        'INSERT INTO magic_tokens (token, email, expires_at, used, ref) VALUES (?, ?, ?, 0, ?)'
    ).bind(token, normalizedEmail, expiresAt, refCode).run();

    const loginUrl = `${env.SITE_URL}/account.html?token=${token}`;

    await sendEmail(env, {
        to: normalizedEmail,
        subject: 'Your Cockney Cards login link',
        html: `
            <p>Hi there,</p>
            <p>Click below to log in to your Cockney Cards account. This link expires in ${MAGIC_LINK_MINUTES} minutes.</p>
            <p><a href="${loginUrl}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 20px;text-decoration:none;">Log In</a></p>
            <p>If you didn't request this, you can ignore this email.</p>
        `,
    });

    return json({ ok: true, message: 'Check your email for a login link.' }, 200, env);
}

export async function handleVerify(request, env) {
    const { token } = await request.json();
    if (!token) return json({ error: 'Missing token.' }, 400, env);

    const record = await env.DB.prepare(
        'SELECT * FROM magic_tokens WHERE token = ?'
    ).bind(token).first();

    if (!record || record.used || record.expires_at < Date.now()) {
        return json({ error: 'This login link is invalid or has expired.' }, 400, env);
    }

    await env.DB.prepare('UPDATE magic_tokens SET used = 1 WHERE token = ?').bind(token).run();

    let user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(record.email).first();
    if (!user) {
        const newId = uid();
        const referralCode = await generateUniqueReferralCode(env);
        await env.DB.prepare(
            'INSERT INTO users (id, email, created_at, referral_code) VALUES (?, ?, ?, ?)'
        ).bind(newId, record.email, Date.now(), referralCode).run();
        user = { id: newId, email: record.email, referral_code: referralCode };

        // Only ever recorded for brand-new accounts — an existing user
        // clicking someone else's referral link to log back in shouldn't
        // retroactively create a referral for an account that already
        // existed before that link was clicked.
        await recordReferralIfAny(env, record.ref, newId, record.email);
    }

    const sessionToken = uid();
    const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
    await env.DB.prepare(
        'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
    ).bind(sessionToken, user.id, expiresAt).run();

    return json({ ok: true, sessionToken, email: user.email }, 200, env);
}

export async function handleGetReminders(request, env) {
    const user = await getUserFromAuth(request, env);
    if (!user) return json({ error: 'Not logged in.' }, 401, env);

    const { results } = await env.DB.prepare(
        'SELECT id, occasion_name, relationship, month, day FROM reminders WHERE user_id = ? ORDER BY month, day'
    ).bind(user.id).all();

    return json({ reminders: results }, 200, env);
}

export async function handleAddReminder(request, env) {
    const user = await getUserFromAuth(request, env);
    if (!user) return json({ error: 'Not logged in.' }, 401, env);

    const { occasion_name, relationship, month, day } = await request.json();
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);

    if (!occasion_name || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) {
        return json({ error: 'Please provide a name, month, and day.' }, 400, env);
    }

    const id = uid();
    await env.DB.prepare(
        'INSERT INTO reminders (id, user_id, occasion_name, relationship, month, day, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, user.id, occasion_name.trim(), (relationship || '').trim(), m, d, Date.now()).run();

    return json({ ok: true, id }, 200, env);
}

export async function handleGetAccount(request, env) {
    const user = await getUserFromAuth(request, env);
    if (!user) return json({ error: 'Not logged in.' }, 401, env);

    return json({
        email: user.email,
        plusActive: !!user.plus_active,
        plusCurrentPeriodEnd: user.plus_current_period_end || null,
    }, 200, env);
}

// Powers the "Refer a Friend" account tab — the user's own referral
// code/link, who they've referred so far and whether each has qualified,
// and any free-card reward codes they've earned (redeemed or not).
export async function handleGetReferralInfo(request, env) {
    const user = await getUserFromAuth(request, env);
    if (!user) return json({ error: 'Not logged in.' }, 401, env);

    try {
        const summary = await getReferralSummary(env, user);
        const referralLink = `${env.SITE_URL}/?ref=${summary.referralCode}`;

        return json({
            referralCode: summary.referralCode,
            referralLink,
            referrals: summary.referrals.map((r) => ({
                email: r.referred_email,
                status: r.status,
                createdAt: r.created_at,
                qualifiedAt: r.qualified_at,
            })),
            rewards: summary.rewards.map((r) => ({
                code: r.code,
                redeemed: !!r.redeemed,
                createdAt: r.created_at,
                redeemedAt: r.redeemed_at,
            })),
        }, 200, env);
    } catch (err) {
        // Most likely cause: the referrals/reward_codes tables or the
        // users.referral_code column don't exist yet in this D1 database
        // (see referrals-schema.sql) — surface a real error instead of
        // letting the request fail with an empty/unhandled response.
        console.error('handleGetReferralInfo failed:', err);
        return json({ error: 'Could not load referral info.' }, 500, env);
    }
}

export async function handleGetOrders(request, env) {
    const user = await getUserFromAuth(request, env);
    if (!user) return json({ error: 'Not logged in.' }, 401, env);

    // Orders are written to D1 by stripe-webhook.js the moment a payment
    // completes — matched to accounts by email, since Checkout Sessions
    // don't create a persistent Stripe Customer object to key off.
    const { results } = await env.DB.prepare(
        `SELECT id, product_type, custom_name, custom_age, custom_name2, custom_age2, size, amount_total, created_at
         FROM orders WHERE email = ? ORDER BY created_at DESC`
    ).bind(user.email.toLowerCase()).all();

    const orders = results.map((o) => ({
        id: o.id,
        created: Math.floor(o.created_at / 1000), // seconds, to match front-end expectations
        product_type: o.product_type,
        name: o.custom_name,
        age: o.custom_age,
        name2: o.custom_name2,
        age2: o.custom_age2,
        size: o.size,
        amount_total: o.amount_total,
    }));

    return json(orders, 200, env);
}

export async function handleDeleteReminder(request, env, reminderId) {
    const user = await getUserFromAuth(request, env);
    if (!user) return json({ error: 'Not logged in.' }, 401, env);

    await env.DB.prepare(
        'DELETE FROM reminders WHERE id = ? AND user_id = ?'
    ).bind(reminderId, user.id).run();

    return json({ ok: true }, 200, env);
}

// ---------- Daily cron: send reminders 14 days ahead ----------

export async function runDailyReminderCheck(env) {
    const target = new Date();
    target.setUTCDate(target.getUTCDate() + 14);
    const targetMonth = target.getUTCMonth() + 1;
    const targetDay = target.getUTCDate();

    const { results } = await env.DB.prepare(
        `SELECT reminders.occasion_name, reminders.relationship, users.email
         FROM reminders JOIN users ON reminders.user_id = users.id
         WHERE reminders.month = ? AND reminders.day = ?`
    ).bind(targetMonth, targetDay).all();

    for (const row of results) {
        const who = row.relationship || row.occasion_name;
        await sendEmail(env, {
            to: row.email,
            subject: `${row.occasion_name} is coming up in 2 weeks!`,
            html: `
                <p>Just a friendly reminder — <strong>${row.occasion_name}</strong> is coming up in 2 weeks.</p>
                <p>Plenty of time to pick out the perfect card for ${who}.</p>
                <p><a href="${env.SITE_URL}/shop-cards.html" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 20px;text-decoration:none;">Shop Cards</a></p>
            `,
        });
    }

    console.log(`Reminder check complete: ${results.length} email(s) sent for ${targetMonth}/${targetDay}.`);
}
