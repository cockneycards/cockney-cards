// functions/promo.js
//
// Validates the optional promo code entered at basket checkout. Most
// codes aren't tied to being logged in at all — any customer can enter
// one, and if it matches an active row in the promo_codes table, cards
// in that order get free postage (Club membership doesn't grant this —
// its benefit is the 25% cards+prints discount instead; see
// create-payment-intent-basket.js).
//
// A promo_codes row can be marked requires_login for a future
// account-linked postage-waiver code — see requiresLogin below and its
// check in handleValidatePromo.
//
// FAMILY_MEMBERSHIP_PROMO_CODE (FAMILY13) is a SEPARATE, hardcoded
// special case, not a promo_codes row at all — see
// create-payment-intent-basket.js, which checks it directly against the
// raw code string and waives the £9.99 membership charge (never postage
// or card prices) for an existing account only. It's exported from here
// purely so this file and create-payment-intent-basket.js share the same
// constant instead of two copies drifting apart.

import { getUserFromAuth } from './account-api.js';

export const FAMILY_MEMBERSHIP_PROMO_CODE = 'FAMILY13';

// A promo_codes row can also be restricted to one specific delivery
// address (required_address1/required_postcode, both nullable) — e.g.
// 40LFREE only applies to orders shipping to 40 Leadenhall Street. When
// both are NULL the code has no address restriction and behaves exactly
// as before. This is checked PER PARCEL (see promoAppliesToAddress and
// its call site in create-payment-intent-basket.js), not once for the
// whole order — a multi-destination basket only gets the discount on the
// parcel(s) actually going to that address.

// Returns the promo's details ({ requiredAddress1, requiredPostcode,
// requiresLogin }) if `code` matches an ACTIVE row, or null if it's
// missing/inactive/unknown. requiredAddress1/requiredPostcode are null on
// a code with no address restriction; requiresLogin is false unless the
// row itself has requires_login set. This never covers
// FAMILY_MEMBERSHIP_PROMO_CODE (see above) — that's checked separately in
// handleValidatePromo, not looked up here.
export async function getPromoDetails(code, env) {
    if (!code) return null;
    const normalized = code.toString().trim().toUpperCase();
    if (!normalized) return null;

    try {
        const row = await env.DB.prepare(
            'SELECT active, required_address1, required_postcode, requires_login FROM promo_codes WHERE code = ?'
        ).bind(normalized).first();
        if (!row || !row.active) return null;
        return {
            requiredAddress1: row.required_address1 || null,
            requiredPostcode: row.required_postcode || null,
            requiresLogin: !!row.requires_login,
        };
    } catch (err) {
        // A broken lookup should never block checkout — just means the
        // discount doesn't apply, same as an invalid/missing code.
        console.error('getPromoDetails failed, treating as invalid:', err);
        return null;
    }
}

// True if the code has no address restriction, or if `address` (the
// delivery address for ONE parcel — address1 + postcode) matches the one
// it's restricted to. Case/whitespace/punctuation-tolerant on the address
// line; case/spacing-insensitive on the postcode.
export function promoAppliesToAddress(promo, address) {
    if (!promo) return false;
    if (!promo.requiredAddress1 && !promo.requiredPostcode) return true;
    if (!address) return false;
    const address1Matches = !promo.requiredAddress1 || normalizeAddressLine(address.address1) === normalizeAddressLine(promo.requiredAddress1);
    const postcodeMatches = !promo.requiredPostcode || normalizePostcode(address.postcode) === normalizePostcode(promo.requiredPostcode);
    return address1Matches && postcodeMatches;
}

function normalizeAddressLine(value) {
    return (value || '')
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizePostcode(value) {
    return (value || '').toString().toUpperCase().replace(/\s+/g, '');
}

// Simple "is this code active at all" check, with no address involved —
// kept for any caller that only needs that (none currently; getPromoDetails
// plus promoAppliesToAddress is what real checkout uses now).
export async function checkPromoCode(code, env) {
    return !!(await getPromoDetails(code, env));
}

// Lets basket.html's "Apply" button check a code up front and show
// Invalid/Accepted feedback, rather than the customer only finding out
// whether it worked once they're already on Stripe's checkout page.
// checkout still re-validates independently at that point regardless —
// this is purely for earlier feedback, not a security boundary. Also
// returns requiredAddress1/requiredPostcode (safe to expose — a business
// address, not sensitive) so the basket can show an accurate message and
// preview the right postage line for an address-restricted code.
export async function handleValidatePromo(request, env) {
    try {
        const { code } = await request.json();
        const normalized = (code || '').toString().trim().toUpperCase();

        // Family13 doesn't live in promo_codes (see the comment up top),
        // so it needs its own check here rather than going through
        // getPromoDetails — otherwise it would just look like an unknown
        // code and every guest AND every logged-in customer would see
        // "Invalid Code" here, even though checkout (which re-derives
        // this independently) would honour it for a signed-in customer.
        if (normalized === FAMILY_MEMBERSHIP_PROMO_CODE) {
            const user = await getUserFromAuth(request, env);
            if (!user) {
                return new Response(JSON.stringify({
                    valid: false,
                    requiresLogin: true,
                    requiredAddress1: null,
                    requiredPostcode: null,
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            return new Response(JSON.stringify({
                valid: true,
                requiredAddress1: null,
                requiredPostcode: null,
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const promo = await getPromoDetails(normalized, env);

        // A requires_login promo_codes row needs an actual verified
        // session, not just a client-side "I'm logged in" claim — same
        // trust boundary as checkPlusMembership above. A guest gets
        // requiresLogin back instead of valid/invalid either way, so the
        // basket can prompt them to sign in rather than saying the code
        // itself is wrong.
        if (promo?.requiresLogin) {
            const user = await getUserFromAuth(request, env);
            if (!user) {
                return new Response(JSON.stringify({
                    valid: false,
                    requiresLogin: true,
                    requiredAddress1: null,
                    requiredPostcode: null,
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        }

        return new Response(JSON.stringify({
            valid: !!promo,
            requiredAddress1: promo?.requiredAddress1 || null,
            requiredPostcode: promo?.requiredPostcode || null,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        return new Response(JSON.stringify({ valid: false, requiredAddress1: null, requiredPostcode: null }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
