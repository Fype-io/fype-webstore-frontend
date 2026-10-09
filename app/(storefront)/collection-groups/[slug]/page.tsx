import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getApiBaseUrl, getShopByDomain, getTheme, getPagesByLocation, getCollectionGroup } from "@/lib/storefront-api";
import { loadTheme, resolveThemeSlug } from "@/lib/theme";
import ShopNotFound from "@/components/shared/ShopNotFound";
import { getRequestHost } from "@/lib/request-host";

interface CollectionGroupRouteProps {
    params: Promise<{ slug: string }>;
}

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

export async function generateMetadata({ params }: CollectionGroupRouteProps): Promise<Metadata> {
    const { slug } = await params;
    const data = await getSharedShopData();
    const storeName = data?.theme?.navbar?.title || data?.theme?.footer?.title || data?.shop?.shopName || "Store";
    if (!data) return { title: storeName };

    const detail = await getCollectionGroup(data.apiBaseUrl, data.shop.shopId, slug);
    return { title: detail ? `${detail.group.name} - ${storeName}` : storeName };
}

// A collection group's landing page, e.g. /collection-groups/shop-by-brand.
// Only published groups resolve (drafts and deleted groups 404). Only themes
// that implement CollectionGroupPage (Spark) can serve this route, same
// "not retrofitting theme_one" pattern as collections/[slug].
export default async function CollectionGroupRoute({ params }: CollectionGroupRouteProps) {
    const { slug } = await params;
    const data = await getSharedShopData();
    if (!data || !data.theme) return <ShopNotFound />;

    const { apiBaseUrl, shop, theme, navPages, footerPages } = data;
    const detail = await getCollectionGroup(apiBaseUrl, shop.shopId, slug);
    if (!detail) notFound();

    const themeModule = await loadTheme(resolveThemeSlug(theme.templateId));
    if (!themeModule.CollectionGroupPage) notFound();

    const CollectionGroupPageComponent = themeModule.CollectionGroupPage;
    return (
        <CollectionGroupPageComponent
            shop={shop}
            navPages={navPages}
            footerPages={footerPages}
            group={detail.group}
            collections={detail.collections}
            themeConfig={theme.themeConfig}
        />
    );
}
