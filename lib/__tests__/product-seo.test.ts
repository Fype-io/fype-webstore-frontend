import { describe, expect, it } from "vitest";
import type { ProductDetail, ProductVariant } from "@/types/storefront";
import { buildProductJsonLd, jsonLdScript, metaDescription } from "../product-seo";

const base = {
    productId: "PROD-1",
    name: "Blue Shirt",
    description: "",
    images: ["https://img/1.jpg", "https://img/2.jpg"],
    hasVariants: false,
    continueSellWhenOutOfStock: false,
    skuCode: "SKU-1",
    barCode: "",
    price: { price: 100, compareAtPrice: 0, taxApplied: false, taxRate: 0 },
    inventory: { available: 3, trackQuantity: true, continueSelling: false },
} as unknown as ProductDetail;

const variant = (over: Partial<ProductVariant>): ProductVariant => ({
    _id: "x",
    variantId: "VAR-1",
    options: { Size: "M" },
    price: 10,
    compareAtPrice: 0,
    sku: "",
    barcode: "",
    image: [],
    available: true,
    inventory: { available: 5, trackQuantity: true },
    ...over,
});

describe("metaDescription", () => {
    it("strips tags and entities and collapses whitespace", () => {
        expect(metaDescription("<p>Fresh&nbsp;&amp; <b>bold</b></p>\n<p>scent</p>")).toBe("Fresh & bold scent");
    });

    it("returns text that fits as is, and an empty string for nothing", () => {
        expect(metaDescription("Short text.")).toBe("Short text.");
        expect(metaDescription("")).toBe("");
        expect(metaDescription(undefined)).toBe("");
        expect(metaDescription("<p> </p>")).toBe("");
    });

    it("cuts long text at a word with an ellipsis, within the limit", () => {
        const long = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
        const out = metaDescription(long);
        expect(out.length).toBeLessThanOrEqual(155);
        expect(out.endsWith("…")).toBe(true);
        expect(long.startsWith(out.slice(0, -1))).toBe(true);
        expect(/word\d+…$/.test(out)).toBe(true);
    });
});

describe("buildProductJsonLd", () => {
    const common = { url: "https://shop.test/products/blue-shirt", currency: "AED", description: "Nice" };

    it("describes a simple product with one offer", () => {
        const ld = buildProductJsonLd({ ...common, product: base, variants: [], price: 100 });
        expect(ld).toMatchObject({
            "@type": "Product",
            name: "Blue Shirt",
            description: "Nice",
            image: base.images,
            sku: "SKU-1",
            url: common.url,
            offers: { "@type": "Offer", price: 100, priceCurrency: "AED", availability: "https://schema.org/InStock", url: common.url },
        });
    });

    it("is out of stock with no stock and no continue-selling, in stock with continue-selling", () => {
        const none = { ...base, inventory: { available: 0, trackQuantity: true, continueSelling: false } } as unknown as ProductDetail;
        expect(buildProductJsonLd({ ...common, product: none, variants: [], price: 1 }).offers.availability).toBe("https://schema.org/OutOfStock");
        const sells = { ...none, continueSellWhenOutOfStock: true } as unknown as ProductDetail;
        expect(buildProductJsonLd({ ...common, product: sells, variants: [], price: 1 }).offers.availability).toBe("https://schema.org/InStock");
    });

    it("uses an AggregateOffer with the price range for variants of different prices", () => {
        const product = { ...base, hasVariants: true } as ProductDetail;
        const ld = buildProductJsonLd({ ...common, product, variants: [variant({ price: 10 }), variant({ variantId: "VAR-2", price: 25 })], price: 10, maxPrice: 25 });
        expect(ld.offers).toMatchObject({ "@type": "AggregateOffer", lowPrice: 10, highPrice: 25, offerCount: 2, priceCurrency: "AED" });
    });

    it("uses a plain Offer when all variants cost the same, and reflects variant stock", () => {
        const product = { ...base, hasVariants: true } as ProductDetail;
        const ld = buildProductJsonLd({
            ...common,
            product,
            variants: [variant({ inventory: { available: 0, trackQuantity: true } }), variant({ variantId: "VAR-2", available: false })],
            price: 10,
            maxPrice: 10,
        });
        expect(ld.offers).toMatchObject({ "@type": "Offer", price: 10, availability: "https://schema.org/OutOfStock" });
    });

    it("leaves out what the product doesn't have", () => {
        const bare = { ...base, images: [], skuCode: "" } as unknown as ProductDetail;
        const ld = buildProductJsonLd({ ...common, product: bare, variants: [], price: 1, description: "" });
        expect(ld).not.toHaveProperty("image");
        expect(ld).not.toHaveProperty("sku");
        expect(ld).not.toHaveProperty("description");
    });
});

describe("jsonLdScript", () => {
    it("escapes < so product text can't close the script tag", () => {
        const out = jsonLdScript({ name: "</script><script>alert(1)</script>" });
        expect(out).not.toContain("<");
        expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script>");
    });
});
