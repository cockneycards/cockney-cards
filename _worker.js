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
// at the bottom, and functions/account-api.js).

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

// Pages-Functions-style handlers — dispatched by exact pathname, POST only.
const POST_ROUTES = {
    '/create-checkout': createCheckout,
    '/create-checkout-print': createCheckoutPrint,
    '/create-checkout-basket': createCheckoutBasket,
    '/stripe-webhook': stripeWebhook,
    '/create-payment-intent-basket': createPaymentIntentBasket,
};

// Matches reminder IDs — DELETE /api/reminders/<id>.
const REMINDER_ID_PATTERN = /^\/api\/reminders\/([a-f0-9-]+)$/;

// Addresses — DELETE /api/addresses/<id>
const ADDRESS_ID_PATTERN = /^\/api\/addresses\/([a-f0-9-]+)$/;

// Addresses — POST /api/addresses/<id>/default
const ADDRESS_DEFAULT_PATTERN = /^\/api\/addresses\/([a-f0-9-]+)\/default$/;


/**
 * Proxy an Instagram image through the Cloudflare Worker.
 *
 * This is used because Instagram can return image URLs which don't always
 * display reliably when loaded directly by the browser.
 *
 * The website calls:
 *
 * /api/instagram-image?url=<instagram-image-url>
 *
 * The Worker fetches the image from Instagram and sends it back to the
 * visitor from cockneycards.com.
 */
async function handleInstagramImage(request) {
    const requestUrl = new URL(request.url);
    const imageUrl = requestUrl.searchParams.get('url');

    if (!imageUrl) {
        return new Response('Missing image URL.', {
            status: 400,
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
            },
        });
    }

    let target;

    try {
        target = new URL(imageUrl);
    } catch {
        return new Response('Invalid image URL.', {
            status: 400,
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
            },
        });
    }

    // Only allow genuine Instagram/Facebook image hosts.
    const allowedHosts = [
        'cdninstagram.com',
        'instagram.com',
        'fbcdn.net',
    ];

    const allowed = allowedHosts.some(
        host =>
            target.hostname === host ||
            target.hostname.endsWith('.' + host)
    );

    if (!allowed) {
        return new Response('Image host not allowed.', {
            status: 403,
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
            },
        });
    }

    try {
        const response = await fetch(target.toString(), {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept':
                    'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            },
        });

        if (!response.ok) {
            return new Response(
                'Instagram image could not be fetched.',
                {
                    status: response.status,
                    headers: {
                        'Content-Type': 'text/plain; charset=utf-8',
                    },
                }
            );
        }

        const headers = new Headers(response.headers);

        // Cache Instagram images for one hour.
        headers.set(
            'Cache-Control',
            'public, max-age=3600, s-maxage=3600'
        );

        // Do not pass cookies back to visitors.
        headers.delete('set-cookie');

        return new Response(response.body, {
            status: 200,
            headers,
        });

    } catch (error) {
        console.error('Instagram image proxy error:', error);

        return new Response(
            'Could not load Instagram image.',
            {
                status: 502,
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                },
            }
        );
    }
}


export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const { pathname } = url;
        const method = request.method;

        // CORS preflight.
        if (method === 'OPTIONS') {
            return new Response(null, {
                headers: corsHeaders(env),
            });
        }

        // Stripe publishable-key endpoint.
        if (pathname === '/stripe-config' && method === 'GET') {
            return stripeConfig({
                request,
                env,
                waitUntil: ctx.waitUntil.bind(ctx),
            });
        }

        // POST routes.
        const postHandler = POST_ROUTES[pathname];

        if (postHandler && method === 'POST') {
            return postHandler({
                request,
                env,
                waitUntil: ctx.waitUntil.bind(ctx),
            });
        }

        // Account API.
        if (pathname === '/api/auth/signup' && method === 'POST') {
            return handleSignup(request, env);
        }

        if (pathname === '/api/auth/login' && method === 'POST') {
            return handleLogin(request, env);
        }

        if (
            pathname === '/api/auth/forgot-password' &&
            method === 'POST'
        ) {
            return handleRequestPasswordReset(request, env);
        }

        if (
            pathname === '/api/auth/reset-password' &&
            method === 'POST'
        ) {
            return handleResetPassword(request, env);
        }

        if (
            pathname === '/api/account/change-password' &&
            method === 'POST'
        ) {
            return handleChangePassword(request, env);
        }

        if (pathname === '/api/orders' && method === 'GET') {
            return handleGetOrders(request, env);
        }

        if (pathname === '/api/account' && method === 'GET') {
            return handleGetAccount(request, env);
        }

        // Instagram feed API.
        if (
            pathname === '/api/instagram-feed' &&
            method === 'GET'
        ) {
            return handleGetInstagramFeed(request, env);
        }

        // Instagram image proxy.
        if (
            pathname === '/api/instagram-image' &&
            method === 'GET'
        ) {
            return handleInstagramImage(request);
        }

        if (
            pathname === '/api/account' &&
            method === 'DELETE'
        ) {
            return handleDeleteAccount(request, env);
        }

        if (
            pathname === '/api/referrals' &&
            method === 'GET'
        ) {
            return handleGetReferralInfo(request, env);
        }

        if (
            pathname === '/api/referrals/send-invite' &&
            method === 'POST'
        ) {
            return handleSendReferralInvite(request, env);
        }

        if (
            pathname === '/api/account/cancel-membership' &&
            method === 'POST'
        ) {
            return handleCancelMembership(request, env);
        }

        if (
            pathname === '/api/account/resume-membership' &&
            method === 'POST'
        ) {
            return handleResumeMembership(request, env);
        }

        if (
            pathname === '/api/validate-promo' &&
            method === 'POST'
        ) {
            return handleValidatePromo(request, env);
        }

        // Reminders.
        if (
            pathname === '/api/reminders' &&
            method === 'GET'
        ) {
            return handleGetReminders(request, env);
        }

        if (
            pathname === '/api/reminders' &&
            method === 'POST'
        ) {
            return handleAddReminder(request, env);
        }

        const reminderDeleteMatch =
            pathname.match(REMINDER_ID_PATTERN);

        if (
            reminderDeleteMatch &&
            method === 'DELETE'
        ) {
            return handleDeleteReminder(
                request,
                env,
                reminderDeleteMatch[1]
            );
        }

        // Addresses.
        if (
            pathname === '/api/addresses' &&
            method === 'GET'
        ) {
            return handleGetAddresses(request, env);
        }

        if (
            pathname === '/api/addresses' &&
            method === 'POST'
        ) {
            return handleAddAddress(request, env);
        }

        const addressDefaultMatch =
            pathname.match(ADDRESS_DEFAULT_PATTERN);

        if (
            addressDefaultMatch &&
            method === 'POST'
        ) {
            return handleSetDefaultAddress(
                request,
                env,
                addressDefaultMatch[1]
            );
        }

        const addressDeleteMatch =
            pathname.match(ADDRESS_ID_PATTERN);

        if (
            addressDeleteMatch &&
            method === 'DELETE'
        ) {
            return handleDeleteAddress(
                request,
                env,
                addressDeleteMatch[1]
            );
        }

        // Everything else — index.html, editor.html, cart.js,
        // images, etc. — is served from the static assets binding.
        return env.ASSETS.fetch(request);
    },


    // Daily reminder cron.
    async scheduled(event, env, ctx) {
        ctx.waitUntil(runDailyReminderCheck(env));
    },
};
