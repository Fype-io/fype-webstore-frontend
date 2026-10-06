import type { ComponentType } from "react";
import type {
    Category,
    CollectionSummary,
    Page,
    PaginationMeta,
    ProductDetail,
    ProductVariant,
    ShopIdentity,
    StorefrontProduct,
    VariantOptions,
} from "@/types/storefront";

// Dumb lookup table: themeSlug -> dynamic import of the theme's whole module.
// Keep it dumb — see storefront-multi-theme-architecture.md §4 on why this
// stays a plain object instead of growing into a plugin system.
export type ThemeSlug = "spark";

export type ThemeModule = typeof import("./theme_one");

// Props for a theme's self-contained Home page component. Real store/catalog
// data is the same shape for every theme (it's not config-shaped); each
// theme's own visual/section config is NOT passed through here — a theme
// reads its own bundled defaults (see spark/sparkDefaultConfig.ts) or, once
// per-store persistence exists, its own saved config internally.
export interface HomePageProps {
    shop: ShopIdentity;
    navPages: Page[];
    footerPages: Page[];
    newInProducts: StorefrontProduct[];
    bestSellerProducts: StorefrontProduct[];
    categories: Category[];
    // Generic per-theme config override (e.g. Spark's Theme.themeConfig) —
    // undefined means "use the theme's bundled defaults."
    themeConfig?: Record<string, unknown>;
}

// Props for a theme's self-contained Products (PLP) page.
export interface ProductsPageProps {
    shop: ShopIdentity;
    navPages: Page[];
    footerPages: Page[];
    categories: Category[];
    products: StorefrontProduct[];
    pagination?: PaginationMeta | null;
    searchParams: {
        category?: string;
        minPrice?: string;
        maxPrice?: string;
        sortBy?: string;
        search?: string;
        page?: string;
    };
    themeConfig?: Record<string, unknown>;
}

// Props for a theme's self-contained Product Details (PDP) page.
export interface ProductDetailsPageProps {
    shop: ShopIdentity;
    navPages: Page[];
    footerPages: Page[];
    allPages?: Page[];
    product: ProductDetail | null;
    variants: ProductVariant[];
    variantOptions: VariantOptions | null;
    relatedProducts: StorefrontProduct[];
    themeConfig?: Record<string, unknown>;
}

// Props for a theme's self-contained Collection (single-collection listing)
// page — new with Spark's Collection List section; theme_one has no
// concept of this yet (same "not retrofitting theme_one" pattern already
// used elsewhere), so a theme without CollectionPage 404s at the route
// level instead of falling back to a generic implementation.
export interface CollectionPageProps {
    shop: ShopIdentity;
    navPages: Page[];
    footerPages: Page[];
    collection: CollectionSummary;
    products: StorefrontProduct[];
    themeConfig?: Record<string, unknown>;
}

// Props for a theme's self-contained Collections (list-all-collections)
// page — storefront equivalent of ProductsPage but for collections. Same
// "not retrofitting theme_one" pattern as CollectionPage: a theme without
// CollectionsPage 404s at the route level.
export interface CollectionsPageProps {
    shop: ShopIdentity;
    navPages: Page[];
    footerPages: Page[];
    collections: CollectionSummary[];
    pagination?: PaginationMeta | null;
    themeConfig?: Record<string, unknown>;
}

// A theme beyond theme_one may only implement a subset of ThemeModule's shape
// — e.g. a brand-new HomePage using a genuinely different config schema (see
// MIGRATION_RUNBOOK.md Phase 4 decision #2: "each theme owns an arbitrary,
// theme-specific config schema"). loadTheme() in lib/theme.ts merges whatever
// a theme actually exports onto theme_one as a baseline, so anything that
// theme hasn't implemented yet (Header/Footer/ProductGrid/...) still renders
// via theme_one instead of crashing — a real store on a partially-built theme
// gets a visually-inconsistent page for the unbuilt parts, not a broken one.
export type PartialThemeModule = Partial<ThemeModule> & {
    HomePage?: ComponentType<HomePageProps>;
    ProductsPage?: ComponentType<ProductsPageProps>;
    ProductDetailsPage?: ComponentType<ProductDetailsPageProps>;
    CollectionPage?: ComponentType<CollectionPageProps>;
    CollectionsPage?: ComponentType<CollectionsPageProps>;
};

// What loadTheme() in lib/theme.ts actually returns after merging a theme
// onto the theme_one baseline: every theme_one field is guaranteed present
// (from the baseline), plus whichever optional extras (like HomePage) the
// requested theme itself overrides.
export type ResolvedThemeModule = ThemeModule & {
    HomePage?: ComponentType<HomePageProps>;
    ProductsPage?: ComponentType<ProductsPageProps>;
    ProductDetailsPage?: ComponentType<ProductDetailsPageProps>;
    CollectionPage?: ComponentType<CollectionPageProps>;
    CollectionsPage?: ComponentType<CollectionsPageProps>;
};

export const themeRegistry: Record<ThemeSlug, () => Promise<PartialThemeModule>> = {
    spark: () => import("./spark"),
};

// To add a theme: add its slug to ThemeSlug and an entry here. A store selects
// a theme via its Theme document's templateId (see resolveThemeSlug).

// theme_one is not a selectable theme — its module is only the component
// baseline loadTheme() merges the selected theme onto, for anything that theme
// hasn't built yet.
export const loadBaseThemeModule = (): Promise<ThemeModule> => import("./theme_one");
