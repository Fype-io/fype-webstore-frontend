import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import { withMaxAge } from "./lib/cache/max-age-incremental-cache";

// Next's fetch Data Cache (the `revalidate` windows in lib/storefront-api.ts),
// stored in R2 (binding NEXT_INC_CACHE_R2_BUCKET in wrangler.jsonc) with the
// per-location Cache API in front - OpenNext's recommended setup
// (https://opennext.js.org/cloudflare/caching). Before this the default
// "dummy" cache made every revalidate a no-op: every page view refetched
// everything from the API.
//
// - The store, its theme and the publish state are fetched with
//   cache: "no-store", so they're never cached.
// - No queue: it only refreshes whole cached pages, and every route here is
//   dynamic. No tag cache: nothing calls revalidateTag/revalidatePath. Add both
//   if either changes.
// - bypassTagCacheOnCacheHit: no tag cache to consult, and it stops a
//   background R2 read on every regional hit.
// - withMaxAge outermost, so the 10-minute cap covers regional hits too.
// - An R2 failure is logged and treated as a miss: the page fetches from the API.
export default defineCloudflareConfig({
    incrementalCache: withMaxAge(
        withRegionalCache(r2IncrementalCache, {
            mode: "long-lived",
            bypassTagCacheOnCacheHit: true,
        })
    ),
});
