// functions/create-checkout.js
//
// Cloudflare Pages Function — replaces the old Netlify create-checkout.js.
// Creates a Stripe Checkout session for a personalised card and stashes
// the print-ready PDF in KV (keyed by a fresh order id) so stripe-webhook.js
// can email it to the business inbox once payment actually succeeds.
//
// Requires (set in Cloudflare Pages > Settings > Environment variables):
//   STRIPE_SECRET_KEY   - your Stripe secret key (sk_live_... / sk_test_...)
// Requires (set in Cloudflare Pages > Settings > Functions > KV bindings):
//   ORDER_PDFS           - a KV namespace, variable name "ORDER_PDFS"

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const data = await request.json();

        // Stash the PDF in KV so the webhook can pick it up after payment.
        // 24h TTL is just a safety net for orphaned entries if a webhook
        // never fires (abandoned checkout, etc.) — it's deleted immediately
        // on the success path.
        const orderId = crypto.randomUUID();
        if (data.pdfDataUri) {
            await env.ORDER_PDFS.put(orderId, data.pdfDataUri, {
                expirationTtl: 60 * 60 * 24,
            });
        }

        const origin = new URL(request.url).origin;

        const params = new URLSearchParams();
        params.append('payment_method_types[]', 'card');
        params.append('mode', 'payment');
        params.append('success_url', `${origin}/?status=success`);
        params.append('cancel_url', `${origin}/?status=cancel`);
        params.append('line_items[0][price_data][currency]', 'gbp');
        params.append(
            'line_items[0][price_data][product_data][name]',
            `Customised Card (${data.name || 'Custom'})`
        );
        params.append(
            'line_items[0][price_data][product_data][description]',
            'A4 Personalised Greeting Card folded to A5'
        );
        params.append('line_items[0][price_data][unit_amount]', '349'); // £3.49
        params.append('line_items[0][quantity]', '1');

        // Metadata — kept under Stripe's 500-char-per-value limit. The PDF
        // itself lives in KV, referenced by order_id, not in metadata.
        params.append('metadata[order_id]', orderId);
        params.append('metadata[product_type]', 'card');
        params.append('metadata[custom_name]', (data.name || 'N/A').slice(0, 480));
        params.append('metadata[custom_age]', String(data.age ?? 'N/A').slice(0, 480));

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
        console.error('create-checkout error:', err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
