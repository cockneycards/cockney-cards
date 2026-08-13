// functions/stripe-webhook.js
//
// Cloudflare Pages Function — receives Stripe's `checkout.session.completed`
// webhook once a customer has actually paid, pulls the matching print-ready
// PDF back out of KV (stashed there by create-checkout.js /
// create-checkout-print.js), and emails it to the business inbox via Resend.
// It also writes a row to D1 (the same database account.html/orders.html
// use) so logged-in customers can see their own order history — Checkout
// Sessions here have no persistent Stripe Customer object to key off, so
// the customer's email is the link between a Stripe order and their account.
//
// This only fires on confirmed payment — nothing is emailed for abandoned
// or cancelled checkouts.
//
// Requires (Cloudflare Pages env vars):
//   STRIPE_WEBHOOK_SECRET  - from the Stripe Dashboard webhook endpoint
//   RESEND_API_KEY         - from resend.com
// Requires the same ORDER_PDFS KV binding as the two create-checkout* functions.
// Requires a DB (D1) binding pointing at the same cockney-cards-db used by
// the account/reminders Worker — add it under Pages > Settings > Functions
// > D1 database bindings, variable name "DB".
//
// Setup: in the Stripe Dashboard > Developers > Webhooks, add an endpoint
// pointing at https://cockneycards.com/stripe-webhook, subscribed to the
// `checkout.session.completed` event, then copy its signing secret into
// STRIPE_WEBHOOK_SECRET.

export async function onRequestPost(context) {
    const { request, env } = context;

    const signature = request.headers.get('stripe-signature');
    const rawBody = await request.text();

    const isValid = await verifyStripeSignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
    if (!isValid) {
        console.error('Stripe webhook: signature verification failed');
        return new Response('Invalid signature', { status: 400 });
    }

    let event;
    try {
        event = JSON.parse(rawBody);
    } catch (err) {
        return new Response('Invalid payload', { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const meta = session.metadata || {};
        const orderId = meta.order_id;
        const customerEmail = session.customer_details?.email || null;

        let pdfDataUri = null;
        if (orderId) {
            pdfDataUri = await env.ORDER_PDFS.get(orderId);
        }

        // Record the order in D1 first — this is what powers "My Orders",
        // and we want it saved even if the email send below fails.
        try {
            if (customerEmail) {
                await env.DB.prepare(
                    `INSERT OR IGNORE INTO orders
                        (id, email, product_type, custom_name, custom_age, custom_name2, custom_age2, size, amount_total, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                ).bind(
                    session.id,
                    customerEmail.toLowerCase(),
                    meta.product_type || null,
                    meta.custom_name || null,
                    meta.custom_age || null,
                    meta.custom_name2 || null,
                    meta.custom_age2 || null,
                    meta.size || null,
                    session.amount_total ?? null,
                    session.created ? session.created * 1000 : Date.now()
                ).run();
            } else {
                console.error('Stripe webhook: no customer email on session, order not recorded in D1', session.id);
            }
        } catch (err) {
            console.error('Failed to write order to D1:', err);
        }

        try {
            await sendOrderEmail(env, {
                productType: meta.product_type || 'unknown',
                customerEmail: customerEmail || 'N/A',
                amountTotal: session.amount_total,
                name: meta.custom_name,
                age: meta.custom_age,
                name2: meta.custom_name2,
                age2: meta.custom_age2,
                size: meta.size,
                pdfDataUri,
            });
        } catch (err) {
            // Log but still return 200 below — Stripe retries on non-2xx,
            // and repeated retries would just re-attempt the same failing
            // send. Check Cloudflare's function logs if orders go missing.
            console.error('Failed to send order email:', err);
        }

        if (orderId) {
            await env.ORDER_PDFS.delete(orderId);
        }
    }

    return new Response('OK', { status: 200 });
}

// Verifies the webhook actually came from Stripe by recomputing the HMAC
// signature ourselves (Stripe's official SDK does this same check under
// the hood — we do it manually here since the Node SDK isn't Workers-safe).
async function verifyStripeSignature(payload, sigHeader, secret) {
    if (!sigHeader || !secret) return false;

    const parts = Object.fromEntries(sigHeader.split(',').map((p) => p.split('=')));
    const timestamp = parts.t;
    const expectedSig = parts.v1;
    if (!timestamp || !expectedSig) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
    const computedSig = [...new Uint8Array(sigBuffer)]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    return computedSig === expectedSig;
}

async function sendOrderEmail(env, order) {
    const attachments = [];
    if (order.pdfDataUri) {
        const base64 = order.pdfDataUri.split(',')[1] || order.pdfDataUri;
        attachments.push({
            filename: `order-${order.productType}-print.pdf`,
            content: base64,
        });
    }

    const subjectBits =
        order.productType === 'print'
            ? `Print order (${order.size || 'size N/A'})`
            : `Card order (${order.name || 'N/A'})`;

    const lines = [
        `Product: ${order.productType}`,
        `Customer email: ${order.customerEmail}`,
        order.amountTotal != null ? `Amount paid: £${(order.amountTotal / 100).toFixed(2)}` : null,
        order.name && order.name !== 'N/A' ? `Name: ${order.name}` : null,
        order.age && order.age !== 'N/A' ? `Age: ${order.age}` : null,
        order.name2 && order.name2 !== 'N/A' ? `Name 2: ${order.name2}` : null,
        order.age2 && order.age2 !== 'N/A' ? `Age 2: ${order.age2}` : null,
        order.size ? `Size: ${order.size}` : null,
        !order.pdfDataUri ? '\n⚠️ No PDF was found in storage for this order — check KV/logs.' : null,
    ]
        .filter(Boolean)
        .join('\n');

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: 'Cockney Cards Orders <orders@cockneycards.com>',
            to: ['orders@cockneycards.com'],
            subject: `New order — ${subjectBits}`,
            text: lines,
            attachments,
        }),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Resend API error: ${errText}`);
    }
}
