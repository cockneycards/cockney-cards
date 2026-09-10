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
// variable name "DB". Needs a `tracking_number TEXT` column on `orders`
// (see migrations/add-tracking-number.sql) for the Royal Mail integration
// below.
//
// Royal Mail Click & Drop integration (see royal-mail.js) — only runs for
// orders shipped as Tracked24 / Tracked24 (signed); First Class orders
// stay fully manual. Requires ROYAL_MAIL_API_KEY and the ROYAL_MAIL_SENDER_*
// vars described in royal-mail.js. If those aren't set yet, shipment
// creation just fails silently (logged, not thrown) and orders carry on
// exactly as they did before this integration existed.
//
// Setup: in the Stripe Dashboard > Developers > Webhooks, add an endpoint
// pointing at https://cockneycards.com/stripe-webhook, subscribed to the
// `checkout.session.completed` event, then copy its signing secret into
// STRIPE_WEBHOOK_SECRET.
//
// Also requires SITE_URL (same value as account-api.js's) — used to build
// the "Shop Cards" link and My Account link in customer-facing emails
// below.

import { checkAndQualifyReferral } from './referrals.js';
import { createShipment } from './royal-mail.js';
import { methodFromAmount, POSTAGE_METHODS, groupItemsByDestination, highestTier } from './postage.js';
import { activateOneOffMembership } from './account-api.js';

const TRACKED_METHODS = new Set([POSTAGE_METHODS.TRACKED24, POSTAGE_METHODS.TRACKED24_SIGNED]);

// Creates a Royal Mail shipment for a tracked order and returns
// { trackingNumber, labelBase64 }, or null if the method isn't a tracked
// one, there's no usable address, or the Royal Mail API call itself
// fails. A Royal Mail outage should never block the order email/D1 write
// that already happen regardless — every failure here is caught and
// logged, never thrown further, same pattern as the email/referral calls
// elsewhere in this file.
async function maybeCreateRoyalMailShipment(env, { size, method, orderReference, address }) {
    if (!TRACKED_METHODS.has(method) || !address) return null;
    try {
        return await createShipment(env, { recipient: address, size, method, orderReference });
    } catch (err) {
        console.error('Royal Mail shipment creation failed for order', orderReference, err);
        return null;
    }
}

// Turns whichever address shape is actually available (a per-item
// recipient, a saved selfAddress, or Stripe's own collected
// shipping_details) into the plain {name,address1,address2,city,county,
// postcode,country} shape royal-mail.js needs — same priority order
// already used by formatSelfAddress/formatCustomerShippingAddress below
// for the human-readable fulfilment email. Returns null if nothing
// usable was collected (e.g. the customer closed Stripe's address step).
function resolveShipToAddress({ wantsRecipient, recipient, selfAddress, shippingDetails }) {
    if (wantsRecipient && recipient) return recipient;
    if (selfAddress) return selfAddress;
    if (shippingDetails?.address) {
        const a = shippingDetails.address;
        return {
            name: shippingDetails.name,
            address1: a.line1,
            address2: a.line2,
            city: a.city,
            county: a.state,
            postcode: a.postal_code,
            country: a.country,
        };
    }
    return null;
}

// One shipment per destination group in a basket order — each group
// already carries its resolved shippingMethod (see
// create-checkout-basket.js's resolveGroupMethod), stamped onto every
// item in it. Returns a Map of item index -> { trackingNumber,
// labelBase64 } so callers can look up a given item's result (or skip it
// if its group wasn't tracked / the call failed).
async function createBasketShipments(env, { orderId, basketItems, selfAddress, shippingDetails }) {
    const tracking = new Map();
    const groups = groupItemsByDestination(basketItems);
    for (const groupItems of groups.values()) {
        const method = groupItems[0]?.shippingMethod;
        if (!TRACKED_METHODS.has(method)) continue;
        const first = groupItems[0];
        const wantsRecipient = first.delivery?.type === 'recipient' && first.delivery?.recipient;
        const address = resolveShipToAddress({
            wantsRecipient,
            recipient: wantsRecipient ? first.delivery.recipient : null,
            selfAddress,
            shippingDetails,
        });
        const size = highestTier(groupItems);
        const result = await maybeCreateRoyalMailShipment(env, {
            size,
            method,
            orderReference: `${orderId}-${first.index}`,
            address,
        });
        if (result) groupItems.forEach((item) => tracking.set(item.index, result));
    }
    return tracking;
}

// Single-item (card/print) equivalent — the customer picked their
// service on Stripe's own Checkout page, so the method has to be
// reverse-derived from the shipping amount actually charged (Stripe
// reports the cost, not which shipping_options entry was clicked).
async function createSingleShipment(env, { orderId, size, delivery, selfAddress, shippingDetails, shippingAmount }) {
    const wantsRecipient = delivery?.type === 'recipient' && delivery?.recipient;
    const method = shippingAmount != null ? methodFromAmount(size, shippingAmount) : null;
    const address = resolveShipToAddress({
        wantsRecipient,
        recipient: wantsRecipient ? delivery.recipient : null,
        selfAddress,
        shippingDetails,
    });
    return maybeCreateRoyalMailShipment(env, { size, method, orderReference: orderId, address });
}

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

        // Membership signups (Cockney Cards Club) are a completely
        // different shape of order — no PDF, no delivery address, no
        // per-item anything — so they're handled entirely separately from
        // the product-purchase flow below.
        if (meta.product_type === 'membership') {
            try {
                await activatePlusMembership(env, session);
            } catch (err) {
                console.error('Failed to activate Club membership:', err);
            }
            return new Response('OK', { status: 200 });
        }

        const orderId = meta.order_id;
        const customerEmail = session.customer_details?.email || null;
        const isBasket = meta.product_type === 'basket';
        // Collected once per checkout (not per item) via
        // shipping_address_collection on the session. Stripe moved this
        // field from session.shipping_details to
        // session.collected_information.shipping_details in its 2025-03-31
        // API version ("basil") — check both so this keeps working
        // whichever API version this account is pinned to.
        const shippingDetails = session.collected_information?.shipping_details || session.shipping_details || null;

        // Both 'card'/'print' and 'basket' orders now store a JSON blob in
        // R2 (create-checkout.js / create-checkout-print.js /
        // create-checkout-basket.js) — single-item orders as
        // { pdfDataUri, delivery }, basket orders as { items: [...] },
        // each item carrying its own copy of those same two fields.
        // ORDER_PDFS is an R2 bucket, not a KV namespace — .get() returns
        // an R2ObjectBody (or null), not the stored value directly the
        // way KV's .get() does, so its contents need reading out with
        // .text() before they're usable.
        let pdfDataUri = null;
        let delivery = { type: 'self' };
        let basketItems = null;
        // The address the customer picked from their saved addresses on
        // basket.html, if any (see create-checkout-basket.js) — preferred
        // below over Stripe's own shipping_details, which is only ever
        // collected as a fallback now for guests/no saved address.
        let selfAddress = null;
        if (orderId) {
            const object = await env.ORDER_PDFS.get(orderId);
            const raw = object ? await object.text() : null;
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (isBasket) {
                        basketItems = parsed.items || [];
                        selfAddress = parsed.selfAddress || null;
                    } else {
                        pdfDataUri = parsed.pdfDataUri || null;
                        delivery = parsed.delivery || { type: 'self' };
                        selfAddress = parsed.selfAddress || null;
                    }
                } catch (err) {
                    console.error('Stripe webhook: could not parse order payload for order', orderId, err);
                }
            }
        }

        // Royal Mail shipment(s) — only for orders shipping under a
        // tracked service (First Class stays fully manual — see
        // royal-mail.js). Done before the D1 write below so the tracking
        // number can go straight into the same INSERT rather than a
        // separate UPDATE afterwards.
        let trackingNumber = null;
        let labelBase64 = null;
        let basketTracking = new Map();
        if (isBasket && basketItems) {
            basketTracking = await createBasketShipments(env, { orderId: orderId || session.id, basketItems, selfAddress, shippingDetails });
        } else if (orderId) {
            const singleSize = meta.product_type === 'print' ? (meta.size || 'A5') : 'A5';
            const result = await createSingleShipment(env, {
                orderId,
                size: singleSize,
                delivery,
                selfAddress,
                shippingDetails,
                shippingAmount: session.shipping_cost?.amount_total,
            });
            if (result) {
                trackingNumber = result.trackingNumber;
                labelBase64 = result.labelBase64;
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
                                (id, email, product_type, custom_name, custom_age, custom_name2, custom_age2, size, amount_total, tracking_number, created_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
                            basketTracking.get(item.index)?.trackingNumber || null,
                            session.created ? session.created * 1000 : Date.now()
                        ).run();
                    }
                } else {
                    await env.DB.prepare(
                        `INSERT OR IGNORE INTO orders
                            (id, email, product_type, custom_name, custom_age, custom_name2, custom_age2, size, amount_total, tracking_number, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
                        trackingNumber,
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
                    shippingDetails,
                    selfAddress,
                    tracking: basketTracking,
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
                    shippingDetails,
                    selfAddress,
                    trackingNumber,
                    labelBase64,
                });
            }
        } catch (err) {
            // Log but still return 200 below — Stripe retries on non-2xx,
            // and repeated retries would just re-attempt the same failing
            // send. Check Cloudflare's function logs if orders go missing.
            console.error('Failed to send order email:', err);
        }

        // Customer-facing confirmation — separate from the business
        // notification above (which goes to orders@cockneycards.com and is
        // built for fulfilment, not for the customer to read). Without
        // this, a customer who's just paid gets no email at all until
        // whatever confirmation Stripe Checkout itself shows on-screen,
        // which is why orders were feeling "did that actually work?".
        try {
            await sendCustomerOrderConfirmationEmail(env, {
                customerEmail,
                isBasket: !!(isBasket && basketItems),
                order: isBasket && basketItems
                    ? {
                        items: basketItems,
                        amountTotal: session.amount_total,
                        trackingNumbers: [...new Set([...basketTracking.values()].map((t) => t.trackingNumber).filter(Boolean))],
                    }
                    : {
                        productType: meta.product_type || 'unknown',
                        name: meta.custom_name,
                        age: meta.custom_age,
                        name2: meta.custom_name2,
                        age2: meta.custom_age2,
                        size: meta.size,
                        amountTotal: session.amount_total,
                        trackingNumbers: trackingNumber ? [trackingNumber] : [],
                    },
            });
        } catch (err) {
            console.error('Failed to send customer confirmation email:', err);
        }

        // Referral qualification — was never actually wired up before, so
        // referrers were never getting their free-card reward no matter
        // how many referred friends completed an order. Checks whether
        // this buyer's email matches someone's pending referral and, if
        // so, issues + emails the referrer their reward. Safe to call for
        // every order (including non-referred ones) — it's a no-op when
        // there's no matching pending referral, and never throws.
        await checkAndQualifyReferral(env, customerEmail, sendCustomerEmail);

        if (orderId) {
            await env.ORDER_PDFS.delete(orderId);
        }
    }

    // Basket orders from the new custom checkout page (checkout.html +
    // create-payment-intent-basket.js) land here instead of
    // checkout.session.completed — a PaymentIntent, not a Checkout
    // Session, since there's no Stripe-hosted page involved any more
    // (see create-payment-intent-basket.js's comment for why). Mirrors
    // the isBasket branch above: same R2 lookup, D1 recording, fulfilment
    // email, and customer confirmation — just reading order data off the
    // PaymentIntent instead of session.metadata/customer_details.
    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        const meta = paymentIntent.metadata || {};
        const orderId = meta.order_id;

        if (!orderId) {
            console.error('Stripe webhook: payment_intent.succeeded with no order_id in metadata', paymentIntent.id);
            return new Response('OK', { status: 200 });
        }

        // create-payment-intent-basket.js stores everything a Checkout
        // Session's own fields (customer_details.email, line items) used
        // to provide directly here instead, since a PaymentIntent doesn't
        // carry any of that itself.
        let basketItems = [];
        let selfAddress = null;
        let customerEmail = null;
        let amountTotal = paymentIntent.amount;
        let membershipUserId = null;
        let membershipFree = false;
        const object = await env.ORDER_PDFS.get(orderId);
        const raw = object ? await object.text() : null;
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                basketItems = parsed.items || [];
                selfAddress = parsed.selfAddress || null;
                customerEmail = parsed.customerEmail || null;
                amountTotal = parsed.amountTotal ?? paymentIntent.amount;
                membershipUserId = parsed.membershipUserId || null;
                membershipFree = !!parsed.membershipFree;
            } catch (err) {
                console.error('Stripe webhook: could not parse order payload for order', orderId, err);
            }
        } else {
            console.error('Stripe webhook: no R2 order payload found for order', orderId);
        }

        // Cockney Cards Club membership added via basket.html's Join Now
        // banner (see create-payment-intent-basket.js) — a one-time
        // charge, not a real Stripe Subscription, so this is the only
        // place it gets activated (no customer.subscription.updated
        // event will ever fire for it). Sets the same
        // plus_current_period_end shape a real subscription would, so
        // checkPlusMembership()'s existing expiry check in
        // account-api.js is what turns it back off a year from now.
        if (membershipUserId) {
            try {
                await activateOneOffMembership(env, membershipUserId);
            } catch (err) {
                console.error('Failed to activate one-off Club membership for order', orderId, err);
            }
        }

        // Club membership isn't a physical, PDF-bearing basketItems entry
        // (it never goes through the missingPdf/postage pipeline in
        // create-payment-intent-basket.js) — folded in here as one extra
        // synthetic line, purely so "My Orders" and the fulfilment/
        // confirmation emails show it the same way any other purchase
        // shows up, instead of a basket order silently vanishing when
        // membership is the only thing bought. Priced off membershipFree
        // (set above from the R2 payload) rather than assumed — a
        // Family13 order paid nothing for this line even though a card
        // in the same basket paid Stripe as normal.
        const orderItems = membershipUserId
            ? [...basketItems, {
                index: basketItems.length,
                kind: 'membership',
                title: 'Cockney Cards Club — Annual Membership',
                optionsSummary: membershipFree
                    ? 'Membership valid for 1 year from today (Free — Family13 promo)'
                    : 'Membership valid for 1 year from today',
                price: membershipFree ? 'Free' : '£9.99',
                priceValue: membershipFree ? 0 : 9.99,
                quantity: 1,
                pdfDataUri: null,
                delivery: { type: 'self' },
            }]
            : basketItems;

        const basketTracking = await createBasketShipments(env, { orderId, basketItems, selfAddress, shippingDetails: null });

        try {
            if (customerEmail && orderItems.length) {
                for (const item of orderItems) {
                    await env.DB.prepare(
                        `INSERT OR IGNORE INTO orders
                            (id, email, product_type, custom_name, custom_age, custom_name2, custom_age2, size, amount_total, tracking_number, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                    ).bind(
                        `${orderId}-${item.index}`,
                        customerEmail.toLowerCase(),
                        item.kind || null,
                        item.title || null,
                        `${item.optionsSummary || ''}${item.quantity > 1 ? ` (Qty: ${item.quantity})` : ''}`.slice(0, 480) || null,
                        null,
                        null,
                        item.price || null,
                        item.priceValue != null ? Math.round(item.priceValue * 100) * item.quantity : null,
                        basketTracking.get(item.index)?.trackingNumber || null,
                        paymentIntent.created ? paymentIntent.created * 1000 : Date.now()
                    ).run();
                }
            } else {
                console.error('Stripe webhook: missing email or items, order not recorded in D1', orderId);
            }
        } catch (err) {
            console.error('Failed to write order to D1:', err);
        }

        try {
            await sendBasketOrderEmail(env, {
                customerEmail: customerEmail || 'N/A',
                amountTotal,
                items: orderItems,
                shippingDetails: null,
                selfAddress,
                tracking: basketTracking,
            });
        } catch (err) {
            console.error('Failed to send order email:', err);
        }

        try {
            await sendCustomerOrderConfirmationEmail(env, {
                customerEmail,
                isBasket: true,
                order: {
                    items: orderItems,
                    amountTotal,
                    trackingNumbers: [...new Set([...basketTracking.values()].map((t) => t.trackingNumber).filter(Boolean))],
                },
            });
        } catch (err) {
            console.error('Failed to send customer confirmation email:', err);
        }

        await checkAndQualifyReferral(env, customerEmail, sendCustomerEmail);

        await env.ORDER_PDFS.delete(orderId);

        return new Response('OK', { status: 200 });
    }

    // Subscription lifecycle — keeps a Club member's status in sync with
    // what Stripe actually has on file (renewed, past due, cancelled,
    // etc.), independent of the initial checkout.session.completed above.
    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
        try {
            await syncPlusMembershipStatus(env, event.data.object);
        } catch (err) {
            console.error('Failed to sync Club membership status:', err);
        }
    }

    return new Response('OK', { status: 200 });
}

// First-time activation, right after a membership Checkout Session
// completes. Looks up the user by metadata.user_id (falling back to
// client_reference_id) rather than trusting anything from the client.
async function activatePlusMembership(env, session) {
    const userId = session.metadata?.user_id || session.client_reference_id;
    if (!userId) {
        console.error('Membership checkout completed with no user_id to attach it to:', session.id);
        return;
    }

    // Checkout in subscription mode always creates/attaches a real Stripe
    // Customer and Subscription — both ids are on the session itself.
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

    // plus_cancel_at_period_end reset to 0 here too — a brand-new
    // subscription is never scheduled to cancel, and this covers someone
    // re-joining after a previous membership lapsed (their old row could
    // otherwise still have last time's cancellation flag left set).
    await env.DB.prepare(
        `UPDATE users SET plus_active = 1, stripe_customer_id = ?, plus_subscription_id = ?, plus_cancel_at_period_end = 0 WHERE id = ?`
    ).bind(customerId || null, subscriptionId || null, userId).run();
}

// Called on customer.subscription.updated/deleted — keeps plus_active,
// plus_current_period_end, and plus_cancel_at_period_end all matching
// whatever Stripe actually has on file. This is the authoritative sync:
// account-api.js's handleCancelMembership/handleResumeMembership also
// write plus_cancel_at_period_end directly for an instant account-page
// update, but this webhook is what corrects it if those two ever
// disagree with Stripe (e.g. a subscription cancelled directly from the
// Stripe Dashboard rather than through the site).
// 'active' and 'trialing' are the only statuses that count as a live
// membership; everything else (canceled, unpaid, past_due, incomplete_expired,
// etc.) means postage should go back to being charged.
async function syncPlusMembershipStatus(env, subscription) {
    const isActive = subscription.status === 'active' || subscription.status === 'trialing';
    const periodEndMs = subscription.current_period_end ? subscription.current_period_end * 1000 : null;

    await env.DB.prepare(
        `UPDATE users SET plus_active = ?, plus_current_period_end = ?, plus_cancel_at_period_end = ? WHERE plus_subscription_id = ?`
    ).bind(isActive ? 1 : 0, periodEndMs, subscription.cancel_at_period_end ? 1 : 0, subscription.id).run();
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

// Same ZeptoMail account as sendViaZeptoMail above, but for emails TO the
// customer rather than the fixed orders@cockneycards.com fulfilment inbox
// — an HTML body instead of a plain-text one, and no attachments (a
// customer doesn't need the print-ready PDF). Used for the order
// confirmation below, and passed into checkAndQualifyReferral so it can
// email a qualifying referrer their reward without this file needing a
// second copy of the referral email's branding.
async function sendCustomerEmail(env, { to, subject, html }) {
    if (!to || to === 'N/A') return false;
    const res = await fetch('https://api.zeptomail.eu/v1.1/email', {
        method: 'POST',
        headers: {
            Authorization: env.ZEPTOMAIL_TOKEN,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({
            from: { address: env.FROM_EMAIL, name: 'Cockney Cards' },
            to: [{ email_address: { address: to, name: to } }],
            subject,
            htmlbody: html,
        }),
    });
    if (!res.ok) {
        const errText = await res.text();
        console.error('ZeptoMail customer email failed:', res.status, errText);
    }
    return res.ok;
}

// Builds a per-item summary customers can actually read — basket orders
// list every line with its options/quantity, single-item orders become a
// one-item list of the same shape, so the email template below doesn't
// need to know which kind of order it's rendering.
function buildCustomerItemsSummary(isBasket, order) {
    if (isBasket) {
        return (order.items || []).map((item) => ({
            title: item.title || 'Personalised item',
            details: item.optionsSummary || '',
            quantity: item.quantity || 1,
        }));
    }
    const details = [order.name, order.age, order.name2, order.age2, order.size]
        .filter((v) => v && v !== 'N/A')
        .join(' · ');
    return [{
        title: order.productType === 'print' ? `Print${order.size ? ` (${order.size})` : ''}` : 'Personalised Card',
        details,
        quantity: 1,
    }];
}

// The confirmation a customer never used to get at all — this is what
// fixes the "did my order actually go through?" problem, sent right
// after payment is confirmed, independent of the internal fulfilment
// email above.
export async function sendCustomerOrderConfirmationEmail(env, { customerEmail, isBasket, order }) {
    if (!customerEmail || customerEmail === 'N/A') return;

    const items = buildCustomerItemsSummary(isBasket, order);
    const itemsHtml = items.map((i) => `
        <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0;">
                <strong style="font-size: 14px;">${i.title}</strong>
                ${i.details ? `<br><span style="color: #888; font-size: 12px;">${i.details}</span>` : ''}
                ${i.quantity > 1 ? `<br><span style="color: #888; font-size: 12px;">Qty: ${i.quantity}</span>` : ''}
            </td>
        </tr>
    `).join('');

    const amount = order.amountTotal != null ? `£${(order.amountTotal / 100).toFixed(2)}` : '';
    const siteUrl = env.SITE_URL || '';
    const trackingNumbers = order.trackingNumbers || [];
    const trackingHtml = trackingNumbers.length
        ? `<p style="font-size: 14px; margin: 14px 0 0;"><strong>Tracking number${trackingNumbers.length > 1 ? 's' : ''}:</strong> ${trackingNumbers.join(', ')}</p>`
        : '';

    const html = `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1e1e24;">
            <div style="text-align: center; padding: 28px 0 20px;">
                <img src="https://images.cockneycards.com/logo.png" alt="Cockney Cards" style="max-width: 110px; height: auto;">
            </div>
            <div style="background: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 28px 26px;">
                <h2 style="font-weight: 400; font-size: 20px; margin: 0 0 8px;">Thanks for your order! 🎉</h2>
                <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 20px;">We've got it and we're already getting your card${items.length > 1 ? 's' : ''} ready.</p>
                <table style="width: 100%; border-collapse: collapse;">${itemsHtml}</table>
                ${amount ? `<p style="font-size: 14px; margin: 18px 0 0;"><strong>Total paid:</strong> ${amount}</p>` : ''}
                ${trackingHtml}
                <p style="color: #888; font-size: 12px; margin: 22px 0 0;">You can track this order any time in <a href="${siteUrl}/account.html" style="color: #1a73e8;">My Account</a>.</p>
            </div>
            <div style="text-align: center; padding: 20px 10px 0; font-size: 11px; color: #aaa;">
                Cockney Cards · ${siteUrl.replace(/^https?:\/\//, '') || 'cockneycards.com'}
            </div>
        </div>
    `;

    await sendCustomerEmail(env, {
        to: customerEmail,
        subject: 'Your Cockney Cards order is confirmed!',
        html,
    });
}

// Same idea as formatCustomerShippingAddress below, but for a saved
// address the customer picked on basket.html (see create-checkout-basket.js) —
// this is checked FIRST wherever a "self" delivery address is needed, since
// it's a confirmed address rather than whatever Stripe's own shipping step
// (subject to Link autofill) happened to collect.
function formatSelfAddress(selfAddress) {
    if (!selfAddress) return null;
    const lines = [
        selfAddress.name,
        selfAddress.address1,
        selfAddress.address2,
        [selfAddress.city, selfAddress.county].filter(Boolean).join(', '),
        selfAddress.postcode,
        selfAddress.country,
    ].filter(Boolean);
    return lines.length ? lines : null;
}

// Formats Stripe's shipping_details shape ({ name, address: { line1, line2,
// city, state, postal_code, country } }) into the same plain-text block
// style used for recipient addresses elsewhere in this file. Returns null
// if nothing was actually collected (e.g. the customer closed the address
// step, or this order predates shipping_address_collection being added).
function formatCustomerShippingAddress(shippingDetails) {
    if (!shippingDetails?.address) return null;
    const a = shippingDetails.address;
    const lines = [
        shippingDetails.name,
        a.line1,
        a.line2,
        [a.city, a.state].filter(Boolean).join(', '),
        a.postal_code,
        a.country,
    ].filter(Boolean);
    return lines.length ? lines : null;
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
    if (order.labelBase64) {
        attachments.push({
            filename: `postage-label-${order.productType}.pdf`,
            content: order.labelBase64,
        });
    }

    const wantsRecipient = order.delivery?.type === 'recipient' && order.delivery?.recipient;

    const subjectBits =
        order.productType === 'print'
            ? `Print order (${order.size || 'size N/A'})`
            : `Card order (${order.name || 'N/A'})`;

    const r = wantsRecipient ? order.delivery.recipient : null;
    const customerAddressLines = !wantsRecipient ? (formatSelfAddress(order.selfAddress) || formatCustomerShippingAddress(order.shippingDetails)) : null;

    const lines = [
        `Product: ${order.productType}`,
        `Customer email: ${order.customerEmail}`,
        order.amountTotal != null ? `Amount paid: £${(order.amountTotal / 100).toFixed(2)}` : null,
        order.name && order.name !== 'N/A' ? `Name: ${order.name}` : null,
        order.age && order.age !== 'N/A' ? `Age: ${order.age}` : null,
        order.name2 && order.name2 !== 'N/A' ? `Name 2: ${order.name2}` : null,
        order.age2 && order.age2 !== 'N/A' ? `Age 2: ${order.age2}` : null,
        order.size ? `Size: ${order.size}` : null,
        order.trackingNumber ? `Royal Mail tracking number: ${order.trackingNumber}${order.labelBase64 ? ' (label attached)' : ' — ⚠️ label not returned, check Click & Drop dashboard'}` : null,
        !order.pdfDataUri ? '\n⚠️ No PDF was found in storage for this order — check R2/logs.' : null,
        '',
        wantsRecipient
            ? [
                order.delivery.envelopeMode === 'home'
                    ? 'DELIVERY: send home to the customer (spare envelope, they\'ll seal and send it on)'
                    : 'DELIVERY: send directly to the recipient',
                `  ${r.name}`,
                r.address1 ? `  ${r.address1}` : null,
                r.address2 ? `  ${r.address2}` : null,
                [r.city, r.county].filter(Boolean).join(', ') ? `  ${[r.city, r.county].filter(Boolean).join(', ')}` : null,
                r.postcode ? `  ${r.postcode}` : null,
                r.country ? `  ${r.country}` : null,
            ].filter(Boolean).join('\n')
            : [
                'DELIVERY: to the customer themselves (they\'ll write in it)',
                customerAddressLines ? customerAddressLines.map((l) => `  ${l}`).join('\n') : '  ⚠️ No shipping address was collected for this order.',
            ].join('\n'),
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
export async function sendBasketOrderEmail(env, order) {
    const tracking = order.tracking || new Map();
    const attachments = [];
    const attachedTrackingNumbers = new Set();
    order.items.forEach((item) => {
        const safeTitle = (item.title || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        if (item.pdfDataUri) {
            attachments.push({
                filename: `order-item-${item.index + 1}-${item.kind}-${safeTitle}.pdf`,
                content: item.pdfDataUri.split(',')[1] || item.pdfDataUri,
            });
        }
        // One label per destination parcel, not per item — a group of
        // several items sharing one parcel also shares one tracking
        // number/label, so only attach it the first time it's seen.
        const shipment = tracking.get(item.index);
        if (shipment?.labelBase64 && !attachedTrackingNumbers.has(shipment.trackingNumber)) {
            attachedTrackingNumbers.add(shipment.trackingNumber);
            attachments.push({
                filename: `postage-label-${shipment.trackingNumber}.pdf`,
                content: shipment.labelBase64,
            });
        }
    });

    const missingPdfCount = order.items.filter((item) => !item.pdfDataUri).length;
    const hasSelfDeliveryItem = order.items.some((item) => item.delivery?.type !== 'recipient');
    const customerAddressLines = hasSelfDeliveryItem ? (formatSelfAddress(order.selfAddress) || formatCustomerShippingAddress(order.shippingDetails)) : null;

    const itemLines = order.items.map((item, i) => {
        const wantsRecipient = item.delivery?.type === 'recipient' && item.delivery?.recipient;
        const r = wantsRecipient ? item.delivery.recipient : null;
        const bits = [
            `${i + 1}. ${item.title || 'Personalised item'} (${item.kind})`,
            item.optionsSummary ? `   ${item.optionsSummary}` : null,
            `   Qty: ${item.quantity}${item.price ? ` · ${item.price} each` : ''}`,
            !item.pdfDataUri ? '   ⚠️ No PDF found in storage for this item.' : null,
            tracking.get(item.index)?.trackingNumber
                ? `   Royal Mail tracking number: ${tracking.get(item.index).trackingNumber}${tracking.get(item.index).labelBase64 ? ' (label attached)' : ' — ⚠️ label not returned, check Click & Drop dashboard'}`
                : null,
            wantsRecipient
                ? [
                    item.delivery.envelopeMode === 'home'
                        ? '   Delivery: send home to the customer (spare envelope, they\'ll seal and send it on)'
                        : '   Delivery: send directly to the recipient',
                    `     ${r.name}`,
                    r.address1 ? `     ${r.address1}` : null,
                    r.address2 ? `     ${r.address2}` : null,
                    [r.city, r.county].filter(Boolean).join(', ') ? `     ${[r.city, r.county].filter(Boolean).join(', ')}` : null,
                    r.postcode ? `     ${r.postcode}` : null,
                    r.country ? `     ${r.country}` : null,
                ].filter(Boolean).join('\n')
                : [
                    '   Delivery:',
                    customerAddressLines
                        ? customerAddressLines.map((l) => `     ${l}`).join('\n')
                        : '     ⚠️ No shipping address was collected for this order.',
                ].join('\n'),
        ];
        return bits.filter(Boolean).join('\n');
    });

    const lines = [
        `Product: basket (${order.items.length} item${order.items.length === 1 ? '' : 's'})`,
        `Customer email: ${order.customerEmail}`,
        order.amountTotal != null ? `Amount paid: £${(order.amountTotal / 100).toFixed(2)}` : null,
        '',
        itemLines.join('\n\n'),
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
