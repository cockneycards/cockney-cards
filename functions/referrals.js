// functions/referrals.js
//
// Cockney Club "Refer a Friend" — a referring member gets a free card
// (they still pay postage) once someone they referred completes their
// first paid order. Two independent things happen here:
//   1. Turning a "pending" referral into a redeemable reward once the
//      referred friend's order comes in — called from stripe-webhook.js
//      right after it writes a completed order to D1.
//   2. Validating/redeeming the resulting reward code at checkout time —
//      validated from create-checkout-basket.js, redeemed from
//      stripe-webhook.js (only once payment actually succeeds).
//
// D1 schema this expects, in addition to what account-api.js documents —
// see referrals-schema.sql for the migration:
//   - users            gains a `referral_code` column (unique, short code)
//   - magic_tokens     gains a `ref` column (the code from the visitor's
//                       ?ref= link, carried from request-link through to
//                       account creation at verify time)
//   - referrals        (id, referrer_user_id, referred_email, status
//                       ['pending'|'qualified'], created_at, qualified_at)
//   - reward_codes     (code, user_id, reward_type, redeemed, created_at,
//                       redeemed_at)

function uid() {
    return crypto.randomUUID();
}

// Short, easy-to-read code — deliberately not the same generator as
// session/magic-link tokens (those are full UUIDs, fine for URLs but
// painful for a customer to read out loud or type in by hand).
function genShortCode(prefix) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — avoids ambiguity
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return prefix ? `${prefix}-${code}` : code;
}

// Generates a referral code for a new user, retrying on the rare
// collision (D1's UNIQUE index on users.referral_code would reject a
// duplicate insert anyway — this just avoids relying on that as the
// first line of defence).
export async function generateUniqueReferralCode(env) {
    for (let attempt = 0; attempt < 5; attempt++) {
        const code = genShortCode();
        const existing = await env.DB.prepare('SELECT id FROM users WHERE referral_code = ?').bind(code).first();
        if (!existing) return code;
    }
    // Astronomically unlikely to ever reach this with a 6-char code from
    // a 32-character alphabet, but fall back to something guaranteed
    // unique rather than fail account creation over it.
    return genShortCode(uid().slice(0, 4));
}

// Called from account-api.js's handleVerify, only when a brand-new user
// is being created and their magic_tokens row carried a `ref` code.
// Never throws — a broken referral shouldn't be able to block someone
// signing up.
export async function recordReferralIfAny(env, refCode, newUserId, newUserEmail) {
    if (!refCode) return;
    try {
        const referrer = await env.DB.prepare(
            'SELECT id FROM users WHERE referral_code = ?'
        ).bind(refCode).first();
        if (!referrer || referrer.id === newUserId) return; // unknown code, or (shouldn't happen) self-referral

        // INSERT OR IGNORE + the UNIQUE(referrer_user_id, referred_email)
        // constraint in the schema means a friend clicking the same link
        // twice, or verifying twice, can't create duplicate referral rows.
        await env.DB.prepare(
            `INSERT OR IGNORE INTO referrals (id, referrer_user_id, referred_email, status, created_at)
             VALUES (?, ?, ?, 'pending', ?)`
        ).bind(uid(), referrer.id, newUserEmail.toLowerCase(), Date.now()).run();
    } catch (err) {
        console.error('recordReferralIfAny failed:', err);
    }
}

// Called from stripe-webhook.js right after it writes a completed order
// to D1. If the buyer's email matches a pending referral, marks it
// qualified and issues the referrer a single-use "free card" reward
// code, then emails them about it. Never throws — a broken referral
// check shouldn't be able to fail an otherwise-successful order.
//
// `sendEmailFn` is passed in rather than imported, so this file doesn't
// need its own copy of the ZeptoMail plumbing — pass account-api.js's
// internal sendEmail (or stripe-webhook.js's own, whichever the caller
// already has in scope).
export async function checkAndQualifyReferral(env, buyerEmail, sendEmailFn) {
    try {
        const email = (buyerEmail || '').toLowerCase();
        if (!email) return;

        const referral = await env.DB.prepare(
            `SELECT id, referrer_user_id FROM referrals WHERE referred_email = ? AND status = 'pending'`
        ).bind(email).first();
        if (!referral) return;

        const rewardCode = genShortCode('FREE');
        await env.DB.prepare(
            `INSERT INTO reward_codes (code, user_id, reward_type, redeemed, created_at)
             VALUES (?, ?, 'free_card', 0, ?)`
        ).bind(rewardCode, referral.referrer_user_id, Date.now()).run();

        await env.DB.prepare(
            `UPDATE referrals SET status = 'qualified', qualified_at = ? WHERE id = ?`
        ).bind(Date.now(), referral.id).run();

        const referrer = await env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(referral.referrer_user_id).first();
        if (referrer && typeof sendEmailFn === 'function') {
            await sendEmailFn(env, {
                to: referrer.email,
                subject: "A friend you referred just ordered — here's your free card!",
                html: `
                    <p>Nice one — someone you referred to Cockney Cards just placed their first order.</p>
                    <p>Your reward code is: <strong>${rewardCode}</strong></p>
                    <p>Enter it at checkout on your next card order — the card's on us, you just cover delivery.</p>
                `,
            });
        }
    } catch (err) {
        console.error('checkAndQualifyReferral failed:', err);
    }
}

// Called from create-checkout-basket.js. Only confirms the code is valid,
// unredeemed, and belongs to the logged-in user — it does NOT mark it
// redeemed, since a Stripe Checkout Session can be abandoned without
// paying. Actual redemption happens in stripe-webhook.js, once payment
// is confirmed (see redeemRewardCode below).
export async function validateRewardCode(code, user, env) {
    if (!code || !user) return false;
    try {
        const normalized = code.toString().trim().toUpperCase();
        const row = await env.DB.prepare(
            'SELECT redeemed FROM reward_codes WHERE code = ? AND user_id = ?'
        ).bind(normalized, user.id).first();
        return !!(row && !row.redeemed);
    } catch (err) {
        console.error('validateRewardCode failed, treating as invalid:', err);
        return false;
    }
}

// Called from stripe-webhook.js once a checkout.session.completed event
// confirms payment actually went through — the counterpart to
// validateRewardCode above.
export async function redeemRewardCode(code, env) {
    if (!code) return;
    try {
        await env.DB.prepare(
            `UPDATE reward_codes SET redeemed = 1, redeemed_at = ? WHERE code = ? AND redeemed = 0`
        ).bind(Date.now(), code.toString().trim().toUpperCase()).run();
    } catch (err) {
        console.error('redeemRewardCode failed:', err);
    }
}

// Called from account-api.js's new handleGetReferralInfo, for the
// "Refer a Friend" account tab.
export async function getReferralSummary(env, user) {
    const referrals = await env.DB.prepare(
        `SELECT referred_email, status, created_at, qualified_at
         FROM referrals WHERE referrer_user_id = ? ORDER BY created_at DESC`
    ).bind(user.id).all();

    const rewards = await env.DB.prepare(
        `SELECT code, redeemed, created_at, redeemed_at
         FROM reward_codes WHERE user_id = ? ORDER BY created_at DESC`
    ).bind(user.id).all();

    return {
        referralCode: user.referral_code,
        referrals: referrals.results || [],
        rewards: rewards.results || [],
    };
}
