// functions/create-checkout-print.js
//
// Cloudflare Pages Function — mirrors create-checkout.js for photo print
// orders from editor-prints.html. Creates a Stripe Checkout session and
// stashes the print-ready PDF in R2 for stripe-webhook.js to email once
// payment succeeds.
//
// Requires the same STRIPE_SECRET_KEY env var and ORDER_PDFS R2 bucket
// binding as create-checkout.js (they can share both).

import { POSTAGE_TIERS } from './postage.js';

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const data = await request.json();

        const orderId = crypto.randomUUID();
        // ORDER_PDFS is an R2 bucket, not a KV namespace — no
        // expirationTtl option here (R2 doesn't support per-object TTL
        // like KV does). Use an R2 Lifecycle rule on the bucket itself if
        // abandoned checkouts' files need auto-cleanup.
        const wantsRecipient = data.delivery?.type === 'recipient' && data.delivery?.recipient;
        await env.ORDER_PDFS.put(orderId, JSON.stringify({
            pdfDataUri: data.pdfDataUri || null,
            delivery: wantsRecipient ? {
                type: 'recipient',
                recipient: {
                    name: (data.delivery.recipient.name || '').toString().slice(0, 200),
                    address1: (data.delivery.recipient.address1 || '').toString().slice(0, 200),
                    address2: (data.delivery.recipient.address2 || '').toString().slice(0, 200),
                    city: (data.delivery.recipient.city || '').toString().slice(0, 200),
                    county: (data.delivery.recipient.county || '').toString().slice(0, 200),
                    postcode: (data.delivery.recipient.postcode || '').toString().slice(0, 50),
                    country: (data.delivery.recipient.country || 'United Kingdom').toString().slice(0, 100),
                }
            } : { type: 'self' },
        }));

        const origin = new URL(request.url).origin;

        // priceValue arrives in POUNDS from the editor (e.g. 6.99 for a
        // £6.99 print — same convention prints-data.js's sizes.*.priceValue
        // uses, and the same one the shop/basket price displays are built
        // from), so convert to pence here for Stripe's unit_amount rather
        // than assuming the front end already did it. Falls back to a safe
        // default if it's missing so checkout never silently charges £0 —
        // flagged clearly in the product name if so.
        const hasPrice = typeof data.priceValue === 'number' && data.priceValue > 0;
        const unitAmount = hasPrice ? Math.round(data.priceValue * 100) : 999; // £9.99 fallback
        const sizeLabel = data.size || 'N/A';

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
        params.append('cancel_url', `${origin}/?status=cancel`);
        // Deliberately NOT passing customer_email here — Stripe locks
        // (greys out, uneditable) the email field on its Checkout page
        // whenever this is set, which was blocking customers from
        // correcting a mistyped or different email at checkout. Order
        // matching for "My Orders" still works fine without it — the
        // webhook reads session.customer_details.email (whatever the
        // customer actually confirms at checkout), not this prefill.
        params.append('line_items[0][price_data][currency]', 'gbp');
        params.append(
            'line_items[0][price_data][product_data][name]',
            `Photo Print (${sizeLabel})${hasPrice ? '' : ' — PRICE CHECK NEEDED'}`
        );
        params.append(
            'line_items[0][price_data][product_data][description]',
            'Personalised photo print, ready for framing'
        );
        params.append('line_items[0][price_data][unit_amount]', String(unitAmount));
        params.append('line_items[0][quantity]', '1');

        // Prints don't get the Cockney Cards Club free-postage waiver
        // (that's specifically for A5 cards, see postage.js/checkPlusMembership
        // usage in create-checkout-basket.js) — just the size-appropriate rate.
        params.append('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
        params.append('shipping_options[0][shipping_rate_data][fixed_amount][amount]', String(POSTAGE_TIERS[data.size] || POSTAGE_TIERS.A5));
        params.append('shipping_options[0][shipping_rate_data][fixed_amount][currency]', 'gbp');
        params.append('shipping_options[0][shipping_rate_data][display_name]', 'Postage');

        params.append('metadata[order_id]', orderId);
        params.append('metadata[product_type]', 'print');
        params.append('metadata[size]', sizeLabel);
        params.append('metadata[custom_name]', (data.name || 'N/A').slice(0, 480));
        params.append('metadata[custom_age]', String(data.age ?? 'N/A').slice(0, 480));
        params.append('metadata[custom_name2]', (data.name2 || 'N/A').slice(0, 480));
        params.append('metadata[custom_age2]', String(data.age2 ?? 'N/A').slice(0, 480));

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
        console.error('create-checkout-print error:', err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
