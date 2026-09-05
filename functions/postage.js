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
    A5: 199, // cards (always this folded format) + A5 prints
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

// FREE DELIVERY PROMOS — checked per destination (see
// groupItemsByDestination), so these are "same address", not just
// "anywhere in the basket". Quantity counts, not just line-item counts —
// e.g. one print line with quantity 2 counts as 2 prints. Any ONE of
// these being true is enough to waive postage for that destination; they
// don't need to combine with each other.
function unitCount(items, kind) {
    return items
        .filter((item) => item.kind === kind)
        .reduce((sum, item) => sum + (item.quantity || 1), 0);
}

// 3 or more cards, and nothing but cards, going to the same address.
export function qualifiesForFreeCardDelivery(items) {
    return items.length > 0 && items.every((item) => item.kind === 'card') && unitCount(items, 'card') >= 3;
}

// 2 or more prints, all the SAME size, and nothing but prints, going to
// the same address.
export function qualifiesForFreePrintDelivery(items) {
    const prints = items.filter((item) => item.kind === 'print');
    if (!items.length || prints.length !== items.length) return false;
    const sizes = new Set(prints.map((item) => item.size || null));
    return sizes.size === 1 && !sizes.has(null) && unitCount(items, 'print') >= 2;
}

// 3 or more combined units of cards + A5 prints, mixed is fine (e.g. 2
// cards + 1 A5 print, or 1 card + 2 A5 prints) — as long as nothing
// bigger than A5 is in the same parcel. A5 prints fold down to the same
// envelope size as a card, so they travel together for free; A4/A3
// prints don't fit that envelope, so they're excluded from this promo
// (they can still qualify separately via qualifiesForFreePrintDelivery
// above if 2+ of the same larger size ship together with no cards).
export function qualifiesForFreeDelivery(items) {
    const a5PrintUnits = items
        .filter((item) => item.kind === 'print' && (item.size || null) === 'A5')
        .reduce((sum, item) => sum + (item.quantity || 1), 0);
    const hasNonA5Print = items.some((item) => item.kind === 'print' && (item.size || null) !== 'A5');
    if (hasNonA5Print) return false;
    return unitCount(items, 'card') + a5PrintUnits >= 3;
}

// 2 or more A4/A3 prints (either size, mixed is fine) plus at least one
// card, going to the same address. Companion to the A5 envelope rule
// above — A4/A3 prints need the bigger parcel regardless, but still earn
// free delivery as their own card + large-print bundle.
export function qualifiesForFreeLargePrintDelivery(items) {
    const largePrintUnits = items
        .filter((item) => item.kind === 'print' && (item.size === 'A4' || item.size === 'A3'))
        .reduce((sum, item) => sum + (item.quantity || 1), 0);
    return unitCount(items, 'card') >= 1 && largePrintUnits >= 2;
}

// Single entry point for what to actually charge a given destination's
// items: free if any of the promos above apply, or the customer is a
// Cockney Cards Club member (isClubMember) — any one reason is enough.
// Otherwise, the normal tier-based amount from POSTAGE_TIERS/highestTier.
export function postageForDestination(items, { isClubMember = false } = {}) {
    if (
        isClubMember ||
        qualifiesForFreeCardDelivery(items) ||
        qualifiesForFreePrintDelivery(items) ||
        qualifiesForFreeDelivery(items) ||
        qualifiesForFreeLargePrintDelivery(items)
    ) {
        return 0;
    }
    return POSTAGE_TIERS[highestTier(items)];
}

// Groups basket items by where they're actually going, for the basket
// checkout specifically (single-item checkouts trivially have one
// destination, so they don't need this). Every "self" item is treated as
// the same one destination — the customer's own address, collected once
// during Stripe Checkout itself (shipping_address_collection), which
// happens *after* this grouping runs, so there's no address value to key
// on yet — but that's fine, since a single order can only have one "my
// own address" regardless of what it turns out to be. "recipient" items
// are grouped by matching name+address1+postcode, so two cards genuinely
// going to the same person count as one parcel, not two.
export function groupItemsByDestination(items) {
    const groups = new Map();
    for (const item of items) {
        const key = destinationKey(item);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
    }
    return groups;
}

function destinationKey(item) {
    const wantsRecipient = item.delivery?.type === 'recipient' && item.delivery?.recipient;
    if (!wantsRecipient) return 'self';
    const r = item.delivery.recipient;
    return ['recipient', normalise(r.name), normalise(r.address1), normalise(r.postcode)].join('|');
}

function normalise(value) {
    return (value || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
}

// Builds the Stripe shipping_options[] params for a Checkout Session
// (payment mode only — Stripe doesn't support shipping_options in
// subscription mode). Used by the two single-item checkout functions only
// — the basket checkout charges postage as per-destination line items
// instead, since shipping_options only supports one selectable rate per
// session, not several simultaneous ones for multiple parcels.
export function appendShippingOption(params, amountPence, { free = false } = {}) {
    params.append('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
    params.append('shipping_options[0][shipping_rate_data][fixed_amount][amount]', String(free ? 0 : amountPence));
    params.append('shipping_options[0][shipping_rate_data][fixed_amount][currency]', 'gbp');
    params.append('shipping_options[0][shipping_rate_data][display_name]', free ? 'Free Postage (Cockney Cards Club)' : 'Postage');
}
