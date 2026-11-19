import type { ProductDetail, ProductVariant } from "@/types/storefront";
import { productHref } from "@/lib/product-url";

/** Plain text for a meta description: tags removed, whitespace collapsed, cut at a word (about 155 characters). */
export function metaDescription(html: string | null | undefined, max = 155): string {
    const text = String(html ?? "")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, " ")
        .trim();
    if (text.length <= max) return text;
    const cut = text.slice(0, max - 1);
    const lastSpace = cut.lastIndexOf(" ");
    return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:!-]+$/, "")}…`;
}

const IN_STOCK = "https://schema.org/InStock";
const OUT_OF_STOCK = "https://schema.org/OutOfStock";

function variantInStock(variant: ProductVariant, continueSelling: boolean): boolean {
    if (!variant.available) return false;
    return (variant.inventory?.available ?? 0) > 0 || variant.inventory?.trackQuantity === false || continueSelling;
}

interface ProductJsonLdInput {
    product: ProductDetail;
    variants: ProductVariant[];
    /** Absolute URL of the product page (no ?variant). */
    url: string;
    /** ISO currency code of the store. */
    currency: string;
    /** Shopper-facing price of the product (or of its cheapest variant), after the store's tax display rules. */
    price: number;
    /** Same, for the dearest variant; equal to `price` when there is one price. */
    maxPrice?: number;
    description: string;
}

/** schema.org Product for the product page (Google rich results). */
export function buildProductJsonLd({ product, variants, url, currency, price, maxPrice, description }: ProductJsonLdInput) {
    const continueSelling = !!product.continueSellWhenOutOfStock || !!product.inventory?.continueSelling;
    const hasVariants = product.hasVariants && variants.length > 0;
    const inStock = hasVariants
        ? variants.some((variant) => variantInStock(variant, continueSelling))
        : (product.inventory?.available ?? 0) > 0 || continueSelling;
    const availability = inStock ? IN_STOCK : OUT_OF_STOCK;
    const money = (amount: number) => Number(amount.toFixed(2));

    const offers =
        hasVariants && maxPrice !== undefined && maxPrice !== price
            ? {
                  "@type": "AggregateOffer",
                  url,
                  priceCurrency: currency,
                  lowPrice: money(price),
                  highPrice: money(maxPrice),
                  offerCount: variants.length,
                  availability,
              }
            : { "@type": "Offer", url, priceCurrency: currency, price: money(price), availability };

    return {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        ...(description ? { description } : {}),
        ...(product.images?.length ? { image: product.images } : {}),
        ...(product.skuCode ? { sku: product.skuCode } : {}),
        url,
        offers,
    };
}

/** JSON for an inline <script type="application/ld+json">: `<` escaped so the data can't close the tag. */
export function jsonLdScript(data: unknown): string {
    return JSON.stringify(data).replace(/</g, "\\u003c");
}

/**
 * The image link previews (WhatsApp, Facebook, X, LinkedIn...) show for a product: its primary image,
 * converted by the share-image route into a JPEG of this size, the product fitted inside on white.
 * Uploads can be up to 10 MB and WebP/AVIF/SVG, which WhatsApp in particular won't show.
 */
export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const SHARE_IMAGE_TYPE = "image/jpeg";

/** Short stable hash (FNV-1a, base 36): a changed image gets a new share-image URL, so crawlers don't keep the old one. */
export function shortHash(text: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
}

/** Path of the product's share image, or null when it has no image (no image tag then). */
export function shareImagePath(product: { productId: string; slug?: string | null; images?: string[] | null }): string | null {
    const primary = product.images?.[0];
    if (!primary) return null;
    return `${productHref(product)}/share-image?v=${shortHash(primary)}`;
}
