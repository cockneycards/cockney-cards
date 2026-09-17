// _worker.js
//
// Cloudflare Workers entry point.
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


const POST_ROUTES = {
    '/create-checkout': createCheckout,
    '/create-checkout-print': createCheckoutPrint,
    '/create-checkout-basket': createCheckoutBasket,
    '/stripe-webhook': stripeWebhook,
    '/create-payment-intent-basket': createPaymentIntentBasket,
};


const REMINDER_ID_PATTERN =
    /^\/api\/reminders\/([a-f0-9-]+)$/;

const ADDRESS_ID_PATTERN =
    /^\/api\/addresses\/([a-f0-9-]+)$/;

const ADDRESS_DEFAULT_PATTERN =
    /^\/api\/addresses\/([a-f0-9-]+)\/default$/;


export default {

    async fetch(request, env, ctx) {

        const url = new URL(request.url);
        const { pathname } = url;
        const method = request.method;


        // CORS preflight.
        if (method === 'OPTIONS') {
            return new Response(null, {
                headers: corsHeaders(env)
            });
        }


        // Stripe configuration.
        if (
            pathname === '/stripe-config' &&
            method === 'GET'
        ) {
            return stripeConfig({
                request,
                env,
                waitUntil: ctx.waitUntil.bind(ctx)
            });
        }


        // POST routes.
        const postHandler = POST_ROUTES[pathname];

        if (postHandler && method === 'POST') {
            return postHandler({
                request,
                env,
                waitUntil: ctx.waitUntil.bind(ctx)
            });
        }


        // Authentication.
        if (
            pathname === '/api/auth/signup' &&
            method === 'POST'
        ) {
            return handleSignup(request, env);
        }


        if (
            pathname === '/api/auth/login' &&
            method === 'POST'
        ) {
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


        // Orders.
        if (
            pathname === '/api/orders' &&
            method === 'GET'
        ) {
            return handleGetOrders(request, env);
        }


        // Account.
        if (
            pathname === '/api/account' &&
            method === 'GET'
        ) {
            return handleGetAccount(request, env);
        }


        // Instagram feed.
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


        // Delete account.
        if (
            pathname === '/api/account' &&
            method === 'DELETE'
        ) {
            return handleDeleteAccount(request, env);
        }


        // Referrals.
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


        // Membership.
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


        // Promo.
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


        // Everything else is a static asset.
        return env.ASSETS.fetch(request);
    },


    // Daily reminder cron.
    async scheduled(event, env, ctx) {
        ctx.waitUntil(
            runDailyReminderCheck(env)
        );
    }
};


/*
 * ============================================================
 * Instagram image proxy
 * ============================================================
 */

async function handleInstagramImage(request) {

    try {

        const requestUrl = new URL(request.url);

        // URLSearchParams automatically decodes the value that was
        // encoded with encodeURIComponent() by instagram-feed-api.js.
        const imageUrl =
            requestUrl.searchParams.get('url');


        if (!imageUrl) {
            return new Response(
                'Missing image URL.',
                {
                    status: 400,
                    headers: {
                        'Content-Type':
                            'text/plain; charset=utf-8'
                    }
                }
            );
        }


        let target;

        try {
            target = new URL(imageUrl);
        } catch (err) {
            return new Response(
                'Invalid image URL.',
                {
                    status: 400,
                    headers: {
                        'Content-Type':
                            'text/plain; charset=utf-8'
                    }
                }
            );
        }


        // Only permit HTTPS.
        if (target.protocol !== 'https:') {
            return new Response(
                'Image host not allowed.',
                {
                    status: 403,
                    headers: {
                        'Content-Type':
                            'text/plain; charset=utf-8'
                    }
                }
            );
        }


        const hostname =
            target.hostname.toLowerCase();


        const allowedHosts = [
            'cdninstagram.com',
            'fbcdn.net',
            'instagram.com'
        ];


        const allowed =
            allowedHosts.some(
                host =>
                    hostname === host ||
                    hostname.endsWith(`.${host}`)
            );


        if (!allowed) {
            return new Response(
                'Image host not allowed.',
                {
                    status: 403,
                    headers: {
                        'Content-Type':
                            'text/plain; charset=utf-8'
                    }
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
                        'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
                }
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
                        'Content-Type':
                            'text/plain; charset=utf-8'
                    }
                }
            );
        }


        const headers =
            new Headers(response.headers);


        headers.set(
            'Cache-Control',
            'public, max-age=3600'
        );


        // Don't expose cookies.
        headers.delete('set-cookie');


        return new Response(
            response.body,
            {
                status: 200,
                headers
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
                        'text/plain; charset=utf-8'
                }
            }
        );
    }
}
