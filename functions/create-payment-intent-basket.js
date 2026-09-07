// functions/create-payment-intent-basket.js
//
// Cloudflare Pages Function — the custom-checkout counterpart to
// create-checkout-basket.js. Used by the new checkout.html page instead
// of redirecting to a Stripe-hosted Checkout page.
//
// Why this exists: Stripe Checkout Sessions always show Stripe's own
// generic "Shipping information" step, even when every item's delivery
// address has already been resolved on basket.html (a saved "self"
// address, or a per-item "recipient" address). That produced a confusing
// extra address field that looked broken (see the basket.html/
// create-checkout-basket.js fix that stopped requesting it for
// all-recipient baskets) and doesn't match the desired UX — a clear
// review of every card + its delivery address (matching Moonpig's
// checkout, per the design conversation), followed by payment, all on
// our own pages. Stripe's Checkout Session product doesn't support that
// — its shipping step is all-or-nothing per session — so this endpoint
// creates a PaymentIntent instead, which checkout.html confirms itself
// via Stripe's embedded Payment Element (card entry only, no address
// UI at all).
//
// Pricing/discount/reward/postage logic below is copied verbatim from
// create-checkout-basket.js's line-item loop (same club discount, same
// reward-unit splitting, same per-destination postage rules) — it just
// accumulates one total instead of building Stripe Checkout line items,
// since a PaymentIntent doesn't have a line-item concept the customer
// sees; the itemised breakdown is stored in R2 instead, for the order
// email/receipt to read back out.
//
// Requires the same STRIPE_SECRET_KEY env var and ORDER_PDFS R2 bucket
// binding as create-checkout-basket.js (all the checkout functions share
// them).

import { groupItemsByDestination, highestTier, POSTAGE_TIERS } from './postage.js';
import { checkPlusMembership, getUserFromAuth } from './account-api.js';
import { checkPromoCode } from './promo.js';
import { getRewardCodeDetails, getActiveWelcomeReward } from './referrals.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
            return new Response(JSON.stringify({ error: 'Baskets are limited to 50 items — please split your order.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Unlike create-checkout-basket.js, there's no Stripe-hosted page
        // left to collect an email on — checkout.html collects it
        // directly (prefilled for logged-in customers, typed in by
        // guests), so it's required here rather than optional.
        const customerEmail = (data.customerEmail || '').toString().trim().toLowerCase();
        if (!customerEmail || !EMAIL_RE.test(customerEmail)) {
            return new Response(JSON.stringify({ error: 'Please enter a valid email address.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const orderId = crypto.randomUUID();

        const rawSelfAddress = data.selfAddress;
        const hasSelfAddress = !!(rawSelfAddress && rawSelfAddress.name && rawSelfAddress.address1 && rawSelfAddress.city && rawSelfAddress.postcode);
        const selfAddress = hasSelfAddress ? {
            label: (rawSelfAddress.label || '').toString().slice(0, 100),
            name: (rawSelfAddress.name || '').toString().slice(0, 200),
            address1: (rawSelfAddress.address1 || '').toString().slice(0, 200),
            address2: (rawSelfAddress.address2 || '').toString().slice(0, 200),
            city: (rawSelfAddress.city || '').toString().slice(0, 200),
            county: (rawSelfAddress.county || '').toString().slice(0, 200),
            postcode: (rawSelfAddress.postcode || '').toString().slice(0, 50),
            country: (rawSelfAddress.country || 'United Kingdom').toString().slice(0, 100),
        } : null;

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
                size: item.kind === 'print' && POSTAGE_TIERS[item.size] ? item.size : null,
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

        // With Stripe's own shipping step gone entirely, any "self"
        // item's address MUST already be resolved on basket.html before
        // we get here — there's nowhere left downstream to collect one.
        const needsCustomerAddress = items.some((item) => item.delivery?.type !== 'recipient');
        if (needsCustomerAddress && !selfAddress) {
            return new Response(JSON.stringify({ error: 'Please add a delivery address for the item(s) going to you before checking out.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const authedUser = await getUserFromAuth(request, env);
        const isClubMember = await checkPlusMembership(request, env);
        const isPromoValid = await checkPromoCode(data.promoCode, env);

        const rewardCodeEntered = (data.rewardCode || '').toString().trim();
        let rewardCode = rewardCodeEntered;
        let rewardDetails = rewardCodeEntered ? await getRewardCodeDetails(rewardCodeEntered, authedUser, env) : null;

        if (!rewardDetails && authedUser) {
            const autoWelcome = await getActiveWelcomeReward(authedUser, env);
            if (autoWelcome) {
                rewardCode = autoWelcome.code;
                rewardDetails = { rewardType: 'new_customer_25', discountPercent: autoWelcome.discountPercent };
            }
        }
        const rewardIsUsable = !!(rewardDetails && (
            rewardDetails.rewardType === 'free_card' ||
            (rewardDetails.rewardType === 'new_customer_25' && rewardDetails.discountPercent && !isClubMember)
        ));
        let rewardApplied = false;

        // Same grouping-by-destination + per-item pricing + per-parcel
        // postage as create-checkout-basket.js — just accumulated into a
        // total instead of Stripe line items, and recorded in
        // `breakdown` (stored in R2) so the order email/receipt can still
        // show a proper itemised list.
        const groups = groupItemsByDestination(items);
        let totalAmountPence = 0;
        let parcelNumber = 0;
        const breakdown = [];

        for (const groupItems of groups.values()) {
            parcelNumber++;
            const cardUnitsInGroup = groupItems
                .filter((item) => item.kind === 'card')
                .reduce((sum, item) => sum + item.quantity, 0);
            const printItemsInGroup = groupItems.filter((item) => item.kind === 'print');
            const printUnitsInGroup = printItemsInGroup.reduce((sum, item) => sum + item.quantity, 0);
            const printSizesInGroup = new Set(printItemsInGroup.map((item) => item.size));
            const discountRate = isClubMember ? 0.25 : 0;

            groupItems.forEach((item) => {
                const hasPrice = typeof item.priceValue === 'number' && item.priceValue > 0;
                let unitAmount = hasPrice ? Math.round(item.priceValue * 100) : 999; // £9.99 fallback
                let name = hasPrice ? item.title : `${item.title} — PRICE CHECK NEEDED`;

                if (item.kind === 'card' && discountRate > 0 && hasPrice) {
                    unitAmount = Math.round(unitAmount * (1 - discountRate));
                    name = `${item.title} (${Math.round(discountRate * 100)}% Club discount)`;
                }

                if (!rewardApplied && rewardIsUsable && item.kind === 'card' && hasPrice) {
                    rewardApplied = true;
                    const normalQty = item.quantity - 1;
                    if (normalQty > 0) {
                        totalAmountPence += unitAmount * normalQty;
                        breakdown.push({ name, unitAmount, quantity: normalQty });
                    }

                    const isFreeCardReward = rewardDetails.rewardType === 'free_card';
                    const rewardUnitAmount = isFreeCardReward
                        ? 0
                        : Math.max(0, Math.round(unitAmount * (1 - rewardDetails.discountPercent / 100)));
                    const rewardName = isFreeCardReward
                        ? `${item.title} (Free — Refer a Friend reward)`
                        : `${item.title} (${rewardDetails.discountPercent}% off — Welcome reward)`;

                    totalAmountPence += rewardUnitAmount;
                    breakdown.push({ name: rewardName, unitAmount: rewardUnitAmount, quantity: 1 });
                    return;
                }

                totalAmountPence += unitAmount * item.quantity;
                breakdown.push({ name, unitAmount, quantity: item.quantity });
            });

            const tier = highestTier(groupItems);
            const allCardsInGroup = groupItems.every((item) => item.kind === 'card');
            const allPrintsInGroup = groupItems.length > 0 && groupItems.every((item) => item.kind === 'print');
            const qualifiesForFreeCardDelivery = allCardsInGroup && cardUnitsInGroup >= 3;
            const qualifiesForFreePrintDelivery = allPrintsInGroup && printSizesInGroup.size === 1 && !printSizesInGroup.has(null) && printUnitsInGroup >= 2;
            const postageWaived = qualifiesForFreeCardDelivery || qualifiesForFreePrintDelivery || (allCardsInGroup && isPromoValid);
            const postageAmount = postageWaived ? 0 : POSTAGE_TIERS[tier];
            const parcelLabel = groups.size > 1 ? ` (parcel ${parcelNumber} of ${groups.size})` : '';
            let postageName;
            if (qualifiesForFreeCardDelivery) {
                postageName = `Free Postage (3+ cards to this address)${parcelLabel}`;
            } else if (qualifiesForFreePrintDelivery) {
                postageName = `Free Postage (2+ same-size prints to this address)${parcelLabel}`;
            } else if (postageWaived) {
                postageName = `Free Postage (Promo Code)${parcelLabel}`;
            } else {
                postageName = `Postage${parcelLabel}`;
            }

            totalAmountPence += postageAmount;
            breakdown.push({ name: postageName, unitAmount: postageAmount, quantity: 1 });
        }

        // Stripe rejects PaymentIntents below 30p — guard against a
        // £0.00 basket (e.g. every item zeroed by a reward, no postage
        // ever being genuinely free of a paid item) reaching the API as
        // a confusing 500 rather than a clear message.
        if (totalAmountPence < 30) {
            return new Response(JSON.stringify({ error: 'Order total is too low to process — please check your basket.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Order record for stripe-webhook.js to pick up once payment
        // succeeds — same shape as create-checkout-basket.js's R2 entry
        // (items, selfAddress), plus what a PaymentIntent doesn't carry
        // the way a Checkout Session's customer_details did: the email
        // and the priced breakdown for the order emails/receipt.
        await env.ORDER_PDFS.put(orderId, JSON.stringify({
            items,
            selfAddress,
            customerEmail,
            amountTotal: totalAmountPence,
            breakdown,
        }));

        const params = new URLSearchParams();
        params.append('amount', String(totalAmountPence));
        params.append('currency', 'gbp');
        params.append('automatic_payment_methods[enabled]', 'true');
        params.append('receipt_email', customerEmail);
        params.append('metadata[order_id]', orderId);
        params.append('metadata[product_type]', 'basket');
        params.append('metadata[item_count]', String(items.length));
        if (rewardApplied) {
            params.append('metadata[reward_code]', rewardCode.toUpperCase());
        }

        const stripeRes = await fetch('https://api.stripe.com/v1/payment_intents', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
        });

        const paymentIntent = await stripeRes.json();

        if (!stripeRes.ok) {
            console.error('Stripe payment intent error:', paymentIntent);
            await env.ORDER_PDFS.delete(orderId);
            return new Response(
                JSON.stringify({ error: paymentIntent.error?.message || 'Payment could not be started.' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        return new Response(JSON.stringify({
            clientSecret: paymentIntent.client_secret,
            orderId,
            amount: totalAmountPence,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('create-payment-intent-basket error:', err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
