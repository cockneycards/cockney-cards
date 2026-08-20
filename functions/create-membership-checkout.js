// functions/create-membership-checkout.js
//
// Cloudflare Pages Function — creates a Stripe Checkout Session in
// subscription mode for the Cockney Cards Club membership (£9.99/year,
// 30% off every card, flat rate regardless of quantity). Requires the
// customer to already be logged
// in (Authorization: Bearer <session token>), since a membership has to
// attach to an account, not a one-off guest checkout.
//
// Requires the same STRIPE_SECRET_KEY env var as the other create-checkout*
// functions, plus the DB (D1) binding for looking up the logged-in user.
//
// NOTE: Stripe doesn't support shipping_options in subscription mode —
// that's fine here, a membership itself isn't something that gets posted.

import { getUserFromAuth } from './account-api.js';

const PLUS_PRICE_PENCE = 999; // £9.99/year

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const user = await getUserFromAuth(request, env);
        if (!user) {
            return new Response(JSON.stringify({ error: 'Please log in before joining Cockney Cards Club.' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const origin = new URL(request.url).origin;

        const params = new URLSearchParams();
        params.append('mode', 'subscription');
        params.append('success_url', `${origin}/account.html#plus`);
        params.append('cancel_url', `${origin}/account.html#plus`);
        // Locking the email field to the account's own address makes
        // sense here (unlike the product checkouts) — a membership is
        // tied to this specific account's identity, not a one-off gift
        // that might need a different email typed in.
        params.append('customer_email', user.email);

        params.append('line_items[0][price_data][currency]', 'gbp');
        params.append('line_items[0][price_data][product_data][name]', 'Cockney Cards Club (annual membership)');
        params.append('line_items[0][price_data][product_data][description]', '30% off every card — renews yearly');
        params.append('line_items[0][price_data][unit_amount]', String(PLUS_PRICE_PENCE));
        params.append('line_items[0][price_data][recurring][interval]', 'year');
        params.append('line_items[0][quantity]', '1');

        // Links the resulting subscription back to this D1 user record —
        // stripe-webhook.js reads this on checkout.session.completed (and
        // client_reference_id as a backup) to know whose account to mark
        // as a Club member.
        params.append('client_reference_id', user.id);
        params.append('metadata[product_type]', 'membership');
        params.append('metadata[user_id]', user.id);

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
            console.error('Stripe membership session error:', session);
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
        console.error('create-membership-checkout error:', err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
