// _worker.js
//
// Cloudflare Workers entry point.
//
// This project deploys via `npx wrangler deploy` (a plain Worker with a
// static assets directory), NOT `wrangler pages deploy`. Cloudflare Pages
// auto-routes anything under a functions/ folder to a matching URL path —
// plain Workers do not do this. Without this file, every handler in
// functions/ is just an inert static file sitting on the site, never
// executed.
//
// This script re-implements that routing explicitly: known routes are
// dispatched to their handler, and everything else falls through to the
// static site (HTML/CSS/JS/images) via the ASSETS binding.
//
// Also runs the daily reminder-email cron job (see the `scheduled` export
// at the bottom, and functions/account-api.js) — ported from old-bush,
// which is being retired now that everything it uniquely provided
// (auth/reminders/orders) lives here too.
//
// REQUIRES wrangler.jsonc to have:
//   "main": "_worker.js"
//   "assets": { "directory": ".", "binding": "ASSETS" }
//   "triggers": { "crons": [...] }  — for the scheduled() handler below
//
// Also requires "functions/" to be listed in .assetsignore — those .js
// files are imported into this Worker's bundle (below), not served as
// public, downloadable static files.

import { onRequestPost as createCheckout } from './functions/create-checkout.js';
import { onRequestPost as createCheckoutPrint } from './functions/create-checkout-print.js';
import { onRequestPost as createCheckoutBasket } from './functions/create-checkout-basket.js';
import { onRequestPost as createMembershipCheckout } from './functions/create-membership-checkout.js';
import { onRequestPost as stripeWebhook } from './functions/stripe-webhook.js';
import { handleValidatePromo } from './functions/promo.js';
import {
    corsHeaders,
    handleRequestLink,
    handleVerify,
    handleGetAccount,
    handleGetReferralInfo,
    handleGetReminders,
    handleAddReminder,
    handleDeleteReminder,
    handleGetOrders,
    runDailyReminderCheck,
} from './functions/account-api.js';

// Pages-Functions-style handlers (onRequestPost(context)) — dispatched by
// exact pathname, POST only. Add a line here any time a new functions/*.js
// file needs to be reachable — dropping a file in functions/ alone does
// NOT wire up a route the way it did back when this ran on Pages.
const POST_ROUTES = {
    '/create-checkout': createCheckout,
    '/create-checkout-print': createCheckoutPrint,
    '/create-checkout-basket': createCheckoutBasket,
    '/create-membership-checkout': createMembershipCheckout,
    '/stripe-webhook': stripeWebhook,
};

// Matches old-bush's own reminder-id pattern exactly (a crypto.randomUUID()
// shape) — DELETE /api/reminders/<id>.
const REMINDER_ID_PATTERN = /^\/api\/reminders\/([a-f0-9-]+)$/;

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const { pathname } = url;
        const method = request.method;

        // CORS preflight. Same-origin requests (the normal case once this
        // fully replaces old-bush) never trigger a browser preflight at
        // all, but this stays harmless and useful for cross-origin testing
        // (e.g. hitting the workers.dev URL directly while pages are
        // loaded from the custom domain).
        if (method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders(env) });
        }

        const postHandler = POST_ROUTES[pathname];
        if (postHandler && method === 'POST') {
            // Each functions/*.js handler here is written as a Cloudflare
            // Pages Function — `onRequestPost(context)`, destructuring
            // `{ request, env }` out of context. None of them use
            // context.next or context.params, so this minimal shape is
            // enough to run them unmodified.
            return postHandler({ request, env, waitUntil: ctx.waitUntil.bind(ctx) });
        }

        // Account API — auth, reminders, order history. Plain
        // (request, env) handlers, ported from old-bush (see
        // functions/account-api.js for the full history on this).
        if (pathname === '/api/auth/request-link' && method === 'POST') {
            return handleRequestLink(request, env);
        }
        if (pathname === '/api/auth/verify' && method === 'POST') {
            return handleVerify(request, env);
        }
        if (pathname === '/api/orders' && method === 'GET') {
            return handleGetOrders(request, env);
        }
        if (pathname === '/api/account' && method === 'GET') {
            return handleGetAccount(request, env);
        }
        if (pathname === '/api/referrals' && method === 'GET') {
            return handleGetReferralInfo(request, env);
        }
        if (pathname === '/api/validate-promo' && method === 'POST') {
            return handleValidatePromo(request, env);
        }
        if (pathname === '/api/reminders' && method === 'GET') {
            return handleGetReminders(request, env);
        }
        if (pathname === '/api/reminders' && method === 'POST') {
            return handleAddReminder(request, env);
        }
        const reminderDeleteMatch = pathname.match(REMINDER_ID_PATTERN);
        if (reminderDeleteMatch && method === 'DELETE') {
            return handleDeleteReminder(request, env, reminderDeleteMatch[1]);
        }

        // Everything else — index.html, editor.html, cart.js, images, etc.
        // — is served straight from the static assets binding.
        return env.ASSETS.fetch(request);
    },

    // Daily cron — emails customers 2 weeks ahead of a saved reminder date.
    // The actual schedule (what time, how often) is set in wrangler.jsonc's
    // triggers.crons, not here.
    async scheduled(event, env, ctx) {
        ctx.waitUntil(runDailyReminderCheck(env));
    },
};
