// functions/postage.js
//
// Shared postage-tier logic used by create-checkout.js, create-checkout-print.js,
// and create-checkout-basket.js — kept in one place so the pricing rules
// only need updating in one spot.
//
// Tiers are based on parcel size, not product type: a basket ships in one
// package sized for whatever's biggest inside it, so postage is the
// highest tier present across all items, not summed per item.

// Pence, matching Stripe's unit_amount convention.
export const POSTAGE_TIERS = {
    A5: 249, // cards (always this folded format) + A5 prints
    A4: 299,
    A3: 499,
};

const TIER_RANK = { A5: 0, A4: 1, A3: 2 };

// Cards are always the same folded A4-to-A5 format regardless of which
// card it is, so they're always the A5 tier. Prints carry their own
// selected size (A5/A4/A3) — falls back to A5 for anything unrecognised
// rather than under- or over-charging on a bad/missing value.
export function tierForItem(item) {
    if (item.kind === 'print' && item.size && POSTAGE_TIERS[item.size]) {
        return item.size;
    }
    return 'A5';
}

// Given a basket's items, returns the tier requiring the biggest/most
// expensive parcel.
export function highestTier(items) {
    let best = 'A5';
    for (const item of items) {
        const t = tierForItem(item);
        if (TIER_RANK[t] > TIER_RANK[best]) best = t;
    }
    return best;
}

// Builds the Stripe shipping_options[] params for a Checkout Session
// (payment mode only — Stripe doesn't support shipping_options in
// subscription mode). amountPence of 0 shows as "Free Postage" rather
// than being omitted, so Club members can see the waiver applied rather
// than wondering why there's no shipping line at all.
export function appendShippingOption(params, amountPence, { free = false } = {}) {
    params.append('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
    params.append('shipping_options[0][shipping_rate_data][fixed_amount][amount]', String(free ? 0 : amountPence));
    params.append('shipping_options[0][shipping_rate_data][fixed_amount][currency]', 'gbp');
    params.append('shipping_options[0][shipping_rate_data][display_name]', free ? 'Free Postage (Cockney Cards Club)' : 'Postage');
}
