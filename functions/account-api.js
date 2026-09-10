// functions/account-api.js
//
// Cockney Cards — Account API. Handles email+password signup/login,
// password reset, sessions, and birthday reminder CRUD, plus a daily
// cron job that emails customers 10 days before a saved date.
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
//  - users            (id, email, created_at, referral_code, password_hash,
//                       plus_active, plus_current_period_end,
//                       plus_subscription_id, plus_cancel_at_period_end,
//                       stripe_customer_id) — password_hash is a newer
//                       column (see password-schema-update.sql), NULL for
//                       any account that hasn't set one yet (e.g. one
//                       created by guest-checkout membership purchase —
//                       see findOrCreateUserByEmail — until they Sign Up
//                       or Reset Password with that same email).
//                       plus_cancel_at_period_end mirrors Stripe's own
//                       subscription.cancel_at_period_end flag, so the
//                       account page can show "renews on X" vs "ends on X,
//                       won't renew" without an extra Stripe API call on
//                       every page load.
//  - sessions         (token, user_id, expires_at)
//  - magic_tokens     (token, email, expires_at, used, ref) — originally
//                       for magic-link login (now removed in favour of
//                       password auth); repurposed as a generic
//                       short-lived email-verification token for password
//                       reset (handleRequestPasswordReset/
//                       handleResetPassword below), `ref` just stays NULL
//                       for those rows.
//  - reminders        (id, user_id, occasion_name, relationship, month, day, created_at)
//  - orders           (id, email, product_type, custom_name, custom_age,
//                       custom_name2, custom_age2, size, amount_total, created_at)
//  - referrals, reward_codes — see referrals.js and referrals-schema.sql
//    for the "Refer a Friend" tables this file now also touches.
//  - addresses        (id, user_id, label, name, address1, address2,
//                       city, county, postcode, country, is_default,
//                       created_at) — see addresses-schema.sql. Same
//                       field shape as the recipient address object
//                       create-checkout-basket.js/stripe-webhook.js
//                       already use for gifted items, so a saved address
//                       can be dropped straight into item.delivery
//                       elsewhere without reshaping it.

import { generateUniqueReferralCode, recordReferralIfAny, getReferralSummary, newCustomerWelcomeEmailHtml, referralInviteEmailHtml } from './referrals.js';

const SESSION_DAYS = 30;
const RESET_TOKEN_MINUTES = 15;
const PBKDF2_ITERATIONS = 100000;

// ---------- Password hashing (Web Crypto's PBKDF2 — no external deps,
// works in the Workers runtime as-is) ----------

function bufToHex(buf) {
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuf(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    return bytes;
}

async function pbkdf2(password, salt, iterations) {
    const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, keyMaterial, 256);
    return new Uint8Array(bits);
}

// Stored as "pbkdf2$<iterations>$<salt hex>$<hash hex>" — the iteration
// count travels with the hash so it can be raised later without
// invalidating passwords hashed under the old count.
async function hashPassword(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
    return `pbkdf2$${PBKDF2_ITERATIONS}$${bufToHex(salt)}$${bufToHex(hash)}`;
}

// Constant-time-ish compare (loops over every byte regardless of an
// early mismatch) so a failed login can't be timed to leak how many
// leading hash bytes were correct.
function hashesMatch(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

async function verifyPassword(password, stored) {
    if (!stored) return false;
    const [scheme, iterStr, saltHex, hashHex] = stored.split('$');
    if (scheme !== 'pbkdf2' || !saltHex || !hashHex) return false;
    const hash = await pbkdf2(password, hexToBuf(saltHex), parseInt(iterStr, 10));
    return hashesMatch(bufToHex(hash), hashHex);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

// Plain welcome email for a brand-new account created WITHOUT a referral
// code — see handleSignup below. Referred signups get
// newCustomerWelcomeEmailHtml (referrals.js) instead, which covers the
// same "welcome" ground but leads with their discount code.
function welcomeEmailHtml(env) {
    const shopUrl = `${env.SITE_URL}/shop-cards.html`;
    const clubUrl = `${env.SITE_URL}/cockney-club.html`;
    return `
        <p style="text-align:center; margin:0 0 24px;"><img src="https://images.cockneycards.com/logo.png" alt="Cockney Cards" style="max-width:160px; height:auto;"></p>
        <p>Hi there,</p>
        <p>Welcome to Cockney Cards! Your account's all set up.</p>
        <p>From here you can build a personalised card or photo print, keep an eye on your orders, and save addresses for next time.</p>
        <p><a href="${shopUrl}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 20px;text-decoration:none;">Start Browsing</a></p>
        <p>One more thing — if you send cards often, <a href="${clubUrl}">Cockney Cards Club</a> gets you 25% off every card for £9.99 a year. Worth a look if you're planning on more than a couple of orders.</p>
    `;
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
        'SELECT id, email, plus_active, plus_current_period_end, plus_subscription_id, plus_cancel_at_period_end, referral_code, password_hash FROM users WHERE id = ?'
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

// Used by create-payment-intent-basket.js so a guest can buy Cockney
// Cards Club membership without logging in first — membership has to
// attach to a user id (see the users table's plus_* columns), so this
// finds their account by the email they typed at checkout, or creates
// one on the spot if it doesn't exist yet. Same account-creation shape
// handleVerify() uses for a magic-link login (id, referral code), just
// without the click-through first — completing payment is the
// verification here instead. Never issues a session token, so the guest
// stays "logged out" for the rest of this visit; they can log in
// normally afterwards with this same email via the usual magic link.
export async function findOrCreateUserByEmail(email, env) {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(normalizedEmail).first();
    if (existing) return existing;

    const newId = uid();
    const referralCode = await generateUniqueReferralCode(env);
    await env.DB.prepare(
        'INSERT INTO users (id, email, created_at, referral_code) VALUES (?, ?, ?, ?)'
    ).bind(newId, normalizedEmail, Date.now(), referralCode).run();
    return { id: newId, email: normalizedEmail, referral_code: referralCode, plus_active: 0 };
}

// Activates a one-off (non-subscription) Cockney Cards Club membership —
// used both by stripe-webhook.js once a paid one-off membership's
// payment_intent.succeeded fires, and by create-payment-intent-basket.js
// for the Family13 free-membership promo, which never goes through
// Stripe at all. Sets the same plus_current_period_end shape a real
// subscription would, so checkPlusMembership()'s existing expiry check
// above is what actually turns it back off a year from now — nothing
// else needs to run to expire it. No plus_subscription_id is set, since
// there's no Stripe Subscription object behind either path, which also
// means handleCancelMembership/handleResumeMembership below correctly
// won't offer to "cancel" it — it's not a recurring thing, it just
// lapses on its own.
export async function activateOneOffMembership(env, userId) {
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    await env.DB.prepare(
        `UPDATE users SET plus_active = 1, plus_current_period_end = ?, plus_cancel_at_period_end = 0 WHERE id = ?`
    ).bind(Date.now() + oneYearMs, userId).run();
}

// Shared by handleSignup/handleResetPassword — creates a session and
// returns the same { ok, sessionToken, email } shape the old magic-link
// handleVerify used to, so account.html's existing setSessionToken(...)
// call site needs no changes.
async function createSessionResponse(env, user) {
    const sessionToken = uid();
    const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
    await env.DB.prepare(
        'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
    ).bind(sessionToken, user.id, expiresAt).run();
    return json({ ok: true, sessionToken, email: user.email }, 200, env);
}

export async function handleSignup(request, env) {
    const { email, password, ref } = await request.json();
    if (!email || !EMAIL_RE.test(email)) {
        return json({ error: 'Please enter a valid email address.' }, 400, env);
    }
    if (!password || password.length < 8) {
        return json({ error: 'Password must be at least 8 characters.' }, 400, env);
    }
    const normalizedEmail = email.trim().toLowerCase();

    // findOrCreateUserByEmail (used by guest checkout — see
    // create-payment-intent-basket.js) can already have created a
    // password-less account under this email; that's not a duplicate
    // signup, it's this same person setting their first password. Any
    // account that already HAS a password is a genuine duplicate.
    const existing = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(normalizedEmail).first();
    if (existing && existing.password_hash) {
        return json({ error: 'An account with this email already exists — please log in instead.' }, 400, env);
    }

    const passwordHash = await hashPassword(password);
    let user;
    if (existing) {
        await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(passwordHash, existing.id).run();
        user = existing;
    } else {
        const newId = uid();
        const referralCode = await generateUniqueReferralCode(env);
        await env.DB.prepare(
            'INSERT INTO users (id, email, created_at, referral_code, password_hash) VALUES (?, ?, ?, ?, ?)'
        ).bind(newId, normalizedEmail, Date.now(), referralCode, passwordHash).run();
        user = { id: newId, email: normalizedEmail, referral_code: referralCode };

        // Only ever recorded for a genuinely brand-new account — see the
        // comment this had at the old handleVerify call site.
        const refCode = (ref || '').toString().trim().toUpperCase().slice(0, 20) || null;
        const referralResult = await recordReferralIfAny(env, refCode, newId, normalizedEmail);
        if (referralResult?.rewardCode) {
            try {
                await sendEmail(env, {
                    to: normalizedEmail,
                    subject: "You've got 15% off your first Cockney Cards order!",
                    html: newCustomerWelcomeEmailHtml(env, referralResult.rewardCode),
                });
            } catch (err) {
                console.error('Failed to send welcome discount email:', err);
            }
        } else {
            // Every other brand-new signup (i.e. not via a referral link)
            // still gets a welcome — just without a discount code to show.
            try {
                await sendEmail(env, {
                    to: normalizedEmail,
                    subject: 'Welcome to Cockney Cards!',
                    html: welcomeEmailHtml(env),
                });
            } catch (err) {
                console.error('Failed to send welcome email:', err);
            }
        }
    }

    return createSessionResponse(env, user);
}

export async function handleLogin(request, env) {
    const { email, password } = await request.json();
    if (!email || !password) {
        return json({ error: 'Please enter your email and password.' }, 400, env);
    }
    const normalizedEmail = email.trim().toLowerCase();
    const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(normalizedEmail).first();

    // Same generic error whether the account doesn't exist, has no
    // password yet (e.g. created via guest checkout — see
    // findOrCreateUserByEmail — and never claimed via Sign Up or Reset
    // Password), or the password's simply wrong. Never reveal which —
    // that's an account-enumeration leak.
    if (!user || !(await verifyPassword(password, user.password_hash))) {
        return json({ error: 'Incorrect email or password.' }, 400, env);
    }

    return createSessionResponse(env, user);
}

// Re-uses the magic_tokens table (token/email/expires_at/used) as a
// generic short-lived email-verification token, now for password reset
// instead of login itself — same shape, `ref` just stays NULL here.
export async function handleRequestPasswordReset(request, env) {
    const { email } = await request.json();
    if (!email || !EMAIL_RE.test(email)) {
        return json({ error: 'Please enter a valid email address.' }, 400, env);
    }
    const normalizedEmail = email.trim().toLowerCase();

    // Identical response whether or not an account exists, so this can't
    // be used to check which emails have accounts.
    const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(normalizedEmail).first();
    if (user) {
        const token = uid();
        const expiresAt = Date.now() + RESET_TOKEN_MINUTES * 60 * 1000;
        await env.DB.prepare(
            'INSERT INTO magic_tokens (token, email, expires_at, used, ref) VALUES (?, ?, ?, 0, NULL)'
        ).bind(token, normalizedEmail, expiresAt).run();

        const resetUrl = `${env.SITE_URL}/account.html?resetToken=${token}`;
        await sendEmail(env, {
            to: normalizedEmail,
            subject: 'Reset your Cockney Cards password',
            html: `
                <p>Hi there,</p>
                <p>Click below to set a new password for your Cockney Cards account. This link expires in ${RESET_TOKEN_MINUTES} minutes.</p>
                <p><a href="${resetUrl}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 20px;text-decoration:none;">Reset Password</a></p>
                <p>If you didn't request this, you can ignore this email.</p>
            `,
        });
    }

    return json({ ok: true, message: 'If that email has an account, a reset link is on its way.' }, 200, env);
}

export async function handleResetPassword(request, env) {
    const { token, password } = await request.json();
    if (!token) return json({ error: 'Missing token.' }, 400, env);
    if (!password || password.length < 8) {
        return json({ error: 'Password must be at least 8 characters.' }, 400, env);
    }

    const record = await env.DB.prepare('SELECT * FROM magic_tokens WHERE token = ?').bind(token).first();
    if (!record || record.used || record.expires_at < Date.now()) {
        return json({ error: 'This reset link is invalid or has expired.' }, 400, env);
    }
    await env.DB.prepare('UPDATE magic_tokens SET used = 1 WHERE token = ?').bind(token).run();

    const user = await env.DB.prepare('SELECT id, email FROM users WHERE email = ?').bind(record.email).first();
    if (!user) return json({ error: 'No account found for this link.' }, 400, env);

    const passwordHash = await hashPassword(password);
    await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(passwordHash, user.id).run();

    return createSessionResponse(env, user);
}

// Authenticated — for the Security tab in account.html. A user with no
// password yet (guest-checkout account, or a reset link never used) has
// nothing to check against, so an active session alone is enough to set
// one directly; once a password exists, changing it requires the
// current one.
export async function handleChangePassword(request, env) {
    const user = await getUserFromAuth(request, env);
    if (!user) return json({ error: 'Not logged in.' }, 401, env);

    const { currentPassword, newPassword } = await request.json();
    if (!newPassword || newPassword.length < 8) {
        return json({ error: 'New password must be at least 8 characters.' }, 400, env);
    }
    if (user.password_hash && !(await verifyPassword(currentPassword || '', user.password_hash))) {
        return json({ error: 'Current password is incorrect.' }, 400, env);
    }

    const passwordHash = await hashPassword(newPassword);
    await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(passwordHash, user.id).run();
    return json({ ok: true }, 200, env);
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

    // occasion_name holds who the reminder is for (account.html's
    // "Reminder For" field, e.g. "Mum"); relationship holds the occasion
    // itself (account.html's "Occasion" field, e.g. "Birthday") — an odd
    // pairing of column names to what they now store, kept as-is to
    // avoid a schema migration, but both are required from here on (used
    // to just be occasion_name) — see runDailyReminderCheck below for
    // where this reads back out into an email.
    const { occasion_name, relationship, month, day } = await request.json();
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);

    if (!occasion_name || !relationship || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) {
        return json({ error: 'Please provide who it\'s for, the occasion, month, and day.' }, 400, env);
    }

    const id = uid();
    await env.DB.prepare(
        'INSERT INTO reminders (id, user_id, occasion_name, relationship, month, day, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, user.id, occasion_name.trim(), relationship.trim(), m, d, Date.now()).run();

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
// (cockney-club.html, Section 5) they keep the 25% discount until the
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

// Permanently deletes the caller's own account — the "Danger Zone" button
// on account.html. Needs routing added in _worker.js: DELETE /api/account,
// same pattern as the other /api/account* routes already wired there.
//
// If they have an active Club subscription, that's cancelled immediately
// in Stripe first (not cancel_at_period_end like handleCancelMembership —
// there's no account left afterwards to keep benefiting from the current
// period). A failed Stripe call is logged but doesn't block the deletion;
// worst case is an orphaned subscription still billing a deleted account,
// which is far worse than a merely-unlisted one, so this always proceeds.
//
// Clears out the rows this file knows the exact schema for — sessions
// (logs out every device, not just this one), reminders, addresses — then
// the user row itself. Deliberately leaves `orders` alone: past purchases
// are financial/accounting records, not account data, and sites normally
// keep those after a deletion. Also leaves the referrals/reward_codes
// tables untouched — their schema lives in referrals.js/
// referrals-schema.sql, not this file, so precise cleanup for those is
// better handled there than guessed at here.
export async function handleDeleteAccount(request, env) {
    const user = await getUserFromAuth(request, env);
    if (!user) return json({ error: 'Not logged in.' }, 401, env);

    if (user.plus_active && user.plus_subscription_id) {
        try {
            const res = await fetch(`https://api.stripe.com/v1/subscriptions/${user.plus_subscription_id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
            });
            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                console.error('Stripe subscription cancel failed during account deletion:', res.status, errBody);
            }
        } catch (err) {
            console.error('Stripe subscription cancel threw during account deletion:', err);
        }
    }

    try {
        await env.DB.batch([
            env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
            env.DB.prepare('DELETE FROM reminders WHERE user_id = ?').bind(user.id),
            env.DB.prepare('DELETE FROM addresses WHERE user_id = ?').bind(user.id),
            env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
        ]);
        return json({ ok: true }, 200, env);
    } catch (err) {
        console.error('handleDeleteAccount failed:', err);
        return json({ error: 'Could not delete your account — please try again or contact us.' }, 500, env);
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

// ---------- Saved Addresses ----------
//
// Backs the "Saved Addresses" tab in account.html, and (next) a picker on
// basket.html for "self" delivery items — the whole point of this table is
// to stop the customer having to retype (or Stripe having to guess) their
// own address every time. Needs routing added in _worker.js, same pattern
// as /api/reminders*:
//   GET    /api/addresses             -> handleGetAddresses
//   POST   /api/addresses             -> handleAddAddress
//   DELETE /api/addresses/:id         -> handleDeleteAddress
//   POST   /api/addresses/:id/default -> handleSetDefaultAddress

export async function handleGetAddresses(request, env) {
    const user = await getUserFromAuth(request, env);
    if (!user) return json({ error: 'Not logged in.' }, 401, env);

    const { results } = await env.DB.prepare(
        `SELECT id, label, name, address1, address2, city, county, postcode, country, is_default
         FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC`
    ).bind(user.id).all();

    return json({ addresses: results }, 200, env);
}

export async function handleAddAddress(request, env) {
    const user = await getUserFromAuth(request, env);
    if (!user) return json({ error: 'Not logged in.' }, 401, env);

    const body = await request.json();
    const label = (body.label || '').toString().trim().slice(0, 100) || 'Address';
    const name = (body.name || '').toString().trim().slice(0, 200);
    const address1 = (body.address1 || '').toString().trim().slice(0, 200);
    const address2 = (body.address2 || '').toString().trim().slice(0, 200);
    const city = (body.city || '').toString().trim().slice(0, 200);
    const county = (body.county || '').toString().trim().slice(0, 200);
    const postcode = (body.postcode || '').toString().trim().slice(0, 50);
    const country = (body.country || 'United Kingdom').toString().trim().slice(0, 100);

    if (!name || !address1 || !city || !postcode) {
        return json({ error: 'Please fill in at least name, address, city, and postcode.' }, 400, env);
    }

    const id = uid();

    // A brand-new address becomes the default automatically if it's the
    // customer's first one, so there's always a default for the basket to
    // pre-select without them having to visit Account first.
    const countRow = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM addresses WHERE user_id = ?'
    ).bind(user.id).first();
    const makeDefault = !!body.isDefault || (countRow?.count || 0) === 0;

    if (makeDefault) {
        await env.DB.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').bind(user.id).run();
    }

    await env.DB.prepare(
        `INSERT INTO addresses (id, user_id, label, name, address1, address2, city, county, postcode, country, is_default, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, user.id, label, name, address1, address2, city, county, postcode, country, makeDefault ? 1 : 0, Date.now()).run();

    return json({ ok: true, id }, 200, env);
}

export async function handleDeleteAddress(request, env, addressId) {
    const user = await getUserFromAuth(request, env);
    if (!user) return json({ error: 'Not logged in.' }, 401, env);

    const addr = await env.DB.prepare(
        'SELECT is_default FROM addresses WHERE id = ? AND user_id = ?'
    ).bind(addressId, user.id).first();

    await env.DB.prepare(
        'DELETE FROM addresses WHERE id = ? AND user_id = ?'
    ).bind(addressId, user.id).run();

    // If the deleted address was the default, promote the most recently
    // added of whatever's left, so the basket still has one to fall back
    // on rather than being left with none.
    if (addr?.is_default) {
        const next = await env.DB.prepare(
            'SELECT id FROM addresses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
        ).bind(user.id).first();
        if (next) {
            await env.DB.prepare('UPDATE addresses SET is_default = 1 WHERE id = ?').bind(next.id).run();
        }
    }

    return json({ ok: true }, 200, env);
}

export async function handleSetDefaultAddress(request, env, addressId) {
    const user = await getUserFromAuth(request, env);
    if (!user) return json({ error: 'Not logged in.' }, 401, env);

    const addr = await env.DB.prepare(
        'SELECT id FROM addresses WHERE id = ? AND user_id = ?'
    ).bind(addressId, user.id).first();
    if (!addr) return json({ error: 'Address not found.' }, 404, env);

    await env.DB.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').bind(user.id).run();
    await env.DB.prepare('UPDATE addresses SET is_default = 1 WHERE id = ?').bind(addressId).run();

    return json({ ok: true }, 200, env);
}

// ---------- Daily cron: send reminders 10 days ahead ----------

export async function runDailyReminderCheck(env) {
    const target = new Date();
    target.setUTCDate(target.getUTCDate() + 10);
    const targetMonth = target.getUTCMonth() + 1;
    const targetDay = target.getUTCDate();

    const { results } = await env.DB.prepare(
        `SELECT reminders.occasion_name, reminders.relationship, users.email
         FROM reminders JOIN users ON reminders.user_id = users.id
         WHERE reminders.month = ? AND reminders.day = ?`
    ).bind(targetMonth, targetDay).all();

    for (const row of results) {
        // row.occasion_name = who it's for (e.g. "Mum"), row.relationship
        // = the occasion (e.g. "Birthday") — see the comment on
        // handleAddReminder above for why the column names don't match
        // what they hold. Older reminders saved before that field became
        // required can still have a blank relationship, hence the
        // fallback wording.
        const who = row.occasion_name;
        const occasion = row.relationship || 'special day';
        const whatsComingUp = row.relationship ? `${who}’s ${occasion}` : who;
        await sendEmail(env, {
            to: row.email,
            subject: `${whatsComingUp} is coming up in 10 days!`,
            html: `
                <p>Just a friendly reminder — <strong>${whatsComingUp}</strong> is coming up in 10 days.</p>
                <p>Plenty of time to pick out the perfect card for ${who}.</p>
                <p><a href="${env.SITE_URL}/shop-cards.html" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 20px;text-decoration:none;">Shop Cards</a></p>
            `,
        });
    }

    console.log(`Reminder check complete: ${results.length} email(s) sent for ${targetMonth}/${targetDay}.`);
}
