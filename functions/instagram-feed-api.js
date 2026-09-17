// functions/instagram-feed-api.js
//
// Serves the site's live Instagram feed at GET /api/instagram-feed.
//

const KV_KEY = 'ig_token';
const CACHE_KEY = 'ig_feed_cache';
const FEED_TTL_MS = 20 * 60 * 1000;
const REFRESH_MARGIN_MS = 5 * 24 * 60 * 60 * 1000;
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

        // Use the existing cache if it is still fresh.
        const cachedRaw = await kv.get(CACHE_KEY);

        if (cachedRaw) {
            try {
                const cached = JSON.parse(cachedRaw);

                if (
                    Array.isArray(cached.posts) &&
                    cached.fetchedAt &&
                    Date.now() - cached.fetchedAt < FEED_TTL_MS
                ) {
                    return jsonOk(cached.posts);
                }
            } catch (cacheError) {
                console.error(
                    'Instagram cache could not be parsed:',
                    cacheError
                );
            }
        }

        let tokenData = await kv.get(KV_KEY, 'json');

        if (!tokenData || !tokenData.token || !tokenData.userId) {
            return jsonError(
                'Instagram feed is not configured (missing token in KV).',
                500
            );
        }

        // Refresh the long-lived token when it is close to expiry.
        if (
            tokenData.expiresAt &&
            tokenData.expiresAt - Date.now() < REFRESH_MARGIN_MS
        ) {
            tokenData = await refreshToken(tokenData, kv);
        }

        const posts = await fetchRecentMedia(tokenData);

        // Cache the feed, but don't allow a KV caching problem to prevent
        // the actual Instagram response being returned.
        try {
            await kv.put(
                CACHE_KEY,
                JSON.stringify({
                    posts,
                    fetchedAt: Date.now()
                })
            );
        } catch (cacheError) {
            console.error(
                'Could not cache Instagram feed:',
                cacheError
            );
        }

        return jsonOk(posts);

    } catch (err) {
        console.error('Instagram feed error:', err);

        return jsonError(
            `Could not load Instagram feed: ${
                err && err.message
                    ? err.message
                    : String(err)
            }`,
            502
        );
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

        // Keep the existing token.
        return tokenData;
    }

    const data = await res.json();

    if (!data.access_token) {
        console.error(
            'Instagram token refresh returned no access token:',
            data
        );

        return tokenData;
    }

    const updated = {
        token: data.access_token,
        userId: tokenData.userId,
        expiresAt: Date.now() + data.expires_in * 1000
    };

    await kv.put(
        KV_KEY,
        JSON.stringify(updated)
    );

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
        const errorText = await res.text();

        throw new Error(
            `Instagram media fetch failed: ${res.status} ${errorText}`
        );
    }

    const data = await res.json();

    return (data.data || [])
        .filter(
            item =>
                item.media_type !== 'VIDEO' ||
                !!item.thumbnail_url
        )
        .slice(0, MAX_POSTS)
        .map(item => {

            const originalImage =
                item.media_type === 'VIDEO'
                    ? item.thumbnail_url
                    : item.media_url;

            return {
                // IMPORTANT:
                // encodeURIComponent() safely handles Instagram's long
                // URLs and all of their &, ?, = and other characters.
                image:
                    `/api/instagram-image?url=${encodeURIComponent(
                        originalImage
                    )}`,

                link: item.permalink
            };
        });
}


function jsonOk(posts) {
    return new Response(
        JSON.stringify({ posts }),
        {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store'
            }
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
                'Cache-Control': 'no-store'
            }
        }
    );
}
