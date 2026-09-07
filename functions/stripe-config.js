// functions/stripe-config.js
//
// Tiny Cloudflare Pages Function used by checkout.html to fetch Stripe's
// PUBLISHABLE key (pk_live_... / pk_test_...) at load time rather than
// hardcoding it into the HTML/JS. This is not a secret — Stripe's
// publishable key is designed to be exposed client-side (it's what
// Stripe.js itself always sends in the clear) — this just keeps it in
// one place (an env var) so switching between test/live mode, or
// rotating it, doesn't require editing checkout.html.
//
// Requires (Cloudflare Pages > Settings > Environment variables):
//   STRIPE_PUBLISHABLE_KEY - from the same Stripe Dashboard > Developers
//                             > API keys page as STRIPE_SECRET_KEY.

export async function onRequestGet(context) {
    const { env } = context;
    return new Response(JSON.stringify({
        publishableKey: env.STRIPE_PUBLISHABLE_KEY || null,
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}
