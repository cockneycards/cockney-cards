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
//
// Membership purchases work for guests too, not just logged-in
// customers — see findOrCreateUserByEmail in account-api.js, used below
// instead of rejecting a guest outright.

import {
    groupItemsByDestination,
    POSTAGE_TIERS,
    POSTAGE_METHODS,
    resolveGroupMethod,
    freeMethodsForItems,
    postageAmountForMethod,
    qualifiesForFreeCardDelivery,
    qualifiesForFreePrintDelivery,
    qualifiesForFreeLargePrintDelivery,
    qualifiesForFreeA3BundleDelivery,
    qualifiesForFreeA3TrackedDelivery,
} from './postage.js';
import { checkPlusMembership, getUserFromAuth, findOrCreateUserByEmail } from './account-api.js';
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

        // Cockney Cards Club membership (added via basket.html's Join Now
        // banner) isn't a physical, PDF-bearing product — it's split out
        // here so it never touches the missingPdf check, postage
        // grouping, or the card discount/reward logic below, all of
        // which only ever look at rawProductItems. See the membership
        // pricing block further down for how it's actually charged.
        const rawMembershipItems = rawItems.filter((item) => item.kind === 'membership');
        const rawProductItems = rawItems.filter((item) => item.kind !== 'membership');
        if (rawMembershipItems.length > 1) {
            return new Response(JSON.stringify({ error: 'Only one Cockney Cards Club membership can be added at a time.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        const wantsMembership = rawMembershipItems.length === 1;


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

        const items = rawProductItems.map((item, i) => {
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
                // Customer's chosen Royal Mail service for this item, as
                // picked on basket.html's per-destination service picker
                // (see resolveGroupMethod) — undefined/invalid values are
                // ignored and the cheapest valid service is used instead.
                // This was previously dropped on the floor here, which is
                // why postage was always charged at the flat First Class
                // rate no matter which service the customer picked.
                shippingMethod: Object.values(POSTAGE_METHODS).includes(item.shippingMethod) ? item.shippingMethod : null,
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
                    },
                    // 'direct' = we seal it and post it straight to them;
                    // 'home' = it comes back to the customer (unsealed, with
                    // a spare envelope) instead — the order email needs this
                    // to say which one is actually happening.
                    envelopeMode: item.delivery.envelopeMode === 'home' ? 'home' : 'direct',
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

        let authedUser = await getUserFromAuth(request, env);
        const isClubMember = await checkPlusMembership(request, env);
        const isPromoValid = await checkPromoCode(data.promoCode, env);

        // Matches basket.html's clubDiscountActive: a non-member adding the
        // Annual Membership to this same basket gets the 25% card discount
        // applied to THIS order too (not just future ones), since they'll
        // be a member by the time it's charged — see the membership block
        // further down for the (separate, un-discounted) £9.99 charge for
        // the membership itself. wantsMembership and isClubMember can never
        // both be true here — the "already a member" check above already
        // rejects that combination — so this never double-applies.
        const membershipActive = isClubMember || wantsMembership;

        // Membership has to attach to an account, and buying it again
        // while already a member would just waste the customer's money
        // (checkPlusMembership already accounts for a lapsed/expired
        // one-off membership — see account-api.js — so a genuinely
        // lapsed member can still rejoin here). A guest (no authedUser)
        // isn't turned away any more — findOrCreateUserByEmail attaches
        // membership to their existing account if customerEmail matches
        // one, or creates a fresh one otherwise, same as clicking a
        // magic-link login would, just skipping the click-through since
        // completing payment is itself a strong enough verification.
        if (wantsMembership) {
            if (isClubMember) {
                return new Response(JSON.stringify({ error: "You're already a Cockney Cards Club member." }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            if (!authedUser) {
                authedUser = await findOrCreateUserByEmail(customerEmail, env);
            }
        }


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
            (rewardDetails.rewardType === 'new_customer_25' && rewardDetails.discountPercent && !membershipActive)
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
            const discountRate = membershipActive ? 0.25 : 0;

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

            const allCardsInGroup = groupItems.every((item) => item.kind === 'card');
            const qualifiesCardDelivery = qualifiesForFreeCardDelivery(groupItems);
            const qualifiesPrintDelivery = qualifiesForFreePrintDelivery(groupItems);
            const qualifiesLargePrintDelivery = qualifiesForFreeLargePrintDelivery(groupItems);
            const qualifiesA3BundleDelivery = qualifiesForFreeA3BundleDelivery(groupItems);
            const qualifiesA3TrackedDelivery = qualifiesForFreeA3TrackedDelivery(groupItems);

            // Which service this parcel actually ships under — resolved
            // from whatever each item requested on basket.html, same as
            // create-checkout-basket.js. Note membership does NOT waive
            // postage (that's the 25% card discount above instead), so
            // isClubMember is deliberately not passed to
            // freeMethodsForItems here.
            const chosenMethod = resolveGroupMethod(groupItems) || POSTAGE_METHODS.FIRST_CLASS;
            const freeMethods = freeMethodsForItems(groupItems);
            // The promo-code waiver is cards-only and, like the quantity
            // promos above, only ever covers First Class — a customer who
            // upgrades to a tracked service still pays for that upgrade.
            const promoWaivesThisMethod = allCardsInGroup && isPromoValid && chosenMethod === POSTAGE_METHODS.FIRST_CLASS;
            const postageWaived = freeMethods.has(chosenMethod) || promoWaivesThisMethod;
            const postageAmount = postageWaived ? 0 : postageAmountForMethod(groupItems, chosenMethod);
            const parcelLabel = groups.size > 1 ? ` (parcel ${parcelNumber} of ${groups.size})` : '';
            let postageName;
            if (postageWaived && qualifiesCardDelivery) {
                postageName = `Free Postage (3+ cards to this address)${parcelLabel}`;
            } else if (postageWaived && qualifiesPrintDelivery) {
                postageName = `Free Postage (2+ same-size prints to this address)${parcelLabel}`;
            } else if (postageWaived && qualifiesLargePrintDelivery) {
                postageName = `Free Postage (2+ A4/A3 prints + a card to this address)${parcelLabel}`;
            } else if (postageWaived && qualifiesA3BundleDelivery) {
                postageName = `Free Postage (2+ A3 prints + a card/A4/A5 to this address)${parcelLabel}`;
            } else if (postageWaived && qualifiesA3TrackedDelivery) {
                postageName = `Free Postage (2+ A3 prints to this address)${parcelLabel}`;
            } else if (postageWaived && promoWaivesThisMethod) {
                postageName = `Free Postage (Promo Code)${parcelLabel}`;
            } else {
                postageName = `Postage${parcelLabel}`;
            }

            totalAmountPence += postageAmount;
            breakdown.push({ name: postageName, unitAmount: postageAmount, quantity: 1 });
        }

        // Cockney Cards Club membership — a one-time £9.99 charge, not a
        // real Stripe Subscription (a PaymentIntent can't create one).
        // On payment, stripe-webhook.js sets a 1-year
        // plus_current_period_end; checkPlusMembership() in
        // account-api.js already treats a past one as "not a member"
        // regardless of how it got set, so this naturally lapses on its
        // own a year from now — no renewal job needed, the Join Now
        // banner on basket.html just reappears once clubIsMember goes
        // false again.
        const MEMBERSHIP_PRICE_PENCE = 999; // £9.99
        if (wantsMembership) {
            totalAmountPence += MEMBERSHIP_PRICE_PENCE;
            breakdown.push({ name: 'Cockney Cards Club — Annual Membership', unitAmount: MEMBERSHIP_PRICE_PENCE, quantity: 1 });
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
            membershipUserId: wantsMembership ? authedUser.id : null,
        }));

        const params = new URLSearchParams();
        params.append('amount', String(totalAmountPence));
        params.append('currency', 'gbp');
        params.append('automatic_payment_methods[enabled]', 'true');
        params.append('receipt_email', customerEmail);
        params.append('metadata[order_id]', orderId);
        params.append('metadata[product_type]', 'basket');
        params.append('metadata[item_count]', String(items.length));
        params.append('metadata[has_membership]', wantsMembership ? '1' : '0');
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
