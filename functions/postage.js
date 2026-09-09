// functions/postage.js
//
// Shared postage-tier logic used by create-checkout.js, create-checkout-print.js,
// and create-checkout-basket.js — kept in one place so the pricing rules
// only need updating in one spot.
//
// Tiers are based on parcel size, not product type: a basket ships in one
// package sized for whatever's biggest inside it, so postage is the
// highest tier present across all items, not summed per item.
//
// Each size also offers one or more Royal Mail SERVICES (First Class /
// Tracked24 / Tracked24 with signature) — see POSTAGE_RATES below. A3
// parcels don't fit a First Class envelope, so only the two Tracked24
// services are offered for that size.

// Pence, matching Stripe's unit_amount convention.
export const POSTAGE_METHODS = {
    FIRST_CLASS: 'first_class',
    TRACKED24: 'tracked24',
    TRACKED24_SIGNED: 'tracked24_signed',
};

const METHOD_LABELS = {
    first_class: 'Royal Mail 1st Class',
    tracked24: 'Royal Mail Tracked 24 (photo)',
    tracked24_signed: 'Royal Mail Tracked 24 (photo & signature)',
};

// Royal Mail's own charge for Tracked24 is £3.80 (A5/A4) / £4.65 (A3) and
// £5.80 (A5/A4 signed) / £5.80 (A3 signed) — we round these up to £3.99 /
// £4.99 / £5.99 / £6.99 when charging customers. A3 goes as a small
// parcel rather than a letter, so it has no First Class option.
export const POSTAGE_RATES = {
    A5: { first_class: 199, tracked24: 399, tracked24_signed: 599 },
    A4: { first_class: 349, tracked24: 399, tracked24_signed: 599 },
    A3: { tracked24: 499, tracked24_signed: 699 }, // sent as a small parcel, no first_class
};

// Legacy flat-tier map, kept for any code still importing POSTAGE_TIERS
// directly. Uses each size's First Class rate where one exists, and A3's
// Tracked24 rate (its cheapest available service) otherwise.
export const POSTAGE_TIERS = {
    A5: POSTAGE_RATES.A5.first_class,
    A4: POSTAGE_RATES.A4.first_class,
    A3: POSTAGE_RATES.A3.tracked24,
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

// Services available for a given parcel size, in a fixed display order.
export function methodsForSize(size) {
    const rates = POSTAGE_RATES[size] || POSTAGE_RATES.A5;
    return Object.keys(METHOD_LABELS).filter((m) => rates[m] !== undefined);
}

// Services that can be offered for a whole destination's items: the
// intersection across every parcel size present. Mixing an A3 print in
// with cards, for instance, drops First Class off the list, since the A3
// can't travel that way — the customer only sees services every item in
// the parcel can actually use.
export function methodsForDestination(items) {
    const sizes = new Set(items.map(tierForItem));
    let methods = null;
    for (const size of sizes) {
        const available = new Set(methodsForSize(size));
        methods = methods ? new Set([...methods].filter((m) => available.has(m))) : available;
    }
    return Object.keys(METHOD_LABELS).filter((m) => methods && methods.has(m));
}

// Amount for a destination's items under a given service, charged by the
// biggest parcel present (same "biggest parcel wins" rule as before).
export function postageAmountForMethod(items, method) {
    const size = highestTier(items);
    const rates = POSTAGE_RATES[size] || POSTAGE_RATES.A5;
    return rates[method] ?? rates.tracked24 ?? Object.values(rates)[0];
}

// Reverse lookup: given a parcel size and the amount actually charged
// (pence), returns which service that was. Used by the webhook to work
// out which service a customer picked on Stripe's own Checkout page for
// a single-item order — Stripe reports the shipping amount, not our
// method key. Amounts are unique per service within a size, so this is
// unambiguous PROVIDED the amount is non-zero — the two single-item
// checkouts (create-checkout.js / create-checkout-print.js) never offer
// free shipping, so that's safe there. Don't use this for basket orders:
// their postage is a flat per-destination line item computed server-side
// before Stripe is involved, with no per-service Stripe amount to read
// back — basket.html needs to send the chosen method explicitly instead
// (see appendShippingOptions' basket note).
export function methodFromAmount(size, amountPence) {
    const rates = POSTAGE_RATES[size] || POSTAGE_RATES.A5;
    for (const [method, amount] of Object.entries(rates)) {
        if (amount === amountPence) return method;
    }
    return null;
}

// FREE DELIVERY PROMOS — checked per destination (see
// groupItemsByDestination), so these are "same address", not just
// "anywhere in the basket". Quantity counts, not just line-item counts —
// e.g. one print line with quantity 2 counts as 2 prints. Any ONE of
// these being true is enough to waive postage for that destination; they
// don't need to combine with each other. Which SERVICES each one waives
// differs though — see freeMethodsForItems below, right after they're
// all defined.
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

// Which shipping SERVICES a given promo waives — not every promo waives
// every service:
//   - 3+ cards (qualifiesForFreeCardDelivery) and the 3+ cards/A5-prints
//     mix (qualifiesForFreeDelivery, e.g. 2 cards + 1 A5 print) are
//     First Class only. Tracked24 and Tracked24 (signed) are never free
//     under these two — a customer who upgrades to tracked shipping
//     pays the normal rate for it even though their order qualifies.
//   - 2+ same-size prints (qualifiesForFreePrintDelivery) waives First
//     Class AND Tracked24 (photo), but NOT Tracked24 (signed) — the
//     signature add-on always costs on this promo.
//   - 2+ large prints + a card (qualifiesForFreeLargePrintDelivery) and
//     Cockney Cards Club membership are unchanged from before: every
//     service on offer for the destination is free.
function freeMethodsForItems(items, { isClubMember = false } = {}) {
    const free = new Set();

    if (isClubMember || qualifiesForFreeLargePrintDelivery(items)) {
        methodsForDestination(items).forEach((m) => free.add(m));
        return free;
    }

    if (qualifiesForFreeCardDelivery(items) || qualifiesForFreeDelivery(items)) {
        free.add(POSTAGE_METHODS.FIRST_CLASS);
    }

    if (qualifiesForFreePrintDelivery(items)) {
        free.add(POSTAGE_METHODS.FIRST_CLASS);
        free.add(POSTAGE_METHODS.TRACKED24);
    }

    return free;
}

// Whether a destination's postage is free FOR THE GIVEN SERVICE — unlike
// before, this can now depend on which service they'd pick, since not
// every promo waives every service (see freeMethodsForItems above). With
// no method passed, checks the cheapest service offered for these items
// (methodsForDestination(items)[0]), which matches the old "is this
// destination free at all" use — First Class is the cheapest wherever
// it's offered, and it's the one service every qualifying promo waives.
export function isFreeDelivery(items, { isClubMember = false, method } = {}) {
    const free = freeMethodsForItems(items, { isClubMember });
    if (!free.size) return false;
    const chosenMethod = method || methodsForDestination(items)[0];
    return free.has(chosenMethod);
}

// Single entry point for what to actually charge a given destination's
// items under the given (or default) service: free if that specific
// service is waived by an applicable promo, or the customer is a
// Cockney Cards Club member, otherwise the rate for that service/size.
// Defaults to the cheapest available service (First Class where
// offered, otherwise Tracked24) when no method is passed — useful for
// anywhere that still just wants "the" postage amount rather than a
// customer-selectable list. Note this can now return a non-zero amount
// even when the destination qualifies for a promo, if the chosen
// service isn't one that promo waives (e.g. Tracked24 signed on a 3+
// cards order) — see freeMethodsForItems.
export function postageForDestination(items, { isClubMember = false, method } = {}) {
    const chosenMethod = method || methodsForDestination(items)[0];
    if (isFreeDelivery(items, { isClubMember, method: chosenMethod })) return 0;
    return postageAmountForMethod(items, chosenMethod);
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
// subscription mode) for a SINGLE fixed rate. Kept for any existing call
// sites that just want one rate charged with no customer choice of
// service. Used by the two single-item checkout functions only — the
// basket checkout charges postage as per-destination line items instead,
// since shipping_options only supports one selectable rate per session
// per call to this function (see appendShippingOptions below for
// offering several services at once).
export function appendShippingOption(params, amountPence, { free = false } = {}) {
    params.append('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
    params.append('shipping_options[0][shipping_rate_data][fixed_amount][amount]', String(free ? 0 : amountPence));
    params.append('shipping_options[0][shipping_rate_data][fixed_amount][currency]', 'gbp');
    params.append('shipping_options[0][shipping_rate_data][display_name]', free ? 'Free Postage (Cockney Cards Club)' : 'Postage');
}

// Builds Stripe shipping_options[] params offering EVERY service valid
// for this destination's items (First Class / Tracked24 / Tracked24
// signed, whichever apply — see methodsForDestination), so the customer
// picks their preferred service in Stripe Checkout itself. Stripe
// supports multiple selectable shipping_options per session, indexed
// 0, 1, 2… — that's what this does.
//
// Freeness is now decided PER SERVICE via freeMethodsForItems, not as an
// all-or-nothing flag: a 3+ cards order shows free First Class alongside
// paid Tracked24/Tracked24 signed upgrades; a 2+ same-size prints order
// shows free First Class and free Tracked24, with only Tracked24 signed
// still paid; Cockney Cards Club members and the large-print+card bundle
// still get every service free. Pass `isClubMember` (not a precomputed
// `free` bool — this replaces that old param) so this can work out the
// right set itself.
export function appendShippingOptions(params, items, { isClubMember = false } = {}) {
    const methods = methodsForDestination(items);
    const list = methods.length ? methods : [POSTAGE_METHODS.TRACKED24];
    const freeMethods = freeMethodsForItems(items, { isClubMember });
    list.forEach((method, index) => {
        const isFree = freeMethods.has(method);
        const amount = isFree ? 0 : postageAmountForMethod(items, method);
        const label = isFree
            ? `${METHOD_LABELS[method]} (Free)`
            : METHOD_LABELS[method];
        params.append(`shipping_options[${index}][shipping_rate_data][type]`, 'fixed_amount');
        params.append(`shipping_options[${index}][shipping_rate_data][fixed_amount][amount]`, String(amount));
        params.append(`shipping_options[${index}][shipping_rate_data][fixed_amount][currency]`, 'gbp');
        params.append(`shipping_options[${index}][shipping_rate_data][display_name]`, label);
    });
}
