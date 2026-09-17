// _worker.js
//
// Cloudflare Workers entry point.
//
// This project deploys via `npx wrangler deploy` (a plain Worker with a
// static assets directory), NOT `wrangler pages deploy`.
//
// Known API routes are dispatched here and everything else falls through
// to the static assets binding.
//

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


// Pages-Functions-style POST handlers.
const POST_ROUTES = {
    '/create-checkout': createCheckout,
    '/create-checkout-print': createCheckoutPrint,
    '/create-checkout-basket': createCheckoutBasket,
    '/stripe-webhook': stripeWebhook,
    '/create-payment-intent-basket': createPaymentIntentBasket,
};


// Reminder ID pattern.
const REMINDER_ID_PATTERN = /^\/api\/reminders\/([a-f0-9-]+)$/;


// Address ID patterns.
const ADDRESS_ID_PATTERN = /^\/api\/addresses\/([a-f0-9-]+)$/;
const ADDRESS_DEFAULT_PATTERN = /^\/api\/addresses\/([a-f0-9-]+)\/default$/;


// Allowed hosts for Instagram image proxying.
//
// Instagram's image CDN normally uses hosts such as:
//
// cdninstagram.com
// fbcdn.net
//
// instagram.com is included as well.
const INSTAGRAM_ALLOWED_HOSTS = [
    'cdninstagram.com',
    'fbcdn.net',
    'instagram.com',
];


export default {

    async fetch(request, env, ctx) {

        const url = new URL(request.url);
        const { pathname } = url;
        const method = request.method;


        // ------------------------------------------------------------
        // CORS preflight
        // ------------------------------------------------------------

        if (method === 'OPTIONS') {
            return new Response(null, {
                headers: corsHeaders(env),
            });
        }


        // ------------------------------------------------------------
        // Stripe configuration
        // ------------------------------------------------------------

        if (pathname === '/stripe-config' && method === 'GET') {
            return stripeConfig({
                request,
                env,
                waitUntil: ctx.waitUntil.bind(ctx),
            });
        }


        // ------------------------------------------------------------
        // POST handlers
        // ------------------------------------------------------------

        const postHandler = POST_ROUTES[pathname];

        if (postHandler && method === 'POST') {
            return postHandler({
                request,
                env,
                waitUntil: ctx.waitUntil.bind(ctx),
            });
        }


        // ------------------------------------------------------------
        // Account API
        // ------------------------------------------------------------

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


        // ------------------------------------------------------------
        // Instagram feed
        // ------------------------------------------------------------

        if (
            pathname === '/api/instagram-feed' &&
            method === 'GET'
        ) {
            return handleGetInstagramFeed(request, env);
        }


        // ------------------------------------------------------------
        // Instagram image proxy
        // ------------------------------------------------------------

        if (
            pathname === '/api/instagram-image' &&
            method === 'GET'
        ) {
            return handleInstagramImage(request);
        }


        // ------------------------------------------------------------
        // Account deletion
        // ------------------------------------------------------------

        if (
            pathname === '/api/account' &&
            method === 'DELETE'
        ) {
            return handleDeleteAccount(request, env);
        }


        // ------------------------------------------------------------
        // Referrals
        // ------------------------------------------------------------

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


        // ------------------------------------------------------------
        // Membership
        // ------------------------------------------------------------

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


        // ------------------------------------------------------------
        // Promo
        // ------------------------------------------------------------

        if (
            pathname === '/api/validate-promo' &&
            method === 'POST'
        ) {
            return handleValidatePromo(request, env);
        }


        // ------------------------------------------------------------
        // Reminders
        // ------------------------------------------------------------

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


        // ------------------------------------------------------------
        // Addresses
        // ------------------------------------------------------------

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


        // ------------------------------------------------------------
        // Static website assets
        // ------------------------------------------------------------

        return env.ASSETS.fetch(request);
    },


    // --------------------------------------------------------------
    // Daily reminder cron
    // --------------------------------------------------------------

    async scheduled(event, env, ctx) {
        ctx.waitUntil(runDailyReminderCheck(env));
    },

};


/*
 * ================================================================
 * Instagram image proxy
 * ================================================================
 *
 * The Instagram feed returns a safe URL such as:
 *
 * /api/instagram-image?u=BASE64_VALUE
 *
 * This function decodes the original Instagram CDN URL, verifies
 * that it really belongs to an allowed Instagram/Facebook image
 * host, fetches it from Cloudflare's Worker, and returns it to
 * the browser.
 */
async function handleInstagramImage(request) {

    try {

        const requestUrl = new URL(request.url);

        const encodedUrl =
            requestUrl.searchParams.get('u');


        if (!encodedUrl) {
            return new Response(
                'Missing image reference.',
                {
                    status: 400,
                    headers: {
                        'Content-Type': 'text/plain; charset=utf-8',
                    },
                }
            );
        }


        // Convert base64url back to normal base64.
        let base64 = encodedUrl
            .replace(/-/g, '+')
            .replace(/_/g, '/');


        // Restore base64 padding.
        while (base64.length % 4 !== 0) {
            base64 += '=';
        }


        let imageUrl;

        try {
            imageUrl = atob(base64);
        } catch (err) {
            return new Response(
                'Invalid image reference.',
                {
                    status: 400,
                    headers: {
                        'Content-Type': 'text/plain; charset=utf-8',
                    },
                }
            );
        }


        // Parse the decoded URL.
        let target;

        try {
            target = new URL(imageUrl);
        } catch (err) {
            return new Response(
                'Invalid image URL.',
                {
                    status: 400,
                    headers: {
                        'Content-Type': 'text/plain; charset=utf-8',
                    },
                }
            );
        }


        // Only allow HTTPS.
        if (target.protocol !== 'https:') {
            return new Response(
                'Image host not allowed.',
                {
                    status: 403,
                    headers: {
                        'Content-Type': 'text/plain; charset=utf-8',
                    },
                }
            );
        }


        // Verify the hostname belongs to an allowed Instagram/Facebook
        // image host.
        const hostname =
            target.hostname.toLowerCase();


        const allowed =
            INSTAGRAM_ALLOWED_HOSTS.some(
                (host) =>
                    hostname === host ||
                    hostname.endsWith(`.${host}`)
            );


        if (!allowed) {
            return new Response(
                'Image host not allowed.',
                {
                    status: 403,
                    headers: {
                        'Content-Type': 'text/plain; charset=utf-8',
                    },
                }
            );
        }


        // Fetch the image from Instagram.
        const response = await fetch(
            target.toString(),
            {
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36',

                    'Accept':
                        'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                },
            }
        );


        if (!response.ok) {
            console.error(
                'Instagram image fetch failed:',
                response.status,
                target.hostname
            );

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


        // Copy the upstream headers.
        const headers =
            new Headers(response.headers);


        // Allow the browser/CDN to cache the image.
        headers.set(
            'Cache-Control',
            'public, max-age=3600'
        );


        // Never pass cookies back to the browser.
        headers.delete('set-cookie');


        // Return Instagram's image directly.
        return new Response(
            response.body,
            {
                status: 200,
                headers,
            }
        );


    } catch (err) {

        console.error(
            'Instagram image proxy error:',
            err
        );

        return new Response(
            'Could not load Instagram image.',
            {
                status: 502,
                headers: {
                    'Content-Type':
                        'text/plain; charset=utf-8',
                },
            }
        );
    }
}
