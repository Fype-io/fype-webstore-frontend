import type { ProductDetail, ProductVariant } from "@/types/storefront";

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
