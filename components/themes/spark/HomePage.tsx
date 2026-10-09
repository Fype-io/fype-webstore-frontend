import type { HomePageProps } from "@/components/themes/registry";
import SparkHome from "./SparkHome";
import { buildSparkNavItems, mergeSparkConfig, sparkDefaultConfig } from "./sparkConfig";
import { getApiBaseUrl, getCollectionById, getCollectionGroup, getCollectionProducts, getProductDetails, getCollectionsByIds } from "@/lib/storefront-api";

// Spark's self-contained Home page — reads the store's real saved
// `themeConfig` (Theme.themeConfig, a Mixed field since Spark's shape
// doesn't fit theme_one's fixed ThemeSections columns) merged onto Spark's
// bundled defaults, so an un-customized store still renders sensible
// placeholder content.
//
// The actual rendering (and the live-editor postMessage draft override) is
// delegated to SparkHome, a Client Component — see MIGRATION_RUNBOOK.md
// Phase 4.5's customization-editor section for the full protocol.
//
// Header, Image Banner, Rich Text, Featured Collection, Featured Product,
// Multicolumn, Image with Text, Collection List, Slideshow, Collapsible
// Content, and Contact Form are wired so far. The remaining section types
// spark.config.json declares (email_signup) and a real Footer aren't ported
// yet.
export default async function HomePage({ shop, navPages, themeConfig }: HomePageProps) {
    // Real bug avoided here: the shop's name is only the *default seed* for
    // logo_text (so an un-customized store shows something sensible), not a
    // permanent override — it must be merged in BELOW themeConfig, otherwise
    // a merchant's explicit logo_text customization would never be visible.
    const shopSeededConfig = mergeSparkConfig(sparkDefaultConfig, {
        sections: { header: { settings: { logo_text: shop.shopName } } },
    });
    const config = mergeSparkConfig(shopSeededConfig, themeConfig);

    const navItems = buildSparkNavItems(navPages);

    // Fetched here (not in app/(storefront)/page.tsx alongside newIn/best-
    // sellers) because which collections/products to fetch is only known
    // after resolving Spark's own config — the generic page-level data
    // loader has no notion of per-theme section config. Body now allows
    // multiple instances of the same section type (Add Section permits
    // duplicates, matching the reference), so each real-data type is
    // fetched per-instance and keyed by that instance's own id — never a
    // single flat value per type.
    const featuredCollectionInstances = config.sections.body.filter(
        (s) => s.type === "featured_collection" && !s.hidden && s.settings.collection_id
    );
    const featuredProductInstances = config.sections.body.filter((s) => s.type === "featured_product" && !s.hidden && s.settings.product_id);
    const collectionListInstances = config.sections.body.filter(
        (s) =>
            s.type === "collection_list" &&
            !s.hidden &&
            (s.settings.source === "group" ? Boolean(s.settings.collection_group_id) : s.settings.collection_ids.length > 0)
    );

    const initialFeaturedCollectionProducts: Record<string, Awaited<ReturnType<typeof getCollectionProducts>>> = {};
    const initialFeaturedCollections: Record<string, Awaited<ReturnType<typeof getCollectionById>>> = {};
    const initialFeaturedProducts: Record<string, Awaited<ReturnType<typeof getProductDetails>>["product"]> = {};
    const initialCollectionListCollections: Record<string, Awaited<ReturnType<typeof getCollectionsByIds>>> = {};

    if (featuredCollectionInstances.length > 0 || featuredProductInstances.length > 0 || collectionListInstances.length > 0) {
        const apiBaseUrl = await getApiBaseUrl();

        await Promise.all([
            ...featuredCollectionInstances.map(async (instance) => {
                if (instance.type !== "featured_collection") return;
                initialFeaturedCollectionProducts[instance.id] = await getCollectionProducts(
                    apiBaseUrl,
                    shop.shopId,
                    instance.settings.collection_id,
                    instance.settings.products_to_show
                );
                initialFeaturedCollections[instance.id] = await getCollectionById(apiBaseUrl, shop.shopId, instance.settings.collection_id);
            }),
            ...featuredProductInstances.map(async (instance) => {
                if (instance.type !== "featured_product") return;
                const result = await getProductDetails(apiBaseUrl, shop.shopId, instance.settings.product_id);
                initialFeaturedProducts[instance.id] = result.product;
            }),
            ...collectionListInstances.map(async (instance) => {
                if (instance.type !== "collection_list") return;
                initialCollectionListCollections[instance.id] =
                    instance.settings.source === "group"
                        ? ((await getCollectionGroup(apiBaseUrl, shop.shopId, instance.settings.collection_group_id ?? ""))?.collections ?? [])
                        : await getCollectionsByIds(apiBaseUrl, shop.shopId, instance.settings.collection_ids);
            }),
        ]);
    }

    return (
        <SparkHome
            initialConfig={config}
            navItems={navItems}
            shop={shop}
            initialFeaturedCollectionProducts={initialFeaturedCollectionProducts}
            initialFeaturedCollections={initialFeaturedCollections}
            initialFeaturedProducts={initialFeaturedProducts}
            initialCollectionListCollections={initialCollectionListCollections}
        />
    );
}
