import type { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";

// OpenNext's IncrementalCache interface, taken from a public export rather than
// from @opennextjs/aws (a transitive dependency).
export type IncrementalCache = Parameters<typeof withRegionalCache>[0];

// Oldest cached fetch data ever shown. In dynamic pages Next.js returns an
// expired fetch entry and refreshes it in the background
// (next/dist/server/lib/patch-fetch.js, "isStale"), so on a quiet store the
// first visitor after a long gap would see data as old as the last fetch -
// days, possibly. Past this age the entry counts as a miss, so it's fetched
// fresh while that visitor waits. Within it, the usual revalidate windows
// (lib/storefront-api.ts) apply.
export const MAX_CACHE_AGE_MS = 10 * 60 * 1000;

// Wraps the incremental cache so a fetch entry older than maxAgeMs is a miss.
// Sits outside the regional cache, whose hits never reach the store behind it,
// so the cap applies to every read. Keeps the store's name: deploys pick the
// cache to populate by it (populate-cache.js).
export function withMaxAge(
    cache: IncrementalCache,
    maxAgeMs: number = MAX_CACHE_AGE_MS,
    now: () => number = Date.now
): IncrementalCache {
    return {
        name: cache.name,
        get: async (key, cacheType) => {
            const entry = await cache.get(key, cacheType);
            if (
                entry &&
                cacheType === "fetch" &&
                typeof entry.lastModified === "number" &&
                now() - entry.lastModified > maxAgeMs
            ) {
                return null;
            }
            return entry;
        },
        set: (key, value, cacheType) => cache.set(key, value, cacheType),
        delete: (key) => cache.delete(key),
    };
}
