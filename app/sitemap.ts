import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getApiBaseUrl, getShopByDomain, getAllProducts, getAllCollections, getAllPages } from "@/lib/storefront-api";

// Per-tenant sitemap.xml, resolved from the request host (same pattern as
// robots.ts and the homepage's getHomeData()). Single page fetched at a high
// limit rather than paginating through every product/collection — fine for
// typical store catalog sizes; a store with more than 500 products or
// collections will have its sitemap truncated to the first page. Revisit
// with real pagination if that turns out to matter in practice.
const CATALOG_LIMIT = 500;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const headersList = await headers();
    const host = headersList.get("host") ?? "";
    const domain = host.split(":")[0];
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const baseUrl = `${protocol}://${host}`;

    const apiBaseUrl = await getApiBaseUrl();
    const shop = await getShopByDomain(apiBaseUrl, domain);
    if (!shop) {
        return [{ url: baseUrl, lastModified: new Date() }];
    }

    const [productsResult, collectionsResult, pages] = await Promise.all([
        getAllProducts(apiBaseUrl, shop.shopId, { limit: CATALOG_LIMIT }),
        getAllCollections(apiBaseUrl, shop.shopId, { limit: CATALOG_LIMIT }),
        getAllPages(apiBaseUrl, shop.shopId),
    ]);

    const now = new Date();

    return [
        { url: baseUrl, lastModified: now, priority: 1 },
        ...productsResult.products.map(
            (product): MetadataRoute.Sitemap[number] => ({
                url: `${baseUrl}/products/${product.productId}`,
                lastModified: now,
            })
        ),
        ...collectionsResult.collections.map(
            (collection): MetadataRoute.Sitemap[number] => ({
                url: `${baseUrl}/collections/${collection.slug}`,
                lastModified: now,
            })
        ),
        ...pages
            .filter((page) => page.status === "visible" && page.isActive)
            .map(
                (page): MetadataRoute.Sitemap[number] => ({
                    url: `${baseUrl}/${page.slug}`,
                    lastModified: now,
                })
            ),
    ];
}
