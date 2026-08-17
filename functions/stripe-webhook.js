// functions/stripe-webhook.js
//
// Cloudflare Pages Function — receives Stripe's `checkout.session.completed`
// webhook once a customer has actually paid, pulls the matching print-ready
// PDF(s) back out of R2 (stashed there by create-checkout.js /
// create-checkout-print.js / create-checkout-basket.js), and emails them to
// the business inbox via ZeptoMail. It also writes a row to D1 (the same
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
//                        create-checkout-print.js). The R2 object for
//                        order_id is the raw PDF data URI string.
//   'basket'          - multi-item checkout (create-checkout-basket.js).
//                        The R2 object for order_id is a JSON blob:
//                        { items: [{ index, kind, title, optionsSummary,
//                                    price, priceValue, quantity,
//                                    pdfDataUri }, ...] }
//
// Requires (Cloudflare env vars/secrets):
//   STRIPE_WEBHOOK_SECRET  - from the Stripe Dashboard webhook endpoint
//   ZEPTOMAIL_TOKEN        - ZeptoMail Send Mail Token (Mail Agent > SMTP/API)
//   FROM_EMAIL             - the verified sending address for that Agent
// Requires the same ORDER_PDFS R2 bucket binding as the three create-checkout* functions.
// Requires a DB (D1) binding pointing at the same cockney-cards-db used by
// the account/reminders Worker — add it under Settings > Bindings,
// variable name "DB".
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

        // Both 'card'/'print' and 'basket' orders now store a JSON blob in
        // R2 (create-checkout.js / create-checkout-print.js /
        // create-checkout-basket.js) — single-item orders as
        // { pdfDataUri, delivery, labelPdfDataUri }, basket orders as
        // { items: [...] }, each item carrying its own copy of those same
        // three fields. ORDER_PDFS is an R2 bucket, not a KV namespace —
        // .get() returns an R2ObjectBody (or null), not the stored value
        // directly the way KV's .get() does, so its contents need reading
        // out with .text() before they're usable.
        let pdfDataUri = null;
        let labelPdfDataUri = null;
        let delivery = { type: 'self' };
        let basketItems = null;
        if (orderId) {
            const object = await env.ORDER_PDFS.get(orderId);
            const raw = object ? await object.text() : null;
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (isBasket) {
                        basketItems = parsed.items || [];
                    } else {
                        pdfDataUri = parsed.pdfDataUri || null;
                        labelPdfDataUri = parsed.labelPdfDataUri || null;
                        delivery = parsed.delivery || { type: 'self' };
                    }
                } catch (err) {
                    console.error('Stripe webhook: could not parse order payload for order', orderId, err);
                }
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
                    delivery,
                    labelPdfDataUri,
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

// Shared by sendOrderEmail() and sendBasketOrderEmail() — both build the
// same subject/body/attachments shape, just from different order data.
// Uses ZeptoMail (env.ZEPTOMAIL_TOKEN, env.FROM_EMAIL) — NOT Resend. The
// account this webhook actually runs under (old-bush-4d25cockney-cards-api)
// has a ZEPTOMAIL_TOKEN secret and a FROM_EMAIL var configured, with no
// RESEND_API_KEY at all, so that's the real mail provider in use here.
//
// ZeptoMail's attachment `content` field wants base64 with no data URI
// prefix, same shape this code already builds. Docs:
// https://www.zoho.com/zeptomail/help/api/email-sending.html
async function sendViaZeptoMail(env, { subject, text, attachments }) {
    // This account is hosted on ZeptoMail's EU cluster (confirmed on the
    // Agent's own SMTP/API settings page: Host = api.zeptomail.eu) — a
    // token created there isn't recognised by the .com endpoint, which is
    // what was producing the clean "Invalid API Token" 401 rejection.
    const res = await fetch('https://api.zeptomail.eu/v1.1/email', {
        method: 'POST',
        headers: {
            // ZEPTOMAIL_TOKEN is stored WITH the "Zoho-enczapikey " prefix
            // already included (confirmed against the actual saved
            // secret), so it's used directly here rather than prefixing
            // it again — that double-prefixing was the original bug
            // (Authorization: "Zoho-enczapikey Zoho-enczapikey <token>"),
            // which ZeptoMail rejected with an empty-body error.
            Authorization: env.ZEPTOMAIL_TOKEN,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({
            from: { address: env.FROM_EMAIL, name: 'Cockney Cards Orders' },
            to: [{ email_address: { address: 'orders@cockneycards.com', name: 'Cockney Cards Orders' } }],
            subject,
            textbody: text,
            attachments: attachments.map((a) => ({
                content: a.content,
                mime_type: 'application/pdf',
                name: a.filename,
            })),
        }),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`ZeptoMail API error (${res.status} ${res.statusText}): ${errText || '(empty response body)'}`);
    }
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

    const wantsRecipient = order.delivery?.type === 'recipient' && order.delivery?.recipient;
    if (wantsRecipient && order.labelPdfDataUri) {
        const base64 = order.labelPdfDataUri.split(',')[1] || order.labelPdfDataUri;
        attachments.push({
            filename: `order-${order.productType}-address-label.pdf`,
            content: base64,
        });
    }

    const subjectBits =
        order.productType === 'print'
            ? `Print order (${order.size || 'size N/A'})`
            : `Card order (${order.name || 'N/A'})`;

    const r = wantsRecipient ? order.delivery.recipient : null;

    const lines = [
        `Product: ${order.productType}`,
        `Customer email: ${order.customerEmail}`,
        order.amountTotal != null ? `Amount paid: £${(order.amountTotal / 100).toFixed(2)}` : null,
        order.name && order.name !== 'N/A' ? `Name: ${order.name}` : null,
        order.age && order.age !== 'N/A' ? `Age: ${order.age}` : null,
        order.name2 && order.name2 !== 'N/A' ? `Name 2: ${order.name2}` : null,
        order.age2 && order.age2 !== 'N/A' ? `Age 2: ${order.age2}` : null,
        order.size ? `Size: ${order.size}` : null,
        !order.pdfDataUri ? '\n⚠️ No PDF was found in storage for this order — check R2/logs.' : null,
        '',
        wantsRecipient
            ? [
                'DELIVERY: send directly to the recipient (see attached address label)',
                `  ${r.name}`,
                r.address1 ? `  ${r.address1}` : null,
                r.address2 ? `  ${r.address2}` : null,
                [r.city, r.county].filter(Boolean).join(', ') ? `  ${[r.city, r.county].filter(Boolean).join(', ')}` : null,
                r.postcode ? `  ${r.postcode}` : null,
                r.country ? `  ${r.country}` : null,
                wantsRecipient && !order.labelPdfDataUri ? '  ⚠️ No address label PDF was found for this order.' : null,
            ].filter(Boolean).join('\n')
            : 'DELIVERY: to the customer themselves (they\'ll write in it)',
    ]
        .filter((line) => line !== null)
        .join('\n');

    await sendViaZeptoMail(env, {
        subject: `New order — ${subjectBits}`,
        text: lines,
        attachments,
    });
}

// Same idea as sendOrderEmail(), but for a basket of several items —
// every item gets its own PDF attachment (so whoever's fulfilling the
// order can print each one directly) and the email body lists every line
// with its options and quantity, rather than the single set of
// name/age/size fields the single-item version uses.
async function sendBasketOrderEmail(env, order) {
    const attachments = [];
    order.items.forEach((item) => {
        const safeTitle = (item.title || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        if (item.pdfDataUri) {
            attachments.push({
                filename: `order-item-${item.index + 1}-${item.kind}-${safeTitle}.pdf`,
                content: item.pdfDataUri.split(',')[1] || item.pdfDataUri,
            });
        }
        const wantsRecipient = item.delivery?.type === 'recipient' && item.delivery?.recipient;
        if (wantsRecipient && item.labelPdfDataUri) {
            attachments.push({
                filename: `order-item-${item.index + 1}-${item.kind}-${safeTitle}-address-label.pdf`,
                content: item.labelPdfDataUri.split(',')[1] || item.labelPdfDataUri,
            });
        }
    });

    const missingPdfCount = order.items.filter((item) => !item.pdfDataUri).length;

    const itemLines = order.items.map((item, i) => {
        const wantsRecipient = item.delivery?.type === 'recipient' && item.delivery?.recipient;
        const r = wantsRecipient ? item.delivery.recipient : null;
        const bits = [
            `${i + 1}. ${item.title || 'Personalised item'} (${item.kind})`,
            item.optionsSummary ? `   ${item.optionsSummary}` : null,
            `   Qty: ${item.quantity}${item.price ? ` · ${item.price} each` : ''}`,
            !item.pdfDataUri ? '   ⚠️ No PDF found in storage for this item.' : null,
            wantsRecipient
                ? [
                    '   Delivery: send directly to the recipient (see attached address label)',
                    `     ${r.name}`,
                    r.address1 ? `     ${r.address1}` : null,
                    r.address2 ? `     ${r.address2}` : null,
                    [r.city, r.county].filter(Boolean).join(', ') ? `     ${[r.city, r.county].filter(Boolean).join(', ')}` : null,
                    r.postcode ? `     ${r.postcode}` : null,
                    r.country ? `     ${r.country}` : null,
                    wantsRecipient && !item.labelPdfDataUri ? '     ⚠️ No address label PDF was found for this item.' : null,
                ].filter(Boolean).join('\n')
                : '   Delivery: to the customer themselves',
        ];
        return bits.filter(Boolean).join('\n');
    });

    const lines = [
        `Product: basket (${order.items.length} item${order.items.length === 1 ? '' : 's'})`,
        `Customer email: ${order.customerEmail}`,
        order.amountTotal != null ? `Amount paid: £${(order.amountTotal / 100).toFixed(2)}` : null,
        '',
        ...itemLines,
        missingPdfCount > 0 ? `\n⚠️ ${missingPdfCount} item(s) were missing their PDF — check R2/logs.` : null,
    ]
        .filter((line) => line !== null)
        .join('\n');

    await sendViaZeptoMail(env, {
        subject: `New order — Basket (${order.items.length} item${order.items.length === 1 ? '' : 's'})`,
        text: lines,
        attachments,
    });
}
