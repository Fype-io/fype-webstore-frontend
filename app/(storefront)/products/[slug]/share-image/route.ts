// The image link previews (WhatsApp, Facebook, X, LinkedIn...) show for a product: its primary image
// as a 1200x630 JPEG, the product fitted inside on white (never cropped). The product page's og:image
// points here (shareImagePath) instead of at the raw upload, which can be up to 10 MB and WebP/AVIF/SVG.
//
// Only ever serves the primary image of a product of the store on this host, so it can't be used to
// fetch arbitrary URLs. Sits under /products/, so a password-locked store's images stay locked.
import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getApiBaseUrl, getProductDetails, getShopByDomain } from "@/lib/storefront-api";
import { getRequestHost, getRequestOrigin } from "@/lib/request-host";
import { SHARE_IMAGE_SIZE, SHARE_IMAGE_TYPE, shortHash } from "@/lib/product-seo";

const CACHE_SECONDS = 86400;
const JPEG_QUALITY = 80;

function notFound(): Response {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=300" } });
}

/** The Worker's edge cache (caches.default); absent under next dev / tests. */
function edgeCache(): Cache | undefined {
    return (globalThis as { caches?: { default?: Cache } }).caches?.default;
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
    const { slug } = await params;
    const headersList = await headers();

    const apiBaseUrl = await getApiBaseUrl();
    const shop = await getShopByDomain(apiBaseUrl, getRequestHost(headersList));
    if (!shop) return notFound();

    const { product } = await getProductDetails(apiBaseUrl, shop.shopId, slug);
    const source = product?.images?.[0];
    if (!product || !source || !/^https?:\/\//i.test(source)) return notFound();

    // Keyed by the image itself: a changed primary image is converted again, an unchanged one never is.
    const cache = edgeCache();
    const cacheKey = new Request(`${getRequestOrigin(headersList)}/__share-image/${shop.shopId}/${shortHash(source)}`);
    const cached = await cache?.match(cacheKey);
    if (cached) return cached;

    const original = await fetch(source).catch(() => null);
    if (!original?.ok || !original.body) return notFound();

    try {
        const { env } = await getCloudflareContext({ async: true });
        if (!env.IMAGES) throw new Error("IMAGES binding missing");
        const result = await env.IMAGES.input(original.body)
            .transform({ ...SHARE_IMAGE_SIZE, fit: "pad", background: "#FFFFFF" })
            .output({ format: SHARE_IMAGE_TYPE, quality: JPEG_QUALITY, background: "#FFFFFF" });

        const response = new Response(result.image(), {
            headers: { "Content-Type": SHARE_IMAGE_TYPE, "Cache-Control": `public, max-age=${CACHE_SECONDS}` },
        });
        if (cache) await cache.put(cacheKey, response.clone());
        return response;
    } catch (error) {
        // Not convertible (an SVG, say): Facebook and X can still use the original.
        console.warn(
            `[share-image] conversion failed store=${shop.shopId} product=${product.productId}: ${error instanceof Error ? error.message : String(error)}`
        );
        return new Response(null, { status: 302, headers: { Location: source, "Cache-Control": "public, max-age=3600" } });
    }
}
