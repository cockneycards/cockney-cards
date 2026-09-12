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
import { onRequestPost as stripeWebhook } from './functions/stripe-webhook.js';
import { onRequestPost as createPaymentIntentBasket } from './functions/create-payment-intent-basket.js';
import { onRequestGet as stripeConfig } from './functions/stripe-config.js';
import { handleValidatePromo } from './functions/promo.js';
import {
    corsHeaders,
    handleSignup,
    handleLogin,
    handleRequestPasswordReset,
    handleResetPassword,
    handleChangePassword,
    handleGetAccount,
    handleGetReferralInfo,
    handleSendReferralInvite,
    handleCancelMembership,
    handleResumeMembership,
    handleDeleteAccount,
    handleGetReminders,
    handleAddReminder,
    handleDeleteReminder,
    handleGetAddresses,
    handleAddAddress,
    handleDeleteAddress,
    handleSetDefaultAddress,
    handleGetOrders,
    runDailyReminderCheck,
} from './functions/account-api.js';
import { handleGetInstagramFeed } from './functions/instagram-feed-api.js';

// Pages-Functions-style handlers (onRequestPost(context)) — dispatched by
// exact pathname, POST only. Add a line here any time a new functions/*.js
// file needs to be reachable — dropping a file in functions/ alone does
// NOT wire up a route the way it did back when this ran on Pages.
const POST_ROUTES = {
    '/create-checkout': createCheckout,
    '/create-checkout-print': createCheckoutPrint,
    '/create-checkout-basket': createCheckoutBasket,
    '/stripe-webhook': stripeWebhook,
    '/create-payment-intent-basket': createPaymentIntentBasket,
};

// Matches old-bush's own reminder-id pattern exactly (a crypto.randomUUID()
// shape) — DELETE /api/reminders/<id>.
const REMINDER_ID_PATTERN = /^\/api\/reminders\/([a-f0-9-]+)$/;

// Same shape, for the addresses added alongside reminders — DELETE
// /api/addresses/<id> and POST /api/addresses/<id>/default.
const ADDRESS_ID_PATTERN = /^\/api\/addresses\/([a-f0-9-]+)$/;
const ADDRESS_DEFAULT_PATTERN = /^\/api\/addresses\/([a-f0-9-]+)\/default$/;

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

        // GET-based config endpoint used by checkout.html to fetch the
        // Stripe publishable key. Not part of POST_ROUTES since it's the
        // only GET handler among the ported functions/*.js files.
        if (pathname === '/stripe-config' && method === 'GET') {
            return stripeConfig({ request, env, waitUntil: ctx.waitUntil.bind(ctx) });
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
        if (pathname === '/api/auth/signup' && method === 'POST') {
            return handleSignup(request, env);
        }
        if (pathname === '/api/auth/login' && method === 'POST') {
            return handleLogin(request, env);
        }
        if (pathname === '/api/auth/forgot-password' && method === 'POST') {
            return handleRequestPasswordReset(request, env);
        }
        if (pathname === '/api/auth/reset-password' && method === 'POST') {
            return handleResetPassword(request, env);
        }
        if (pathname === '/api/account/change-password' && method === 'POST') {
            return handleChangePassword(request, env);
        }
        if (pathname === '/api/orders' && method === 'GET') {
            return handleGetOrders(request, env);
        }
        if (pathname === '/api/account' && method === 'GET') {
            return handleGetAccount(request, env);
        }
        if (pathname === '/api/instagram-feed' && method === 'GET') {
            return handleGetInstagramFeed(request, env);
        }
        if (pathname === '/api/account' && method === 'DELETE') {
            return handleDeleteAccount(request, env);
        }
        if (pathname === '/api/referrals' && method === 'GET') {
            return handleGetReferralInfo(request, env);
        }
        if (pathname === '/api/referrals/send-invite' && method === 'POST') {
            return handleSendReferralInvite(request, env);
        }
        if (pathname === '/api/account/cancel-membership' && method === 'POST') {
            return handleCancelMembership(request, env);
        }
        if (pathname === '/api/account/resume-membership' && method === 'POST') {
            return handleResumeMembership(request, env);
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
        if (pathname === '/api/addresses' && method === 'GET') {
            return handleGetAddresses(request, env);
        }
        if (pathname === '/api/addresses' && method === 'POST') {
            return handleAddAddress(request, env);
        }
        const addressDefaultMatch = pathname.match(ADDRESS_DEFAULT_PATTERN);
        if (addressDefaultMatch && method === 'POST') {
            return handleSetDefaultAddress(request, env, addressDefaultMatch[1]);
        }
        const addressDeleteMatch = pathname.match(ADDRESS_ID_PATTERN);
        if (addressDeleteMatch && method === 'DELETE') {
            return handleDeleteAddress(request, env, addressDeleteMatch[1]);
        }

        // Everything else — index.html, editor.html, cart.js, images, etc.
        // — is served straight from the static assets binding.
        return env.ASSETS.fetch(request);
    },

    // Daily cron — emails customers 10 days ahead of a saved reminder date.
    // The actual schedule (what time, how often) is set in wrangler.jsonc's
    // triggers.crons, not here.
    async scheduled(event, env, ctx) {
        ctx.waitUntil(runDailyReminderCheck(env));
    },
};
