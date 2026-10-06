import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getApiBaseUrl, getShopByDomain, getTheme, getPagesByLocation, getCollectionBySlug, getCollectionProducts } from "@/lib/storefront-api";
import { loadTheme, resolveThemeSlug } from "@/lib/theme";
import ShopNotFound from "@/components/shared/ShopNotFound";
import { getRequestHost } from "@/lib/request-host";
import { isVerifiedEditorPreview } from "@/lib/editor-preview-server";

interface CollectionPageRouteProps {
    params: Promise<{ slug: string }>;
}

const PLACEHOLDER_COLLECTION_IMAGE =
    "https://i0.wp.com/mikeyarce.com/wp-content/uploads/2021/09/woocommerce-placeholder.png?ssl=1";

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

export async function generateMetadata({ params }: CollectionPageRouteProps): Promise<Metadata> {
    const { slug } = await params;
    const data = await getSharedShopData();
    const storeName = data?.theme?.navbar?.title || data?.theme?.footer?.title || data?.shop?.shopName || "Store";
    if (!data) return { title: storeName };

    const collection = await getCollectionBySlug(data.apiBaseUrl, data.shop.shopId, slug);
    return { title: collection ? `${collection.name} - ${storeName}` : storeName };
}

// New with Collection List's real tile links (the reference has no
// equivalent page — its own onCollectionClick has no real destination).
// Only themes that implement CollectionPage (Spark) can serve this route —
// same "not retrofitting theme_one" pattern as every other Spark-only
// addition in this codebase; theme_one 404s here rather than falling back
// to a generic implementation nothing asked for.
export default async function CollectionPageRoute({ params }: CollectionPageRouteProps) {
    const { slug } = await params;
    const data = await getSharedShopData();

    if (!data || !data.theme) return <ShopNotFound />;

    const { apiBaseUrl, shop, theme, navPages, footerPages } = data;
    const collection = await getCollectionBySlug(apiBaseUrl, shop.shopId, slug);

    // Real customer traffic 404s exactly as before when the slug doesn't
    // match a real collection. The verified editor iframe instead
    // gets a synthesized placeholder so a store with zero collections can
    // still customize the Collection Page's layout/banner before creating
    // one — same "isEditorPreview placeholder" convention already used by
    // FeaturedCollection.tsx/CollectionList.tsx/FeaturedProduct.tsx, just at
    // the whole-route level since this page has no real data to fall back
    // into otherwise. A real collection always wins the lookup above, so
    // this can never shadow an actual store collection.
    if (!collection && !(await isVerifiedEditorPreview(shop.shopId))) notFound();

    const resolvedCollection = collection ?? {
        _id: "placeholder-collection",
        name: "Sample Collection",
        slug,
        thumbnailUrl: PLACEHOLDER_COLLECTION_IMAGE,
    };

    const products = collection ? await getCollectionProducts(apiBaseUrl, shop.shopId, collection._id, 100) : [];

    const themeSlug = resolveThemeSlug(theme.templateId);
    const themeModule = await loadTheme(themeSlug);
    if (!themeModule.CollectionPage) notFound();

    const CollectionPageComponent = themeModule.CollectionPage;
    return (
        <CollectionPageComponent
            shop={shop}
            navPages={navPages}
            footerPages={footerPages}
            collection={resolvedCollection}
            products={products}
            themeConfig={theme.themeConfig}
        />
    );
}
