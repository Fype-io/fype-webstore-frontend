import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getApiBaseUrl, getShopByDomain, getTheme, getPagesByLocation, getCollectionTiles, getAllCollections, getCollectionGroup } from "@/lib/storefront-api";
import { loadTheme, resolveThemeSlug } from "@/lib/theme";
import ShopNotFound from "@/components/shared/ShopNotFound";
import { getRequestHost } from "@/lib/request-host";
import type { CollectionTile } from "@/types/storefront";

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

interface CollectionsPageRouteProps {
    // ?group=<collection group id or slug> narrows the page to that group's collections.
    searchParams: Promise<{ group?: string }>;
}

export async function generateMetadata({ searchParams }: CollectionsPageRouteProps): Promise<Metadata> {
    const { group } = await searchParams;
    const data = await getSharedShopData();
    const storeName = data?.theme?.navbar?.title || data?.theme?.footer?.title || data?.shop?.shopName || "Store";
    const detail = group && data ? await getCollectionGroup(data.apiBaseUrl, data.shop.shopId, group) : null;
    return { title: `${detail?.group.name ?? "Collections"} - ${storeName}` };
}

// Only themes that implement CollectionsPage (Spark) can serve this route —
// same "not retrofitting theme_one" pattern as collections/[slug]/page.tsx.
export default async function CollectionsPageRoute({ searchParams }: CollectionsPageRouteProps) {
    const { group: groupParam } = await searchParams;
    const data = await getSharedShopData();
    if (!data || !data.theme) return <ShopNotFound />;

    const { apiBaseUrl, shop, theme, navPages, footerPages } = data;
    // A group filter lists only that group's collections (all of them; the page reveals them a chunk
    // at a time); an unknown or unpublished group is a 404. Otherwise: groups and standalone
    // collections, the first chunk here and the rest loaded as the visitor scrolls.
    const detail = groupParam ? await getCollectionGroup(apiBaseUrl, shop.shopId, groupParam) : null;
    if (groupParam && !detail) notFound();
    const groupTiles: CollectionTile[] | null = detail ? detail.collections.map((c) => ({ ...c, kind: "collection" as const })) : null;
    let firstChunk = groupTiles ? null : await getCollectionTiles(apiBaseUrl, shop.shopId, { limit: 12 });
    if (firstChunk && firstChunk.tiles.length === 0) {
        // Nothing came back: a store with no collections, or a backend that does not have the tiles
        // endpoint yet (storefront deployed first). The plain collections list covers both.
        const plain = await getAllCollections(apiBaseUrl, shop.shopId, { limit: 100 });
        firstChunk = { tiles: plain.collections.map((c) => ({ ...c, kind: "collection" as const })), hasNextPage: false };
    }
    const collections = groupTiles ?? firstChunk?.tiles ?? [];

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
            hasMore={firstChunk?.hasNextPage ?? false}
            {...(detail ? { group: { name: detail.group.name, ...(detail.group.description ? { description: detail.group.description } : {}) } } : {})}
            themeConfig={theme.themeConfig}
        />
    );
}
