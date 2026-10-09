import { getApiBaseUrl } from "@/lib/api-base-url";
import type {
    Category,
    CollectionGroupDetail,
    CollectionSummary,
    Page,
    PageDetail,
    PaginationMeta,
    ProductDetail,
    ProductSortBy,
    ProductVariant,
    ShopIdentity,
    StorefrontProduct,
    ThemeCustomization,
    VariantOptions,
} from "@/types/storefront";

export { getApiBaseUrl };

// Store-wide data (theme, nav, catalog) — same for every visitor of a store,
// so these are safe to call from Server Components and let Next's fetch cache/ISR handle freshness.
// Never call these for anything user-specific (cart, auth) — that stays client-side (Phase 2).
//
// Revalidation windows (Phase 7 review, 2026-07-28): split by how often each
// data type actually changes, not one flat window for everything. These are
// reasoned defaults based on data volatility, not tuned against real traffic
// (no production usage data exists yet) — revisit once real merchant/visitor
// patterns are known. All still short enough that a merchant edit is visible
// within a few requests; the split just avoids over-fetching rarely-changing
// data (shop settings, nav links, categories) at the same rate as things that
// churn with normal store activity (new-in/best-sellers, PDP stock/price).
const REVALIDATE_SECONDS = 60; // default, used for anything not called out below
const PAGES_REVALIDATE = 300; // nav/footer CMS links — rarely change
const CATEGORY_REVALIDATE = 300; // category list/art — rarely changes
const PRODUCT_DETAIL_REVALIDATE = 30; // PDP — stock/price accuracy matters most right at the purchase decision

async function fetchJson<T>(url: string, revalidateSeconds: number = REVALIDATE_SECONDS): Promise<T> {
    const res = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        next: { revalidate: revalidateSeconds },
    });
    if (!res.ok) throw new Error(`Request failed (${res.status}): ${url}`);
    return res.json() as Promise<T>;
}

export async function getShopByDomain(apiBaseUrl: string, domain: string): Promise<ShopIdentity | null> {
    try {
        // Publish state is a live access control bit — do not serve a 5-minute
        // cached "store is live" after the merchant switches to development.
        const res = await fetch(
            `${apiBaseUrl}/commerce/shops/by-domain?domain=${encodeURIComponent(domain)}`,
            { headers: { "Content-Type": "application/json" }, cache: "no-store" }
        );
        if (!res.ok) return null;
        const json = (await res.json()) as { data?: { shop?: ShopIdentity } };
        return json.data?.shop ?? null;
    } catch {
        return null;
    }
}

export async function getTheme(apiBaseUrl: string, storeId: string): Promise<ThemeCustomization | null> {
    try {
        // Theme edits must be visible immediately in the storefront/editor
        // preview. Using the shared ISR helper here could serve the previous
        // theme for up to 60 seconds after a successful save.
        const res = await fetch(
            `${apiBaseUrl}/commerce/stores/${storeId}/theme/storefront`,
            { headers: { "Content-Type": "application/json" }, cache: "no-store" }
        );
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const json = (await res.json()) as { data: { theme: ThemeCustomization } };
        return json.data.theme;
    } catch {
        return null;
    }
}

export async function getPagesByLocation(
    apiBaseUrl: string,
    storeId: string,
    location: "navigation" | "footer"
): Promise<Page[]> {
    try {
        const json = await fetchJson<{ data: { pages: Page[] } }>(
            `${apiBaseUrl}/commerce/${storeId}/pages/public?location=${location}`,
            PAGES_REVALIDATE
        );
        return json.data.pages ?? [];
    } catch {
        return [];
    }
}

export async function getAllPages(apiBaseUrl: string, storeId: string): Promise<Page[]> {
    try {
        const json = await fetchJson<{ data: { pages: Page[] } }>(
            `${apiBaseUrl}/commerce/${storeId}/pages/public`,
            PAGES_REVALIDATE
        );
        return json.data.pages ?? [];
    } catch {
        return [];
    }
}

export async function getNewInCollection(
    apiBaseUrl: string,
    storeId: string,
    limit = 4
): Promise<StorefrontProduct[]> {
    try {
        const json = await fetchJson<{ data: { data: StorefrontProduct[] } }>(
            `${apiBaseUrl}/commerce/${storeId}/new-in?limit=${limit}`
        );
        return json.data.data ?? [];
    } catch {
        return [];
    }
}

export async function getBestSellers(
    apiBaseUrl: string,
    storeId: string,
    limit = 4
): Promise<StorefrontProduct[]> {
    try {
        const json = await fetchJson<{ data: { data: StorefrontProduct[] } }>(
            `${apiBaseUrl}/commerce/${storeId}/best-seller?limit=${limit}`
        );
        return json.data.data ?? [];
    } catch {
        return [];
    }
}

// Real products for Spark's Featured Collection section — resolved
// server-side (manual list or automated rule match) by
// CollectionController.fetchCollectionStorefrontProducts, already shaped as
// StorefrontProduct (same shape as getNewInCollection/getBestSellers).
export async function getCollectionProducts(
    apiBaseUrl: string,
    storeId: string,
    collectionId: string,
    limit = 4
): Promise<StorefrontProduct[]> {
    if (!collectionId) return [];
    try {
        const json = await fetchJson<{ data: { products: StorefrontProduct[] } }>(
            `${apiBaseUrl}/commerce/${storeId}/products/collections/${collectionId}/storefront-products?limit=${limit}`
        );
        return json.data.products ?? [];
    } catch {
        return [];
    }
}

// One collection by its real _id — used to resolve Spark's Collection List
// section (a merchant-picked set of collection_ids) into real tile data
// (name + thumbnailUrl). Public endpoint, same as every other storefront
// read here.
export async function getCollectionById(apiBaseUrl: string, storeId: string, collectionId: string): Promise<CollectionSummary | null> {
    try {
        const json = await fetchJson<{ data: { collection: CollectionSummary } }>(`${apiBaseUrl}/commerce/${storeId}/products/collections/${collectionId}`);
        return json.data.collection ?? null;
    } catch {
        return null;
    }
}

export async function getCollectionsByIds(apiBaseUrl: string, storeId: string, collectionIds: string[]): Promise<CollectionSummary[]> {
    if (collectionIds.length === 0) return [];
    const results = await Promise.all(collectionIds.map((id) => getCollectionById(apiBaseUrl, storeId, id)));
    // Preserves the merchant's chosen order and drops any collection that's
    // since been deleted (getCollectionById returns null for a 404).
    return results.filter((c): c is CollectionSummary => c !== null);
}

// By slug — the real, SEO-friendly identifier used in /collections/[slug]
// (same convention as PDP's /products/[productId], just with Collection's
// own human-readable field: fetchCollectionBySlug on the backend).
export async function getCollectionBySlug(apiBaseUrl: string, storeId: string, slug: string): Promise<CollectionSummary | null> {
    try {
        const json = await fetchJson<{ data: { collection: CollectionSummary } }>(`${apiBaseUrl}/commerce/${storeId}/products/collections/slug/${slug}`);
        return json.data.collection ?? null;
    } catch {
        return null;
    }
}

// A published collection group (name, description and its collections in the
// merchant's order) by id or slug. Null when it doesn't exist, is a draft, or
// was deleted, so callers can 404 or simply render nothing.
export async function getCollectionGroup(apiBaseUrl: string, storeId: string, idOrSlug: string): Promise<CollectionGroupDetail | null> {
    try {
        const json = await fetchJson<{ data: CollectionGroupDetail }>(
            `${apiBaseUrl}/commerce/${storeId}/storefront/collection-groups/${encodeURIComponent(idOrSlug)}`
        );
        return json.data?.group ? json.data : null;
    } catch {
        return null;
    }
}

export interface CollectionListParams {
    search?: string;
    page?: number;
    limit?: number;
}

export interface CollectionListResult {
    collections: CollectionSummary[];
    pagination: PaginationMeta | null;
}

// All active collections for a store, paginated — storefront-facing
// equivalent of getAllProducts. Normalizes fetchCollections's admin-shaped
// pagination ({total, page, limit, totalPages, hasNextPage, hasPrevPage})
// into PaginationMeta. Explicitly passes status=active — the backend
// endpoint does NOT filter by status unless asked (unlike isActive, which
// defaults true), so a draft collection would otherwise leak into the
// public listing.
export async function getAllCollections(
    apiBaseUrl: string,
    storeId: string,
    params: CollectionListParams = {}
): Promise<CollectionListResult> {
    const query = new URLSearchParams();
    query.set("status", "active");
    if (params.search) query.set("search", params.search);
    query.set("page", String(params.page ?? 1));
    query.set("limit", String(params.limit ?? 100));

    try {
        const json = await fetchJson<{
            data: {
                collections: CollectionSummary[];
                pagination?: { total: number; page: number; limit: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean };
            };
        }>(`${apiBaseUrl}/commerce/${storeId}/products/collections?${query.toString()}`, CATEGORY_REVALIDATE);

        const raw = json.data.pagination;
        const pagination: PaginationMeta | null = raw
            ? {
                  currentPage: raw.page,
                  totalPages: raw.totalPages,
                  totalItems: raw.total,
                  itemsPerPage: raw.limit,
                  hasNextPage: raw.hasNextPage,
                  hasPrevPage: raw.hasPrevPage,
              }
            : null;
        return { collections: json.data.collections ?? [], pagination };
    } catch {
        return { collections: [], pagination: null };
    }
}

export async function getCategories(
    apiBaseUrl: string,
    storeId: string,
    withProducts = false
): Promise<Category[]> {
    try {
        const json = await fetchJson<{ data: { data: Category[] } }>(
            `${apiBaseUrl}/commerce/${storeId}/categories?withProducts=${withProducts}`,
            CATEGORY_REVALIDATE
        );
        return json.data.data ?? [];
    } catch {
        return [];
    }
}

export interface ProductListParams {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    sortBy?: ProductSortBy;
    search?: string;
    page?: number;
    limit?: number;
}

export interface ProductListResult {
    products: StorefrontProduct[];
    pagination: PaginationMeta | null;
}

export async function getAllProducts(
    apiBaseUrl: string,
    storeId: string,
    params: ProductListParams
): Promise<ProductListResult> {
    const query = new URLSearchParams();
    if (params.category) query.set("category", params.category);
    if (params.minPrice !== undefined) query.set("minPrice", String(params.minPrice));
    if (params.maxPrice !== undefined) query.set("maxPrice", String(params.maxPrice));
    if (params.sortBy) query.set("sortBy", params.sortBy);
    if (params.search) query.set("search", params.search);
    query.set("page", String(params.page ?? 1));
    query.set("limit", String(params.limit ?? 12));

    try {
        const json = await fetchJson<{ data: { products: StorefrontProduct[]; pagination?: PaginationMeta } }>(
            `${apiBaseUrl}/commerce/${storeId}/storefront/products?${query.toString()}`
        );
        return { products: json.data.products ?? [], pagination: json.data.pagination ?? null };
    } catch {
        return { products: [], pagination: null };
    }
}

export interface ProductDetailsResult {
    product: (ProductDetail & { variants?: ProductVariant[]; variantOptions?: VariantOptions }) | null;
    variants: ProductVariant[];
    variantOptions: VariantOptions | null;
    relatedProducts: StorefrontProduct[];
}

export async function getProductDetails(
    apiBaseUrl: string,
    storeId: string,
    productId: string
): Promise<ProductDetailsResult> {
    try {
        const json = await fetchJson<{
            data: {
                data: {
                    product: ProductDetail & { variants?: ProductVariant[]; variantOptions?: VariantOptions };
                    relatedProducts?: StorefrontProduct[];
                };
            };
        }>(`${apiBaseUrl}/commerce/${storeId}/product/${productId}`, PRODUCT_DETAIL_REVALIDATE);

        const { product, relatedProducts } = json.data.data;
        return {
            product,
            variants: product?.variants ?? [],
            variantOptions: product?.variantOptions ?? null,
            relatedProducts: relatedProducts ?? [],
        };
    } catch {
        return { product: null, variants: [], variantOptions: null, relatedProducts: [] };
    }
}

export async function getPageBySlug(apiBaseUrl: string, storeId: string, slug: string): Promise<PageDetail | null> {
    try {
        const json = await fetchJson<{ data: { page: PageDetail } }>(
            `${apiBaseUrl}/commerce/${storeId}/pages/slug/${slug}`,
            PAGES_REVALIDATE
        );
        return json.data.page;
    } catch {
        return null;
    }
}
