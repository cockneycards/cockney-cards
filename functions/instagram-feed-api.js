// functions/instagram-feed-api.js
//
// Serves the site's live Instagram feed at GET /api/instagram-feed.
// Instagram image URLs are converted into safe proxy URLs so the browser
// never has to pass the long Instagram CDN URL through a query string.
//

const KV_KEY = 'ig_token';

// Versioned cache key so the new image-proxy format is picked up immediately.
const CACHE_KEY = 'ig_feed_cache_v2';

const FEED_TTL_MS = 20 * 60 * 1000; // re-fetch from Instagram at most every 20 minutes
const REFRESH_MARGIN_MS = 5 * 24 * 60 * 60 * 1000; // refresh if <5 days from expiry
const MAX_POSTS = 8;

export async function handleGetInstagramFeed(request, env) {
    try {
        const kv = env.CC_KV;

        if (!kv) {
            return jsonError(
                'Instagram feed is not configured (missing CC_KV binding).',
                500
            );
        }

        // Serve from cache if it is fresh.
        const cachedRaw = await kv.get(CACHE_KEY);

        if (cachedRaw) {
            const cached = JSON.parse(cachedRaw);

            if (
                Array.isArray(cached.posts) &&
                cached.fetchedAt &&
                Date.now() - cached.fetchedAt < FEED_TTL_MS
            ) {
                return jsonOk(cached.posts);
            }
        }

        // Get the stored Instagram token.
        let tokenData = await kv.get(KV_KEY, 'json');

        if (!tokenData || !tokenData.token || !tokenData.userId) {
            return jsonError(
                'Instagram feed is not configured (missing token in KV).',
                500
            );
        }

        // Refresh the long-lived token if it is getting close to expiry.
        if (
            tokenData.expiresAt &&
            tokenData.expiresAt - Date.now() < REFRESH_MARGIN_MS
        ) {
            tokenData = await refreshToken(tokenData, kv);
        }

        // Fetch the latest Instagram media.
        const posts = await fetchRecentMedia(tokenData);

        // Store the new feed in KV.
        await kv.put(
            CACHE_KEY,
            JSON.stringify({
                posts,
                fetchedAt: Date.now(),
            })
        );

        return jsonOk(posts);

    } catch (err) {
        console.error('Instagram feed error:', err);

        // If Instagram temporarily fails, try to serve the last successful
        // version from cache.
        try {
            const cachedRaw = await env.CC_KV.get(CACHE_KEY);

            if (cachedRaw) {
                const cached = JSON.parse(cachedRaw);

                if (Array.isArray(cached.posts)) {
                    return jsonOk(cached.posts);
                }
            }
        } catch (_) {
            // Fall through to the error response.
        }

        return jsonError('Could not load Instagram feed.', 502);
    }
}


async function refreshToken(tokenData, kv) {
    const url =
        `https://graph.instagram.com/refresh_access_token` +
        `?grant_type=ig_refresh_token` +
        `&access_token=${encodeURIComponent(tokenData.token)}`;

    const res = await fetch(url);

    if (!res.ok) {
        console.error(
            'Instagram token refresh failed:',
            await res.text()
        );

        // Keep using the existing token rather than breaking the feed.
        return tokenData;
    }

    const data = await res.json();

    if (!data.access_token || !data.expires_in) {
        console.error(
            'Instagram token refresh returned an unexpected response:',
            data
        );

        return tokenData;
    }

    const updated = {
        token: data.access_token,
        userId: tokenData.userId,
        expiresAt: Date.now() + data.expires_in * 1000,
    };

    await kv.put(KV_KEY, JSON.stringify(updated));

    return updated;
}


async function fetchRecentMedia(tokenData) {
    const fields =
        'id,caption,media_type,media_url,permalink,thumbnail_url';

    const url =
        `https://graph.instagram.com/${tokenData.userId}/media` +
        `?fields=${fields}` +
        `&limit=${MAX_POSTS}` +
        `&access_token=${encodeURIComponent(tokenData.token)}`;

    const res = await fetch(url);

    if (!res.ok) {
        throw new Error(
            `Instagram media fetch failed: ${res.status} ${await res.text()}`
        );
    }

    const data = await res.json();

    if (!Array.isArray(data.data)) {
        return [];
    }

    return data.data
        // Videos need a thumbnail because the website gallery displays images.
        .filter(
            (item) =>
                item.media_type !== 'VIDEO' || !!item.thumbnail_url
        )
        .slice(0, MAX_POSTS)
        .map((item) => {
            const originalImage =
                item.media_type === 'VIDEO'
                    ? item.thumbnail_url
                    : item.media_url;

            return {
                // IMPORTANT:
                // The browser receives a short, safe URL rather than the
                // enormous Instagram CDN URL containing lots of & characters.
                image: createImageProxyUrl(originalImage),

                // Keep the actual Instagram post link.
                link: item.permalink,
            };
        });
}


/*
 * Convert the Instagram CDN URL into a safe base64url value.
 *
 * Example:
 *
 * https://scontent...jpg?...&...
 *
 * becomes:
 *
 * /api/instagram-image?u=...
 *
 * This avoids problems caused by Instagram URLs containing &, ?, =, etc.
 */
function createImageProxyUrl(imageUrl) {
    if (!imageUrl) {
        return '';
    }

    try {
        const encoded = btoa(imageUrl)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/g, '');

        return `/api/instagram-image?u=${encoded}`;

    } catch (err) {
        console.error('Could not encode Instagram image URL:', err);
        return '';
    }
}


function jsonOk(posts) {
    return new Response(
        JSON.stringify({ posts }),
        {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
            },
        }
    );
}


function jsonError(message, status) {
    return new Response(
        JSON.stringify({ error: message }),
        {
            status,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
            },
        }
    );
}
