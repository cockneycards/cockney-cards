// functions/stripe-webhook.js
//
// Cloudflare Pages Function — receives Stripe's `checkout.session.completed`
// webhook once a customer has actually paid, pulls the matching print-ready
// PDF(s) back out of KV (stashed there by create-checkout.js /
// create-checkout-print.js / create-checkout-basket.js), and emails them to
// the business inbox via Resend. It also writes a row to D1 (the same
// database account.html/orders.html use) so logged-in customers can see
// their own order history — Checkout Sessions here have no persistent
// Stripe Customer object to key off, so the customer's email is the link
// between a Stripe order and their account.
//
// This only fires on confirmed payment — nothing is emailed for abandoned
// or cancelled checkouts.
//
// Three shapes of order can arrive here, distinguished by
// metadata.product_type:
//   'card' / 'print'  - single-item checkout (create-checkout.js /
//                        create-checkout-print.js). The KV entry for
//                        order_id is the raw PDF data URI string.
//   'basket'          - multi-item checkout (create-checkout-basket.js).
//                        The KV entry for order_id is a JSON blob:
//                        { items: [{ index, kind, title, optionsSummary,
//                                    price, priceValue, quantity,
//                                    pdfDataUri }, ...] }
//
// Requires (Cloudflare Pages env vars):
//   STRIPE_WEBHOOK_SECRET  - from the Stripe Dashboard webhook endpoint
//   RESEND_API_KEY         - from resend.com
// Requires the same ORDER_PDFS KV binding as the three create-checkout* functions.
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
        const isBasket = meta.product_type === 'basket';

        // For 'card'/'print', this KV entry is the raw PDF data URI (as
        // before). For 'basket', it's a JSON blob holding every line
        // item's own PDF + details — see the comment above.
        let pdfDataUri = null;
        let basketItems = null;
        if (orderId) {
            const raw = await env.ORDER_PDFS.get(orderId);
            if (raw && isBasket) {
                try {
                    basketItems = JSON.parse(raw).items || [];
                } catch (err) {
                    console.error('Stripe webhook: could not parse basket payload for order', orderId, err);
                }
            } else {
                pdfDataUri = raw;
            }
        }

        // Record the order in D1 first — this is what powers "My Orders",
        // and we want it saved even if the email send below fails.
        try {
            if (customerEmail) {
                if (isBasket && basketItems) {
                    // One row per basket line, so a customer's order
                    // history reads the same whether they bought things
                    // one at a time or all together in a basket. The
                    // orders table doesn't have columns for an arbitrary
                    // options summary or a quantity, so — same as the
                    // email below — those get folded into custom_name /
                    // custom_age for now. Worth a small schema migration
                    // (e.g. `options_summary` and `quantity` columns) if
                    // basket orders become the norm rather than the
                    // exception.
                    for (const item of basketItems) {
                        await env.DB.prepare(
                            `INSERT OR IGNORE INTO orders
                                (id, email, product_type, custom_name, custom_age, custom_name2, custom_age2, size, amount_total, created_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                        ).bind(
                            `${session.id}-${item.index}`,
                            customerEmail.toLowerCase(),
                            item.kind || null,
                            item.title || null,
                            `${item.optionsSummary || ''}${item.quantity > 1 ? ` (Qty: ${item.quantity})` : ''}`.slice(0, 480) || null,
                            null,
                            null,
                            item.price || null,
                            item.priceValue != null ? Math.round(item.priceValue * 100) * item.quantity : null,
                            session.created ? session.created * 1000 : Date.now()
                        ).run();
                    }
                } else {
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
                }
            } else {
                console.error('Stripe webhook: no customer email on session, order not recorded in D1', session.id);
            }
        } catch (err) {
            console.error('Failed to write order to D1:', err);
        }

        try {
            if (isBasket && basketItems) {
                await sendBasketOrderEmail(env, {
                    customerEmail: customerEmail || 'N/A',
                    amountTotal: session.amount_total,
                    items: basketItems,
                });
            } else {
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
            }
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

// Same idea as sendOrderEmail(), but for a basket of several items —
// every item gets its own PDF attachment (so whoever's fulfilling the
// order can print each one directly) and the email body lists every line
// with its options and quantity, rather than the single set of
// name/age/size fields the single-item version uses.
async function sendBasketOrderEmail(env, order) {
    const attachments = order.items
        .filter((item) => item.pdfDataUri)
        .map((item) => {
            const base64 = item.pdfDataUri.split(',')[1] || item.pdfDataUri;
            const safeTitle = (item.title || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            return {
                filename: `order-item-${item.index + 1}-${item.kind}-${safeTitle}.pdf`,
                content: base64,
            };
        });

    const missingPdfCount = order.items.length - attachments.length;

    const itemLines = order.items.map((item, i) => {
        const bits = [
            `${i + 1}. ${item.title || 'Personalised item'} (${item.kind})`,
            item.optionsSummary ? `   ${item.optionsSummary}` : null,
            `   Qty: ${item.quantity}${item.price ? ` · ${item.price} each` : ''}`,
            !item.pdfDataUri ? '   ⚠️ No PDF found in storage for this item.' : null,
        ];
        return bits.filter(Boolean).join('\n');
    });

    const lines = [
        `Product: basket (${order.items.length} item${order.items.length === 1 ? '' : 's'})`,
        `Customer email: ${order.customerEmail}`,
        order.amountTotal != null ? `Amount paid: £${(order.amountTotal / 100).toFixed(2)}` : null,
        '',
        ...itemLines,
        missingPdfCount > 0 ? `\n⚠️ ${missingPdfCount} item(s) were missing their PDF — check KV/logs.` : null,
    ]
        .filter((line) => line !== null)
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
            subject: `New order — Basket (${order.items.length} item${order.items.length === 1 ? '' : 's'})`,
            text: lines,
            attachments,
        }),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Resend API error: ${errText}`);
    }
}
