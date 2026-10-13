/**
 * Where a product lives on the storefront: /products/<slug>, or /products/<productId>
 * for a product that has no slug yet (not backfilled). Pass a variant id to open the
 * page on that variant (?variant=<variantId>).
 */
export interface ProductLinkTarget {
    productId: string;
    slug?: string | null;
}

export const VARIANT_PARAM = "variant";

export function productHref(product: ProductLinkTarget, variantId?: string | null): string {
    const path = `/products/${encodeURIComponent(product.slug || product.productId)}`;
    return variantId ? `${path}?${VARIANT_PARAM}=${encodeURIComponent(variantId)}` : path;
}
