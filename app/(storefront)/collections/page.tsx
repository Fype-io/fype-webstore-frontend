import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getApiBaseUrl, getShopByDomain, getTheme, getPagesByLocation, getAllCollections } from "@/lib/storefront-api";
import { loadTheme, resolveThemeSlug } from "@/lib/theme";
import ShopNotFound from "@/components/shared/ShopNotFound";
import { getRequestHost } from "@/lib/request-host";

async function getSharedShopData() {
    const headersList = await headers();
    const domain = getRequestHost(headersList);

    const apiBaseUrl = await getApiBaseUrl();
    const shop = await getShopByDomain(apiBaseUrl, domain);
    if (!shop) return null;

    const [theme, navPages, footerPages] = await Promise.all([
        getTheme(apiBaseUrl, shop.shopId),
        getPagesByLocation(apiBaseUrl, shop.shopId, "navigation"),
        getPagesByLocation(apiBaseUrl, shop.shopId, "footer"),
    ]);

    return { apiBaseUrl, shop, theme, navPages, footerPages };
}

export async function generateMetadata(): Promise<Metadata> {
    const data = await getSharedShopData();
    const storeName = data?.theme?.navbar?.title || data?.theme?.footer?.title || data?.shop?.shopName || "Store";
    return { title: `Collections - ${storeName}` };
}

// Only themes that implement CollectionsPage (Spark) can serve this route —
// same "not retrofitting theme_one" pattern as collections/[slug]/page.tsx.
export default async function CollectionsPageRoute() {
    const data = await getSharedShopData();
    if (!data || !data.theme) return <ShopNotFound />;

    const { apiBaseUrl, shop, theme, navPages, footerPages } = data;
    const { collections, pagination } = await getAllCollections(apiBaseUrl, shop.shopId, { limit: 100 });

    const themeSlug = resolveThemeSlug(theme.templateId);
    const themeModule = await loadTheme(themeSlug);
    if (!themeModule.CollectionsPage) notFound();

    const CollectionsPageComponent = themeModule.CollectionsPage;
    return (
        <CollectionsPageComponent
            shop={shop}
            navPages={navPages}
            footerPages={footerPages}
            collections={collections}
            pagination={pagination}
            themeConfig={theme.themeConfig}
        />
    );
}
