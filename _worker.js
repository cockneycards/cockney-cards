// _worker.js
//
// Cloudflare Workers entry point.
//
// This project deploys via `npx wrangler deploy` (a plain Worker with a
// static assets directory), NOT `wrangler pages deploy`. Cloudflare Pages
// auto-routes anything under a functions/ folder to a matching URL path —
// plain Workers do not do this. Without this file, every handler in
// functions/ (create-checkout.js, create-checkout-print.js,
// create-checkout-basket.js, stripe-webhook.js) is just an inert static
// file sitting on the site, never executed.
//
// This script re-implements that routing explicitly: known POST routes are
// dispatched to their handler, and everything else falls through to the
// static site (HTML/CSS/JS/images) via the ASSETS binding.
//
// REQUIRES wrangler.jsonc to have:
//   "main": "_worker.js"
//   "assets": { "directory": ".", "binding": "ASSETS" }
// The "binding": "ASSETS" part specifically is what makes env.ASSETS.fetch()
// below work — without it, every HTML page on the site would 404.
//
// Also add "functions/" to .assetsignore — those .js files should be
// imported into this Worker's bundle (below), not served as public,
// downloadable static files the way the last deploy's log showed them
// being uploaded as.

import { onRequestPost as createCheckout } from './functions/create-checkout.js';
import { onRequestPost as createCheckoutPrint } from './functions/create-checkout-print.js';
import { onRequestPost as createCheckoutBasket } from './functions/create-checkout-basket.js';
import { onRequestPost as stripeWebhook } from './functions/stripe-webhook.js';

// URL path -> POST handler. Add a line here any time a new functions/*.js
// file needs to be reachable — dropping a file in functions/ alone does
// NOT wire up a route the way it did back when this ran on Pages.
const POST_ROUTES = {
    '/create-checkout': createCheckout,
    '/create-checkout-print': createCheckoutPrint,
    '/create-checkout-basket': createCheckoutBasket,
    '/stripe-webhook': stripeWebhook,
};

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const handler = POST_ROUTES[url.pathname];

        if (handler && request.method === 'POST') {
            // Each functions/*.js handler is written as a Cloudflare Pages
            // Function — `onRequestPost(context)`, destructuring
            // `{ request, env }` out of context. None of them use
            // context.next or context.params, so this minimal shape is
            // enough to run them unmodified.
            return handler({ request, env, waitUntil: ctx.waitUntil.bind(ctx) });
        }

        // Everything else — index.html, editor.html, cart.js, images, etc.
        // — is served straight from the static assets binding, same as
        // before this file existed.
        return env.ASSETS.fetch(request);
    },
};
