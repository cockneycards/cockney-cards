// functions/instagram-feed-api.js
//
// Serves the site's live Instagram feed at GET /api/instagram-feed.
// Wired into _worker.js like the other account-api.js handlers.
//
// ONE-TIME SETUP (already done if you've followed the setup steps):
//   1. Create a KV namespace bound as CC_KV in wrangler.jsonc.
//   2. Seed it with your long-lived Instagram token:
//        npx wrangler kv key put --namespace-id=<ID> "ig_token" \
//          '{"token":"...","userId":"...","expiresAt":<ms-timestamp>}'
//
// After that, every request checks whether the token is within 5 days of
// expiring and refreshes it automatically — no cron trigger needed, and
// no manual renewal every 60 days.

const KV_KEY = 'ig_token';
const CACHE_KEY = 'ig_feed_cache';
const FEED_TTL_MS = 20 * 60 * 1000; // re-fetch from Instagram at most every 20 minutes
const REFRESH_MARGIN_MS = 5 * 24 * 60 * 60 * 1000; // refresh if <5 days from expiry
const MAX_POSTS = 8;

export async function handleGetInstagramFeed(request, env) {
    try {
        const kv = env.CC_KV;
        if (!kv) {
            return jsonError('Instagram feed is not configured (missing CC_KV binding).', 500);
        }

        // Serve from cache if it's fresh — avoids hammering Instagram's API
        // on every page load.
        const cachedRaw = await kv.get(CACHE_KEY);
        if (cachedRaw) {
            const cached = JSON.parse(cachedRaw);
            if (Date.now() - cached.fetchedAt < FEED_TTL_MS) {
                return jsonOk(cached.posts);
            }
        }

        let tokenData = await kv.get(KV_KEY, 'json');
        if (!tokenData || !tokenData.token || !tokenData.userId) {
            return jsonError('Instagram feed is not configured (missing token in KV).', 500);
        }

        // Refresh the long-lived token if it's getting close to expiry.
        if (tokenData.expiresAt - Date.now() < REFRESH_MARGIN_MS) {
            tokenData = await refreshToken(tokenData, kv);
        }

        const posts = await fetchRecentMedia(tokenData);

        await kv.put(CACHE_KEY, JSON.stringify({ posts, fetchedAt: Date.now() }));

        return jsonOk(posts);
    } catch (err) {
        console.error('Instagram feed error:', err);
        // Serve stale cache rather than nothing, if we have it.
        try {
            const cachedRaw = await env.CC_KV.get(CACHE_KEY);
            if (cachedRaw) {
                return jsonOk(JSON.parse(cachedRaw).posts);
            }
        } catch (_) {
            // fall through to the error response below
        }
        return jsonError('Could not load Instagram feed.', 502);
    }
}

async function refreshToken(tokenData, kv) {
    const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(tokenData.token)}`;
    const res = await fetch(url);
    if (!res.ok) {
        // Refresh failed — keep using the existing token until it actually
        // expires rather than breaking the feed over a transient error.
        console.error('Instagram token refresh failed:', await res.text());
        return tokenData;
    }
    const data = await res.json();
    const updated = {
        token: data.access_token,
        userId: tokenData.userId,
        expiresAt: Date.now() + data.expires_in * 1000,
    };
    await kv.put(KV_KEY, JSON.stringify(updated));
    return updated;
}

async function fetchRecentMedia(tokenData) {
    const fields = 'id,caption,media_type,media_url,permalink,thumbnail_url';
    const url = `https://graph.instagram.com/${tokenData.userId}/media?fields=${fields}&limit=${MAX_POSTS}&access_token=${encodeURIComponent(tokenData.token)}`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Instagram media fetch failed: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();

    return (data.data || [])
        .filter((item) => item.media_type !== 'VIDEO' || item.thumbnail_url) // need something image-like to show
        .slice(0, MAX_POSTS)
        .map((item) => ({
            image: item.media_type === 'VIDEO' ? item.thumbnail_url : item.media_url,
            link: item.permalink,
        }));
}

function jsonOk(posts) {
    return new Response(JSON.stringify({ posts }), {
        headers: { 'Content-Type': 'application/json' },
    });
}

function jsonError(message, status) {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}
