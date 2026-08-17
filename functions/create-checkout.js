// functions/create-checkout.js
//
// Cloudflare Pages Function — replaces the old Netlify create-checkout.js.
// Creates a Stripe Checkout session for a personalised card and stashes
// the print-ready PDF in R2 (keyed by a fresh order id) so stripe-webhook.js
// can email it to the business inbox once payment actually succeeds.
//
// Requires (set in Cloudflare Pages > Settings > Environment variables):
//   STRIPE_SECRET_KEY   - your Stripe secret key (sk_live_... / sk_test_...)
// Requires (set in Cloudflare Pages > Settings > Functions > R2 bindings):
//   ORDER_PDFS           - an R2 bucket, variable name "ORDER_PDFS"

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const data = await request.json();

        // Stash the PDF (+ delivery choice, if any) in R2 so the webhook
        // can pick it up after payment. ORDER_PDFS is an R2 bucket, not a
        // KV namespace — no expirationTtl option here (R2 doesn't support
        // per-object TTL the way KV does; passing it silently does
        // nothing, it isn't a recognised R2PutOptions field). Use an R2
        // Lifecycle rule on the bucket itself if abandoned checkouts'
        // files need auto-cleanup.
        const orderId = crypto.randomUUID();
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

        const params = new URLSearchParams();
        params.append('payment_method_types[]', 'card');
        params.append('mode', 'payment');
        params.append('success_url', `${origin}/thankyou.html?session_id={CHECKOUT_SESSION_ID}`);
        params.append('cancel_url', `${origin}/?status=cancel`);
        // Pre-fills Stripe's checkout email field when the customer is
        // logged into their Cockney Cards account — makes it far more
        // likely the order lands under the same email as their account,
        // since that's how "My Orders" matches things up (see
        // stripe-webhook.js). Guest checkout still works fine without it.
        if (data.customerEmail) {
            params.append('customer_email', data.customerEmail);
        }
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
