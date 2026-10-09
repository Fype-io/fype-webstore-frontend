import type { CollectionGroupPageProps } from "@/components/themes/registry";
import SparkCollections from "./SparkCollections";
import { buildSparkNavItems, mergeSparkConfig, sparkDefaultConfig } from "./sparkConfig";

// Spark's collection group landing page (for example "Shop by brand"): the
// group's name and description over a grid of its collections, laid out like
// the Collections page so tiles look the same.
export default function CollectionGroupPage({ shop, navPages, group, collections, themeConfig }: CollectionGroupPageProps) {
    const config = mergeSparkConfig(sparkDefaultConfig, themeConfig);
    const navItems = buildSparkNavItems(navPages);

    return (
        <SparkCollections
            initialConfig={config}
            shop={shop}
            navItems={navItems}
            collections={collections}
            heading={group.name}
            subheading={group.description ?? ""}
        />
    );
}
