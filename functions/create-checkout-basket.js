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
        params.append('success_url', `${origin}/?status=success`);
        params.append('cancel_url', `${origin}/basket.html?status=cancel`);
        // Pre-fills Stripe's checkout email field when the customer is
        // logged into their Cockney Cards account — see create-checkout.js
        // for why this matters (matches orders to accounts by email).
        if (data.customerEmail) {
            params.append('customer_email', data.customerEmail);
        }

        items.forEach((item, i) => {
            const unitAmount = item.priceValue ? Math.round(item.priceValue * 100) : 999; // £9.99 fallback
            const name = item.priceValue ? item.title : `${item.title} — PRICE CHECK NEEDED`;
            const description = item.optionsSummary || (item.kind === 'print' ? 'Personalised photo print' : 'Personalised greeting card');

            params.append(`line_items[${i}][price_data][currency]`, 'gbp');
            params.append(`line_items[${i}][price_data][product_data][name]`, name);
            params.append(`line_items[${i}][price_data][product_data][description]`, description);
            params.append(`line_items[${i}][price_data][unit_amount]`, String(unitAmount));
            params.append(`line_items[${i}][quantity]`, String(item.quantity));
        });

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
