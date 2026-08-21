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
//   - reward_codes     (code, user_id, reward_type, discount_percent,
//                       redeemed, created_at, redeemed_at) — reward_type is
//                       'free_card' (the existing referrer reward — free
//                       card, customer still pays postage, discount_percent
//                       is NULL) or 'new_customer_25' (25% off one card,
//                       issued to a brand-new user who signed up via a
//                       referral link, discount_percent = 25). See
//                       referrals-schema-update.sql for the migration that
//                       adds discount_percent to an existing table.

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
// signing up. On success (a genuinely new referral, not a re-verify of
// one that already existed), also issues the new user a single-use 25%-
// off-one-card welcome reward and returns its code so the caller
// (account-api.js) can email them about it — this function only touches
// D1, it doesn't send email itself, same division of labour as the rest
// of this file.
export async function recordReferralIfAny(env, refCode, newUserId, newUserEmail) {
    if (!refCode) return null;
    try {
        const referrer = await env.DB.prepare(
            'SELECT id FROM users WHERE referral_code = ?'
        ).bind(refCode).first();
        if (!referrer || referrer.id === newUserId) return null; // unknown code, or (shouldn't happen) self-referral

        // INSERT OR IGNORE + the UNIQUE(referrer_user_id, referred_email)
        // constraint in the schema means a friend clicking the same link
        // twice, or verifying twice, can't create duplicate referral rows.
        const result = await env.DB.prepare(
            `INSERT OR IGNORE INTO referrals (id, referrer_user_id, referred_email, status, created_at)
             VALUES (?, ?, ?, 'pending', ?)`
        ).bind(uid(), referrer.id, newUserEmail.toLowerCase(), Date.now()).run();

        // Only issue the welcome discount when a referral row was actually
        // newly created — result.meta.changes is 0 when INSERT OR IGNORE
        // hit the UNIQUE constraint above, which stops someone re-verifying
        // against the same link from farming multiple 25%-off codes.
        if (!result?.meta?.changes) return null;

        const rewardCode = genShortCode('WELCOME');
        await env.DB.prepare(
            `INSERT INTO reward_codes (code, user_id, reward_type, discount_percent, redeemed, created_at)
             VALUES (?, ?, 'new_customer_25', 25, 0, ?)`
        ).bind(rewardCode, newUserId, Date.now()).run();

        return { rewardCode };
    } catch (err) {
        console.error('recordReferralIfAny failed:', err);
        return null;
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
                html: referralRewardEmailHtml(env, rewardCode),
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
        `SELECT code, reward_type, discount_percent, redeemed, created_at, redeemed_at
         FROM reward_codes WHERE user_id = ? ORDER BY created_at DESC`
    ).bind(user.id).all();

    return {
        referralCode: user.referral_code,
        referrals: referrals.results || [],
        rewards: rewards.results || [],
    };
}

// Called from create-checkout-basket.js (or wherever a reward code is
// actually applied to a price) once validateRewardCode above has already
// confirmed the code is valid and unredeemed. Returns the reward's type
// and, for percentage-off rewards, how much — so the checkout code can
// tell a 'free_card' reward (waives one card's price entirely, customer
// still pays postage) apart from a 'new_customer_25' reward (25% off one
// card's price) rather than assuming every reward means the same thing.
// Returns null for a missing/already-redeemed/mismatched-user code, same
// as validateRewardCode returning false.
export async function getRewardCodeDetails(code, user, env) {
    if (!code || !user) return null;
    try {
        const normalized = code.toString().trim().toUpperCase();
        const row = await env.DB.prepare(
            'SELECT reward_type, discount_percent, redeemed FROM reward_codes WHERE code = ? AND user_id = ?'
        ).bind(normalized, user.id).first();
        if (!row || row.redeemed) return null;
        return { rewardType: row.reward_type, discountPercent: row.discount_percent || null };
    } catch (err) {
        console.error('getRewardCodeDetails failed:', err);
        return null;
    }
}

// Shared look for every referral-related email — logo up top, a plain
// white card body, small print-brand footer. `bodyHtml` is whatever goes
// in the middle (the parts that differ between the "you earned a reward"
// email and the "you've been welcomed" email).
function brandedEmailShell(env, bodyHtml) {
    return `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1e1e24;">
            <div style="text-align: center; padding: 28px 0 20px;">
                <img src="https://images.cockneycards.com/logo.png" alt="Cockney Cards" style="max-width: 110px; height: auto;">
            </div>
            <div style="background: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 28px 26px;">
                ${bodyHtml}
            </div>
            <div style="text-align: center; padding: 20px 10px 0; font-size: 11px; color: #aaa;">
                Cockney Cards · ${env.SITE_URL ? env.SITE_URL.replace(/^https?:\/\//, '') : 'cockneycards.com'}
            </div>
        </div>
    `;
}

// The Club benefits blurb reused across referral emails — kept in one
// place so the pitch stays consistent with cockney-club.html and
// account.html's own Club copy (£9.99/year, 30% off every card, free
// delivery on 3+ to the same address).
function clubBenefitsBlockHtml() {
    return `
        <div style="margin-top: 22px; padding-top: 18px; border-top: 1px solid #f0f0f0;">
            <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; font-weight: 600; margin: 0 0 10px;">While you're here — Cockney Cards Club</p>
            <ul style="font-size: 13px; color: #555; line-height: 1.7; margin: 0; padding-left: 18px;">
                <li>30% off every card, all year round</li>
                <li>Free delivery on 3+ cards (or 2+ same-size prints) to one address</li>
                <li>Just £9.99/year</li>
            </ul>
        </div>
    `;
}

function referralRewardEmailHtml(env, rewardCode) {
    const shopUrl = `${env.SITE_URL || ''}/shop-cards.html`;
    return brandedEmailShell(env, `
        <h2 style="font-weight: 400; font-size: 20px; margin: 0 0 12px;">Nice one — your free card is waiting! 🎉</h2>
        <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 20px;">Someone you referred to Cockney Cards just placed their first order. As a thank you, here's a free card on us — you just cover delivery.</p>
        <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; text-align: center; margin: 0 0 20px;">
            <p style="margin: 0; font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">Your reward code</p>
            <p style="margin: 6px 0 0; font-size: 22px; font-weight: 700; letter-spacing: 1px;">${rewardCode}</p>
        </div>
        <p style="font-size: 13px; color: #555; margin: 0 0 20px;">Enter it at checkout on your next card order.</p>
        <div style="text-align: center;">
            <a href="${shopUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 12px 26px; text-decoration: none; border-radius: 4px; font-size: 13px; letter-spacing: 0.5px;">Shop Cards</a>
        </div>
        ${clubBenefitsBlockHtml()}
    `);
}

// Exported so account-api.js's handleVerify can build the "you've been
// welcomed with 25% off" email without duplicating the branding here.
export function newCustomerWelcomeEmailHtml(env, rewardCode) {
    const shopUrl = `${env.SITE_URL || ''}/shop-cards.html`;
    return brandedEmailShell(env, `
        <h2 style="font-weight: 400; font-size: 20px; margin: 0 0 12px;">Your friend has given you 25% off your 1st order! 🎉</h2>
        <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 20px;">Welcome to Cockney Cards — someone thought you'd love our cards, so here's a little something to say hello.</p>
        <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; text-align: center; margin: 0 0 20px;">
            <p style="margin: 0; font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">Your code</p>
            <p style="margin: 6px 0 0; font-size: 22px; font-weight: 700; letter-spacing: 1px;">${rewardCode}</p>
        </div>
        <p style="font-size: 13px; color: #555; margin: 0 0 20px;">Enter it at checkout — 25% off the price of one card, on us. One-time use.</p>
        <div style="text-align: center;">
            <a href="${shopUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 12px 26px; text-decoration: none; border-radius: 4px; font-size: 13px; letter-spacing: 0.5px;">Shop Cards</a>
        </div>
        ${clubBenefitsBlockHtml()}
    `);
}
