// functions/promo.js
//
// Validates the optional promo code entered at basket checkout. Unlike
// Club membership, this isn't tied to being logged in at all — any
// customer can enter a code, and if it matches an active row in the
// promo_codes table, cards in that order get free postage (Club
// membership doesn't grant this — its benefit is the 30%/35% card
// discount instead; see create-checkout-basket.js).

export async function checkPromoCode(code, env) {
    if (!code) return false;
    const normalized = code.toString().trim().toUpperCase();
    if (!normalized) return false;

    try {
        const row = await env.DB.prepare(
            'SELECT active FROM promo_codes WHERE code = ?'
        ).bind(normalized).first();
        return !!(row && row.active);
    } catch (err) {
        // A broken lookup should never block checkout — just means the
        // discount doesn't apply, same as an invalid/missing code.
        console.error('checkPromoCode failed, treating as invalid:', err);
        return false;
    }
}

// Lets basket.html's "Apply" button check a code up front and show
// Invalid/Accepted feedback, rather than the customer only finding out
// whether it worked once they're already on Stripe's checkout page.
// checkout still re-validates independently at that point regardless —
// this is purely for earlier feedback, not a security boundary.
export async function handleValidatePromo(request, env) {
    try {
        const { code } = await request.json();
        const valid = await checkPromoCode(code, env);
        return new Response(JSON.stringify({ valid }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        return new Response(JSON.stringify({ valid: false }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
