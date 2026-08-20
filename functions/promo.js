// functions/promo.js
//
// Validates the optional promo code entered at basket checkout. Unlike
// Club membership, this isn't tied to being logged in at all — any
// customer can enter a code, and if it matches an active row in the
// promo_codes table, cards in that order get free postage the same way
// a Club member's would (see create-checkout-basket.js).

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
