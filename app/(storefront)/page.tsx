import type { Metadata } from "next";
import { headers } from "next/headers";
import {
    getApiBaseUrl,
    getShopByDomain,
    getTheme,
    getPagesByLocation,
    getNewInCollection,
    getBestSellers,
    getCategories,
} from "@/lib/storefront-api";
import { resolveThemeSlug } from "@/lib/theme";
import ShopNotFound from "@/components/shared/ShopNotFound";
import ThemedHome from "@/components/themes/ThemedHome";

async function getHomeData() {
    const headersList = await headers();
    const host = headersList.get("host") ?? "";
    const domain = host.split(":")[0];

    const apiBaseUrl = await getApiBaseUrl();
    const shop = await getShopByDomain(apiBaseUrl, domain);
    if (!shop) return null;

    const [navPages, footerPages] = await Promise.all([
        getPagesByLocation(apiBaseUrl, shop.shopId, "navigation"),
        getPagesByLocation(apiBaseUrl, shop.shopId, "footer"),
    ]);

    const [theme, newInProducts, bestSellerProducts, categories] = await Promise.all([
        getTheme(apiBaseUrl, shop.shopId),
        getNewInCollection(apiBaseUrl, shop.shopId, 4),
        getBestSellers(apiBaseUrl, shop.shopId, 4),
        getCategories(apiBaseUrl, shop.shopId, false),
    ]);

    // Resolve the registry slug from the live Theme doc's templateId, not
    // shop.themeId (that's the Theme document's own instance id, e.g.
    // "THEME-xxx" — never a registry slug). See ThemeCustomization.templateId
    // for the full explanation; real bug found 2026-07-28 while wiring up
    // Spark's per-store themeConfig persistence.
    return { shop, theme, navPages, footerPages, newInProducts, bestSellerProducts, categories, themeIdForResolution: theme?.templateId };
}

export async function generateMetadata(): Promise<Metadata> {
    const data = await getHomeData();
    const storeName = data?.theme?.navbar?.title || data?.theme?.footer?.title || data?.shop?.shopName || "Store";
    const seo = data?.shop?.settings?.seo;

    const title = seo?.homepageTitle || storeName;
    const description = seo?.homepageDescription;
    const allowIndexing = seo?.allowIndexing !== false;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            images: seo?.socialShareImageUrl ? [{ url: seo.socialShareImageUrl }] : undefined,
        },
        robots: {
            index: allowIndexing,
            follow: allowIndexing,
        },
    };
}

export default async function HomePage() {
    const data = await getHomeData();

    if (!data || !data.theme) {
        return <ShopNotFound />;
    }

    const { shop, theme, navPages, footerPages, newInProducts, bestSellerProducts, categories, themeIdForResolution } = data;
    const themeSlug = resolveThemeSlug(themeIdForResolution);

    return (
        <ThemedHome
            themeSlug={themeSlug}
            shop={shop}
            theme={theme}
            navPages={navPages}
            footerPages={footerPages}
            newInProducts={newInProducts}
            bestSellerProducts={bestSellerProducts}
            categories={categories}
        />
    );
}
