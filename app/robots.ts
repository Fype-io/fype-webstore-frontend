import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getApiBaseUrl, getShopByDomain } from "@/lib/storefront-api";

// Per-tenant robots.txt — domain is resolved from the request host, same as
// the homepage's getHomeData(). Calling headers() opts this route into
// dynamic (per-request) rendering, which is required here: a static build
// has no host to resolve a store from.
export default async function robots(): Promise<MetadataRoute.Robots> {
    const headersList = await headers();
    const host = headersList.get("host") ?? "";
    const domain = host.split(":")[0];
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const baseUrl = `${protocol}://${host}`;

    const apiBaseUrl = await getApiBaseUrl();
    const shop = await getShopByDomain(apiBaseUrl, domain);
    const allowIndexing = shop?.settings?.seo?.allowIndexing !== false;

    if (!allowIndexing) {
        return { rules: { userAgent: "*", disallow: "/" } };
    }

    return {
        rules: { userAgent: "*", allow: "/" },
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
