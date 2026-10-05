export interface ThemeSection {
    id: string;
    title: string;
    enabled: boolean;
    images?: string[];
    order?: number;
}

export interface NavbarCustomization {
    title?: string;
    logoUrl?: string;
    displayType?: "title" | "logo" | "logo-title";
}

export interface FooterCustomization {
    title?: string;
    description?: string;
    displayType?: "title" | "logo" | "logo-title";
    logoUrl?: string;
    socialLinks?: {
        instagram?: string;
        facebook?: string;
        twitter?: string;
        linkedin?: string;
    };
}

export interface ThemeSections {
    heroBanner?: ThemeSection;
    newInStore?: ThemeSection;
    categories?: ThemeSection;
    bestSellers?: ThemeSection;
    reviews?: ThemeSection;
    footerSection?: ThemeSection;
}

export interface ThemeCustomization {
    themeId?: string;
    // Which registry theme slug ("theme_one" | "spark") this store's live
    // Theme doc was copied from (set by crmApp's applyTemplate). NOT the same
    // as themeId above (this Theme document's own instance id) — use this
    // field, not shop.themeId, to resolve which theme registry entry to
    // render for a real (non-preview) store.
    templateId?: string;
    storeId: string;
    scrollingText: string;
    enableScrollingText: boolean;
    sections: ThemeSections;
    footerText: string;
    footerLinks?: Array<{ label: string; url: string }>;
    navbar?: NavbarCustomization;
    footer?: FooterCustomization;
    // Generic per-theme config blob for themes whose shape doesn't fit the
    // fixed ThemeSections columns above (e.g. Spark). Undefined means "use
    // the theme's bundled defaults" — only merchant overrides live here.
    themeConfig?: Record<string, unknown>;
}

// Marketplace catalog entry (Phase 5 backend) — only the fields the storefront's
// preview mode actually needs. `defaultConfig` (colors/typography/layout) is
// deliberately omitted: theme_one's real rendering never reads those fields
// (confirmed against ThemeCustomization above), so preview mode uses
// `availableSections` (which sections to show) plus each theme's own bundled
// previewData.ts for actual visual content, not defaultConfig.
export interface ThemeTemplate {
    templateId: string;
    name: string;
    isActive: boolean;
    version: string;
    availableSections: Record<string, boolean>;
}

export interface Page {
    _id: string;
    title: string;
    slug: string;
    pageType: "generic" | "terms-policy";
    visibility: "navigation" | "footer" | "both";
    status: "visible" | "hidden";
    isActive: boolean;
}

export interface PageDetail {
    title: string;
    slug: string;
    content: string;
}

export interface TaxSettings {
    global?: boolean;
    rate?: number;
    label?: string;
    inclusivePricing?: { webstore?: boolean; manual?: boolean };
}

export interface ShopIdentity {
    shopId: string;
    shopName: string;
    domain?: string;
    subdomain?: string;
    themeId?: string;
    isActive: boolean;
    isPublished?: boolean;
    settings?: {
        // The store's currency (INR/USD/AED); null when the store hasn't set one.
        currency?: string | null;
        tax?: TaxSettings;
        marketing?: {
            metaPixel?: { enabled?: boolean; pixelId?: string };
            googleTagManager?: { enabled?: boolean; containerId?: string };
        };
        // Narrowed, secret-free shape — see getPublicStoreSettings() in the
        // backend's store.controller.ts, which redacts payment/logistics
        // provider credentials before this ever reaches the public storefront.
        payment?: {
            active?: string[];
            razorpay?: { enabled?: boolean; keyId?: string };
            stripe?: { enabled?: boolean; publishableKey?: string };
            // Cash on delivery; enabled null = never saved (legacy rule).
            cod?: { enabled?: boolean | null; minOrderValue?: number | null };
        };
        logistics?: {
            active?: string[];
            dtdc?: { enabled?: boolean };
            delhivery?: { enabled?: boolean };
            shiprocket?: { enabled?: boolean };
            manualShipping?: { global?: boolean; shippingRate?: number };
        };
        seo?: {
            homepageTitle?: string;
            homepageDescription?: string;
            socialShareImageUrl?: string;
            allowIndexing?: boolean;
        };
    };
}

export interface StorefrontProduct {
    productId: string;
    name: string;
    slug: string;
    image: string;
    images: string[];
    price: number;
    maxPrice?: number;
    compareAtPrice: number;
    hasDiscount: boolean;
    discountPercentage: number;
    hasVariants: boolean;
    taxApplied?: boolean;
    taxRate?: number;
    // Drives ProductCard's "New" badge — optional since older/other feed
    // endpoints may not always populate it.
    createdAt?: string;
}

export interface Category {
    _id: string;
    name: string;
    slug: string;
    banner: {
        imageUrl: string;
        title: string;
        displayTitle: boolean;
    };
    productCount: number;
}

// Minimal storefront-facing shape (not the full admin Collection document —
// that has admin-only fields like productIds/rules/createdBy). Used by
// Spark's Collection List section and the /collections/[slug] page.
export interface CollectionSummary {
    _id: string;
    name: string;
    slug: string;
    thumbnailUrl?: string;
}

export interface PaginationMeta {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

export type ProductSortBy = "newest" | "bestSelling" | "priceHighToLow" | "priceLowToHigh";

export interface ProductVariant {
    _id: string;
    variantId: string;
    options: Record<string, string>;
    price: number;
    compareAtPrice: number;
    sku: string;
    barcode: string;
    image: string[];
    available: boolean;
    inventory: { available: number; trackQuantity: boolean };
}

export interface VariantOptions {
    options: { name: string; values: string[] }[];
}

export interface ProductDetail {
    productId: string;
    name: string;
    description: string;
    images: string[];
    hasVariants: boolean;
    continueSellWhenOutOfStock: boolean;
    skuCode: string;
    barCode: string;
    productWeight?: number;
    productWgtUnit?: string;
    price: {
        price: number;
        compareAtPrice: number;
        taxApplied: boolean;
        taxRate?: number;
    };
    display: {
        vendor?: string;
        tags?: string[];
    };
    inventory: {
        available: number;
        continueSelling?: boolean;
    } | null;
    createdAt?: string;
}
