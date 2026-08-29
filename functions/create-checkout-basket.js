// functions/create-checkout-basket.js
//
// Cloudflare Pages Function — the multi-item counterpart to
// create-checkout.js / create-checkout-print.js, used by basket.html.
// A basket can mix cards and prints, each with its own quantity, so this
// builds one Stripe line item per basket line, and stashes ALL of their
// print-ready PDFs (plus the per-item details needed for the order email
// and D1 history) under a single KV entry, keyed by a fresh order id.
//
// Deliberately NOT reusing per-item Stripe metadata the way the two
// single-item functions do (metadata[custom_name] etc.) — Stripe caps
// each metadata value at 500 characters and a session at 50 keys total,
// which a multi-item basket (each item needing its own title/options/size)
// would blow through almost immediately. Storing one JSON blob in KV
// avoids that ceiling entirely, and stripe-webhook.js already reads from
// KV for the PDF, so it's a small extension to read the rest of the order
// details from there too.
//
// Requires the same STRIPE_SECRET_KEY env var and ORDER_PDFS R2 bucket
// binding as create-checkout.js / create-checkout-print.js (all three
// share it).

import { highestTier, POSTAGE_TIERS, groupItemsByDestination } from './postage.js';
import { checkPlusMembership, getUserFromAuth } from './account-api.js';
import { checkPromoCode } from './promo.js';
import { getRewardCodeDetails, getActiveWelcomeReward } from './referrals.js';

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const data = await request.json();
        const rawItems = Array.isArray(data.items) ? data.items : [];

        if (!rawItems.length) {
            return new Response(JSON.stringify({ error: 'Your basket is empty.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        if (rawItems.length > 50) {
            // Matches Stripe Checkout's own line-item ceiling — fail
            // clearly rather than letting the Stripe API call below reject
            // it with a less obvious error.
            return new Response(JSON.stringify({ error: 'Baskets are limited to 50 items — please split your order.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const orderId = crypto.randomUUID();

        // Basket priceValue is in POUNDS throughout (see editor.html /
        // editor-prints.html's addCurrentCardToBasket / addCurrentPrintToBasket)
        // — Stripe's unit_amount wants pence, converted per-item below.
        const items = rawItems.map((item, i) => {
            const quantity = Math.max(1, Math.min(20, Math.round(item.quantity) || 1));
            const hasPrice = typeof item.priceValue === 'number' && item.priceValue > 0;
            const wantsRecipient = item.delivery?.type === 'recipient' && item.delivery?.recipient;
            return {
                index: i,
                kind: item.kind === 'print' ? 'print' : 'card',
                templateId: item.templateId || null,
                variantId: item.variantId || null,
                title: (item.title || 'Personalised item').toString().slice(0, 250),
                optionsSummary: (item.optionsSummary || '').toString().slice(0, 500),
                price: item.price || null,
                priceValue: hasPrice ? item.priceValue : null,
                quantity,
                pdfDataUri: item.pdfDataUri || null,
                // Explicit size (A5/A4/A3), for prints only — used for
                // postage tier calculation below. Cards don't set this;
                // they're always treated as A5 (see postage.js).
                size: item.kind === 'print' && POSTAGE_TIERS[item.size] ? item.size : null,
                // Per-item delivery choice — "self" (customer writes in it
                // themselves) or "recipient" (goes straight to them; their
                // address is included in the order email text).
                delivery: wantsRecipient ? {
                    type: 'recipient',
                    recipient: {
                        name: (item.delivery.recipient.name || '').toString().slice(0, 200),
                        address1: (item.delivery.recipient.address1 || '').toString().slice(0, 200),
                        address2: (item.delivery.recipient.address2 || '').toString().slice(0, 200),
                        city: (item.delivery.recipient.city || '').toString().slice(0, 200),
                        county: (item.delivery.recipient.county || '').toString().slice(0, 200),
                        postcode: (item.delivery.recipient.postcode || '').toString().slice(0, 50),
                        country: (item.delivery.recipient.country || 'United Kingdom').toString().slice(0, 100),
                    }
                } : { type: 'self' },
            };
        });

        const missingPdf = items.some((item) => !item.pdfDataUri);
        if (missingPdf) {
            return new Response(JSON.stringify({ error: 'One or more basket items are missing their print file — try removing and re-adding them.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // ORDER_PDFS is an R2 bucket (confirmed via the dashboard's
        // Bindings tab), not a KV namespace — R2's put() doesn't take an
        // expirationTtl option the way KV's does. If abandoned baskets'
        // PDFs need auto-cleanup, add an R2 Lifecycle rule on the
        // order-pdfs-r2 bucket itself (R2 > order-pdfs-r2 > Settings >
        // Object lifecycle rules) rather than relying on this call.
        await env.ORDER_PDFS.put(orderId, JSON.stringify({ items }));

        const origin = new URL(request.url).origin;

        const params = new URLSearchParams();
        params.append('payment_method_types[]', 'card');
        params.append('mode', 'payment');
        // Collect the customer's own address regardless of any per-item
        // "send to recipient" choice — the order still needs to go
        // *somewhere* when the customer picks "send to me" (a gap this
        // didn't cover before), and it's harmless/useful to have even
        // when every item is going straight to a recipient instead.
        params.append('shipping_address_collection[allowed_countries][]', 'GB');
        params.append('success_url', `${origin}/thankyou.html?session_id={CHECKOUT_SESSION_ID}`);
        params.append('cancel_url', `${origin}/basket.html?status=cancel`);
        // Deliberately NOT passing customer_email here — Stripe locks
        // (greys out, uneditable) the email field on its Checkout page
        // whenever this is set, which was blocking customers from
        // correcting a mistyped or different email at checkout. Order
        // matching for "My Orders" still works fine without it — the
        // webhook reads session.customer_details.email (whatever the
        // customer actually confirms at checkout), not this prefill.

        const authedUser = await getUserFromAuth(request, env);
        const isClubMember = await checkPlusMembership(request, env);
        const isPromoValid = await checkPromoCode(data.promoCode, env);
        // Refer a Friend / welcome reward — either a single-use "free
        // card" code (earned when someone the logged-in user referred
        // completes their first order) or a single-use "15% off one
        // card" code (given to a brand-new customer who signed up via a
        // referral link) — see referrals.js. Requires being logged in as
        // the user the code was issued to; this only confirms it's valid
        // and unredeemed — it's actually marked redeemed by
        // stripe-webhook.js once payment succeeds, since a Checkout
        // Session can be abandoned without paying.
        const rewardCodeEntered = (data.rewardCode || '').toString().trim();
        let rewardCode = rewardCodeEntered;
        let rewardDetails = rewardCodeEntered ? await getRewardCodeDetails(rewardCodeEntered, authedUser, env) : null;

        // Auto-apply the 15%-off welcome reward for anyone who signed up
        // via a referral link — this is what actually makes it happen
        // without the customer needing to find/enter a code themselves.
        // A manually-entered code (e.g. a free_card reward) always takes
        // priority if one was supplied; this only fills in when nothing
        // was entered.
        if (!rewardDetails && authedUser) {
            const autoWelcome = await getActiveWelcomeReward(authedUser, env);
            if (autoWelcome) {
                rewardCode = autoWelcome.code;
                // NOTE: 'new_customer_25' is just this reward type's
                // internal identifier (kept as-is so existing/stored
                // reward codes still match) — the actual discount is
                // whatever discountPercent holds (now 15%, see
                // referrals.js), not literally 25% any more.
                rewardDetails = { rewardType: 'new_customer_25', discountPercent: autoWelcome.discountPercent };
            }
        }
        // A Club member's 25% is always better than the 15% welcome
        // reward, and the two shouldn't stack (15% off an already-25%-off
        // price) — so a new_customer_25 reward simply isn't applied for a
        // Club member; they keep getting 25% off, same as any other
        // member, and the reward code itself is left unredeemed (still
        // usable on a future order once/if membership lapses). free_card
        // isn't a percentage, so there's no stacking concern there — it
        // zeroes that one unit's price regardless of any other discount.
        const rewardIsUsable = !!(rewardDetails && (
            rewardDetails.rewardType === 'free_card' ||
            (rewardDetails.rewardType === 'new_customer_25' && rewardDetails.discountPercent && !isClubMember)
        ));
        let rewardApplied = false;

        // Basket lines are grouped by destination — everything going to
        // the customer themselves counts as one parcel, and each distinct
        // recipient address counts as its own parcel, each getting its
        // own postage charge (see postage.js's groupItemsByDestination).
        // Club's discount is a flat 25% off cards regardless of quantity —
        // the old 35% tier for 2+ cards to the same address was dropped in
        // favour of the free-delivery-on-3+-cards perk below, which now
        // does that job (and applies to every customer, not just members).
        const groups = groupItemsByDestination(items);
        let lineIndex = 0;
        let parcelNumber = 0;

        for (const groupItems of groups.values()) {
            parcelNumber++;
            const cardUnitsInGroup = groupItems
                .filter((item) => item.kind === 'card')
                .reduce((sum, item) => sum + item.quantity, 0);
            const printItemsInGroup = groupItems.filter((item) => item.kind === 'print');
            const printUnitsInGroup = printItemsInGroup.reduce((sum, item) => sum + item.quantity, 0);
            const printSizesInGroup = new Set(printItemsInGroup.map((item) => item.size));
            const discountRate = isClubMember ? 0.25 : 0;

            groupItems.forEach((item) => {
                const hasPrice = typeof item.priceValue === 'number' && item.priceValue > 0;
                let unitAmount = hasPrice ? Math.round(item.priceValue * 100) : 999; // £9.99 fallback
                let name = hasPrice ? item.title : `${item.title} — PRICE CHECK NEEDED`;

                if (item.kind === 'card' && discountRate > 0 && hasPrice) {
                    unitAmount = Math.round(unitAmount * (1 - discountRate));
                    name = `${item.title} (${Math.round(discountRate * 100)}% Club discount)`;
                }

                const description = item.optionsSummary || (item.kind === 'print' ? 'Personalised photo print' : 'Personalised greeting card');

                // Apply the reward to exactly ONE card unit, once per
                // checkout — not the whole line's quantity. If this line
                // has more than one card, it's split into a normally-
                // priced portion plus a single reward unit, so e.g. "3x
                // Birthday Card" with a free-card reward becomes "2x
                // Birthday Card" + "1x Birthday Card (Free)" rather than
                // all 3 being affected. A 15%-off welcome reward works the
                // same way, just discounting that one unit instead of
                // zeroing it.
                if (!rewardApplied && rewardIsUsable && item.kind === 'card' && hasPrice) {
                    rewardApplied = true;
                    if (item.quantity > 1) {
                        params.append(`line_items[${lineIndex}][price_data][currency]`, 'gbp');
                        params.append(`line_items[${lineIndex}][price_data][product_data][name]`, name);
                        params.append(`line_items[${lineIndex}][price_data][product_data][description]`, description);
                        params.append(`line_items[${lineIndex}][price_data][unit_amount]`, String(unitAmount));
                        params.append(`line_items[${lineIndex}][quantity]`, String(item.quantity - 1));
                        lineIndex++;
                    }

                    const isFreeCardReward = rewardDetails.rewardType === 'free_card';
                    const rewardUnitAmount = isFreeCardReward
                        ? 0
                        : Math.max(0, Math.round(unitAmount * (1 - rewardDetails.discountPercent / 100)));
                    const rewardName = isFreeCardReward
                        ? `${item.title} (Free — Refer a Friend reward)`
                        : `${item.title} (${rewardDetails.discountPercent}% off — Welcome reward)`;

                    params.append(`line_items[${lineIndex}][price_data][currency]`, 'gbp');
                    params.append(`line_items[${lineIndex}][price_data][product_data][name]`, rewardName);
                    params.append(`line_items[${lineIndex}][price_data][product_data][description]`, description);
                    params.append(`line_items[${lineIndex}][price_data][unit_amount]`, String(rewardUnitAmount));
                    params.append(`line_items[${lineIndex}][quantity]`, '1');
                    lineIndex++;
                    return;
                }

                params.append(`line_items[${lineIndex}][price_data][currency]`, 'gbp');
                params.append(`line_items[${lineIndex}][price_data][product_data][name]`, name);
                params.append(`line_items[${lineIndex}][price_data][product_data][description]`, description);
                params.append(`line_items[${lineIndex}][price_data][unit_amount]`, String(unitAmount));
                params.append(`line_items[${lineIndex}][quantity]`, String(item.quantity));
                lineIndex++;
            });

            // Postage for this parcel — a group ships in one package
            // sized for its biggest item, so this is the highest tier
            // present within the group, not summed per item. Waived
            // (free) in three independent cases — never waived if a
            // group mixes cards and prints together, since each case
            // below requires the group to be one kind or the other:
            //   1. 3+ cards are going to this same address. Applies to
            //      every customer, not just Club members — that's the
            //      whole point of it (it replaces the old 35% discount
            //      tier as the "buy several, save on delivery" perk).
            //   2. 2+ prints of the SAME size are going to this same
            //      address — e.g. two A4 prints qualifies, but one A4 +
            //      one A3 doesn't (different parcel/postage tiers), and
            //      neither does a single print of any size. Also applies
            //      to every customer, mirroring the cards rule above.
            //   3. A valid promo code was entered (cards-only, as before).
            // Club membership itself does NOT waive postage — that's the
            // 25% card discount above instead.
            const tier = highestTier(groupItems);
            const allCardsInGroup = groupItems.every((item) => item.kind === 'card');
            const allPrintsInGroup = groupItems.length > 0 && groupItems.every((item) => item.kind === 'print');
            const qualifiesForFreeCardDelivery = allCardsInGroup && cardUnitsInGroup >= 3;
            const qualifiesForFreePrintDelivery = allPrintsInGroup && printSizesInGroup.size === 1 && !printSizesInGroup.has(null) && printUnitsInGroup >= 2;
            const postageWaived = qualifiesForFreeCardDelivery || qualifiesForFreePrintDelivery || (allCardsInGroup && isPromoValid);
            const postageAmount = postageWaived ? 0 : POSTAGE_TIERS[tier];
            const parcelLabel = groups.size > 1 ? ` (parcel ${parcelNumber} of ${groups.size})` : '';
            let postageName;
            if (qualifiesForFreeCardDelivery) {
                postageName = `Free Postage (3+ cards to this address)${parcelLabel}`;
            } else if (qualifiesForFreePrintDelivery) {
                postageName = `Free Postage (2+ same-size prints to this address)${parcelLabel}`;
            } else if (postageWaived) {
                postageName = `Free Postage (Promo Code)${parcelLabel}`;
            } else {
                postageName = `Postage${parcelLabel}`;
            }

            params.append(`line_items[${lineIndex}][price_data][currency]`, 'gbp');
            params.append(`line_items[${lineIndex}][price_data][product_data][name]`, postageName);
            params.append(`line_items[${lineIndex}][price_data][unit_amount]`, String(postageAmount));
            params.append(`line_items[${lineIndex}][quantity]`, '1');
            lineIndex++;
        }

        params.append('metadata[order_id]', orderId);
        params.append('metadata[product_type]', 'basket');
        params.append('metadata[item_count]', String(items.length));
        if (rewardApplied) {
            params.append('metadata[reward_code]', rewardCode.toUpperCase());
        }

        const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
        });

        const session = await stripeRes.json();

        if (!stripeRes.ok) {
            console.error('Stripe session error:', session);
            // Don't leave an orphaned KV entry sitting around for a
            // checkout that never actually got created.
            await env.ORDER_PDFS.delete(orderId);
            return new Response(
                JSON.stringify({ error: session.error?.message || 'Stripe session creation failed' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        return new Response(JSON.stringify({ url: session.url }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('create-checkout-basket error:', err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
