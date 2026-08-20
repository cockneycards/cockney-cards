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
import { checkPlusMembership } from './account-api.js';
import { checkPromoCode } from './promo.js';

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

        const isClubMember = await checkPlusMembership(request, env);
        const isPromoValid = await checkPromoCode(data.promoCode, env);

        // Basket lines are grouped by destination — everything going to
        // the customer themselves counts as one parcel, and each distinct
        // recipient address counts as its own parcel, each getting its
        // own postage charge (see postage.js's groupItemsByDestination).
        // Club's discount is a flat 30% off cards regardless of quantity —
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
            const discountRate = isClubMember ? 0.30 : 0;

            groupItems.forEach((item) => {
                const hasPrice = typeof item.priceValue === 'number' && item.priceValue > 0;
                let unitAmount = hasPrice ? Math.round(item.priceValue * 100) : 999; // £9.99 fallback
                let name = hasPrice ? item.title : `${item.title} — PRICE CHECK NEEDED`;

                if (item.kind === 'card' && discountRate > 0 && hasPrice) {
                    unitAmount = Math.round(unitAmount * (1 - discountRate));
                    name = `${item.title} (${Math.round(discountRate * 100)}% Club discount)`;
                }

                const description = item.optionsSummary || (item.kind === 'print' ? 'Personalised photo print' : 'Personalised greeting card');

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
            // (free) in two independent cases, cards-only both times —
            // never waived if a print is anywhere in the group:
            //   1. 3+ cards are going to this same address. Applies to
            //      every customer, not just Club members — that's the
            //      whole point of it (it replaces the old 35% discount
            //      tier as the "buy several, save on delivery" perk).
            //   2. A valid promo code was entered. Unrelated to Club
            //      membership, unrelated to quantity.
            // Club membership itself does NOT waive postage — that's the
            // 30% card discount above instead.
            const tier = highestTier(groupItems);
            const allCardsInGroup = groupItems.every((item) => item.kind === 'card');
            const qualifiesForFreeDelivery = allCardsInGroup && cardUnitsInGroup >= 3;
            const postageWaived = qualifiesForFreeDelivery || (allCardsInGroup && isPromoValid);
            const postageAmount = postageWaived ? 0 : POSTAGE_TIERS[tier];
            const parcelLabel = groups.size > 1 ? ` (parcel ${parcelNumber} of ${groups.size})` : '';
            const postageName = postageWaived
                ? `${qualifiesForFreeDelivery ? 'Free Postage (3+ cards to this address)' : 'Free Postage (Promo Code)'}${parcelLabel}`
                : `Postage${parcelLabel}`;

            params.append(`line_items[${lineIndex}][price_data][currency]`, 'gbp');
            params.append(`line_items[${lineIndex}][price_data][product_data][name]`, postageName);
            params.append(`line_items[${lineIndex}][price_data][unit_amount]`, String(postageAmount));
            params.append(`line_items[${lineIndex}][quantity]`, '1');
            lineIndex++;
        }

        params.append('metadata[order_id]', orderId);
        params.append('metadata[product_type]', 'basket');
        params.append('metadata[item_count]', String(items.length));

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
