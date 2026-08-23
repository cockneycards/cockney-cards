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
//  - STRIPE_SECRET_KEY (same secret create-membership-checkout.js uses —
//                        needed here too now, for handleCancelMembership /
//                        handleResumeMembership to update a subscription
//                        directly with Stripe)
//
// D1 schema this expects (already exists — old-bush was writing to the
// same cockney-cards-db this project now also uses):
//  - users            (id, email, created_at, referral_code, plus_active,
//                       plus_current_period_end, plus_subscription_id,
//                       plus_cancel_at_period_end, stripe_customer_id) —
//                       plus_cancel_at_period_end is a newer column (see
//                       club-schema-update.sql) that mirrors Stripe's own
//                       subscription.cancel_at_period_end flag, so the
//                       account page can show "renews on X" vs "ends on X,
//                       won't renew" without an extra Stripe API call on
//                       every page load.
//  - sessions         (token, user_id, expires_at)
//  - magic_tokens     (token, email, expires_at, used, ref)
//  - reminders        (id, user_id, occasion_name, relationship, month, day, created_at)
//  - orders           (id, email, product_type, custom_name, custom_age,
//                       custom_name2, custom_age2, size, amount_total, created_at)
//  - referrals, reward_codes — see referrals.js and referrals-schema.sql
//    for the "Refer a Friend" tables this file now also touches.

import { generateUniqueReferralCode, recordReferralIfAny, getReferralSummary, newCustomerWelcomeEmailHtml, referralInviteEmailHtml } from './referrals.js';

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
        'SELECT id, email, plus_active, plus_current_period_end, plus_subscription_id, plus_cancel_at_period_end, referral_code FROM users WHERE id = ?'
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
        // existed before that link was clicked. When it does create one,
        // it also issues this new user a 25%-off-one-card welcome reward
        // and hands back its code so we can email them about it here —
        // referrals.js only touches D1, it doesn't send mail itself.
        const referralResult = await recordReferralIfAny(env, record.ref, newId, record.email);
        if (referralResult?.rewardCode) {
            try {
                await sendEmail(env, {
                    to: record.email,
                    subject: "You've got 25% off your first Cockney Cards order!",
                    html: newCustomerWelcomeEmailHtml(env, referralResult.rewardCode),
                });
            } catch (err) {
                // A failed welcome email shouldn't block account creation —
                // the reward code is already saved and still redeemable,
                // they just won't have gotten the email announcing it.
                console.error('Failed to send welcome discount email:', err);
            }
        }
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
        plusCancelAtPeriodEnd: !!user.plus_cancel_at_period_end,
    }, 200, env);
}

// ---------- Cockney Club subscription management ----------
//
// Both handlers below need routing added for them in _worker.js (not part
// of this file) — POST /api/account/cancel-membership and POST
// /api/account/resume-membership, same pattern as the other /api/account*
// routes already wired there. Both also require STRIPE_SECRET_KEY, the
// same secret create-membership-checkout.js already uses to start a
// subscription in the first place.

// Turns auto-renewal off for the caller's own Club subscription by
// setting cancel_at_period_end on the underlying Stripe subscription.
// This does NOT end their membership immediately — per the Club terms
// (cockney-club.html, Section 5) they keep the 30% discount until the
// period they've already paid for actually runs out, it just won't
// renew after that. The authoritative status update still comes from
// Stripe's own customer.subscription.updated webhook (see
// stripe-webhook.js) — this also updates D1 directly so the account page
// reflects the change immediately rather than waiting on that webhook.
export async function handleCancelMembership(request, env) {
    const user = await getUserFromAuth(request, env);
    if (!user) return json({ error: 'Not logged in.' }, 401, env);
    if (!user.plus_active || !user.plus_subscription_id) {
        return json({ error: 'No active membership to cancel.' }, 400, env);
    }

    try {
        const res = await fetch(`https://api.stripe.com/v1/subscriptions/${user.plus_subscription_id}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ cancel_at_period_end: 'true' }),
        });
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            console.error('Stripe cancel_at_period_end failed:', res.status, errBody);
            return json({ error: 'Could not cancel your membership — please try again or contact us.' }, 500, env);
        }

        await env.DB.prepare('UPDATE users SET plus_cancel_at_period_end = 1 WHERE id = ?').bind(user.id).run();
        return json({ ok: true }, 200, env);
    } catch (err) {
        console.error('handleCancelMembership failed:', err);
        return json({ error: 'Could not cancel your membership — please try again or contact us.' }, 500, env);
    }
}

// The reverse of the above — lets someone who cancelled change their
// mind and switch auto-renewal back on, as long as their current paid
// period hasn't actually ended yet (plus_active is still true; Stripe
// won't let cancel_at_period_end be un-set on a subscription that's
// already been cancelled outright).
export async function handleResumeMembership(request, env) {
    const user = await getUserFromAuth(request, env);
    if (!user) return json({ error: 'Not logged in.' }, 401, env);
    if (!user.plus_active || !user.plus_subscription_id) {
        return json({ error: 'No membership to resume.' }, 400, env);
    }

    try {
        const res = await fetch(`https://api.stripe.com/v1/subscriptions/${user.plus_subscription_id}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ cancel_at_period_end: 'false' }),
        });
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            console.error('Stripe resume (cancel_at_period_end=false) failed:', res.status, errBody);
            return json({ error: 'Could not resume your membership — please try again or contact us.' }, 500, env);
        }

        await env.DB.prepare('UPDATE users SET plus_cancel_at_period_end = 0 WHERE id = ?').bind(user.id).run();
        return json({ ok: true }, 200, env);
    } catch (err) {
        console.error('handleResumeMembership failed:', err);
        return json({ error: 'Could not resume your membership — please try again or contact us.' }, 500, env);
    }
}

// Powers the "Refer a Friend" account tab — the user's own referral
// code/link, who they've referred so far and whether each has qualified,
// and any free-card reward codes they've earned (redeemed or not).
export async function handleGetReferralInfo(request, env) {
    const user = await getUserFromAuth(request, env);
    if (!user) return json({ error: 'Not logged in.' }, 401, env);

    try {
        const summary = await getReferralSummary(env, user);
        const referralLink = `${env.SITE_URL}/account.html?ref=${summary.referralCode}`;

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
                rewardType: r.reward_type,
                discountPercent: r.discount_percent || null,
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

// Powers the "Send Invite" form on the Refer a Friend tab — the
// alternative to the user having to copy-paste their link somewhere
// themselves. Needs routing added in _worker.js: POST
// /api/referrals/send-invite, same pattern as the other /api/referrals*
// route(s) already wired there.
export async function handleSendReferralInvite(request, env) {
    const user = await getUserFromAuth(request, env);
    if (!user) return json({ error: 'Not logged in.' }, 401, env);

    const { friendName, friendEmail } = await request.json();
    const email = (friendEmail || '').toString().trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ error: "Please enter a valid email address for your friend." }, 400, env);
    }
    if (email === user.email.toLowerCase()) {
        return json({ error: "You can't send a referral invite to your own email address." }, 400, env);
    }

    try {
        const referralLink = `${env.SITE_URL}/account.html?ref=${user.referral_code}`;
        const sent = await sendEmail(env, {
            to: email,
            toName: (friendName || '').toString().trim() || undefined,
            subject: "You've been invited to join Cockney Cards",
            html: referralInviteEmailHtml(env, {
                friendName: (friendName || '').toString().trim(),
                referralLink,
            }),
        });
        if (!sent) return json({ error: 'Could not send the invite — please try again.' }, 500, env);
        return json({ ok: true }, 200, env);
    } catch (err) {
        console.error('handleSendReferralInvite failed:', err);
        return json({ error: 'Could not send the invite — please try again.' }, 500, env);
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
