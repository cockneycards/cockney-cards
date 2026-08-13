// functions/create-checkout-print.js
//
// Cloudflare Pages Function — mirrors create-checkout.js for photo print
// orders from editor-prints.html. Creates a Stripe Checkout session and
// stashes the print-ready PDF in KV for stripe-webhook.js to email once
// payment succeeds.
//
// Requires the same STRIPE_SECRET_KEY env var and ORDER_PDFS KV binding
// as create-checkout.js (they can share both).

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const data = await request.json();

        const orderId = crypto.randomUUID();
        if (data.pdfDataUri) {
            await env.ORDER_PDFS.put(orderId, data.pdfDataUri, {
                expirationTtl: 60 * 60 * 24,
            });
        }

        const origin = new URL(request.url).origin;

        // priceValue is expected in pence (matches Stripe's unit_amount).
        // Falls back to a safe default if it's missing so checkout never
        // silently charges £0 — flagged clearly in the product name if so.
        const hasPrice = typeof data.priceValue === 'number' && data.priceValue > 0;
        const unitAmount = hasPrice ? Math.round(data.priceValue) : 999; // £9.99 fallback
        const sizeLabel = data.size || 'N/A';

        const params = new URLSearchParams();
        params.append('payment_method_types[]', 'card');
        params.append('mode', 'payment');
        params.append('success_url', `${origin}/?status=success`);
        params.append('cancel_url', `${origin}/?status=cancel`);
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
