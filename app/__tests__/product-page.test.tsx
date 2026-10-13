import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// The product route /products/[slug]: finds the product by slug or by its older id link,
// sends an id link to the slug URL (keeping the query), opens the page on ?variant=, and
// adds canonical + structured data. The server page is called directly with mocked data.

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/navigation", () => ({
    permanentRedirect: vi.fn((url: string) => {
        throw new Error(`REDIRECT ${url}`);
    }),
}));
vi.mock("@/lib/storefront-api", () => ({
    getApiBaseUrl: vi.fn().mockResolvedValue("https://api.example.com"),
    getShopByDomain: vi.fn(),
    getTheme: vi.fn(),
    getPagesByLocation: vi.fn().mockResolvedValue([]),
    getAllPages: vi.fn().mockResolvedValue([]),
    getProductDetails: vi.fn(),
}));
vi.mock("@/lib/theme", () => ({
    resolveThemeSlug: vi.fn().mockReturnValue("spark"),
    loadTheme: vi.fn(),
}));
vi.mock("@/lib/editor-preview-server", () => ({ isVerifiedEditorPreview: vi.fn().mockResolvedValue(false) }));
vi.mock("@/components/shared/ShopNotFound", () => ({ default: () => "shop not found" }));

import { headers } from "next/headers";
import { permanentRedirect } from "next/navigation";
import { getShopByDomain, getTheme, getProductDetails } from "@/lib/storefront-api";
import { loadTheme } from "@/lib/theme";
import { isVerifiedEditorPreview } from "@/lib/editor-preview-server";
import ProductPage, { generateMetadata } from "../(storefront)/products/[slug]/page";

const product = {
    productId: "PROD-abc1234567",
    slug: "blue-shirt",
    name: "Blue Shirt",
    description: "<p>A very blue shirt.</p>",
    images: ["https://img/1.jpg"],
    hasVariants: false,
    continueSellWhenOutOfStock: false,
    skuCode: "SKU-1",
    price: { price: 100, compareAtPrice: 0, taxApplied: false, taxRate: 0 },
    inventory: { available: 2, trackQuantity: true, continueSelling: false },
};

function FakeProductDetailsPage(props: { product: unknown; initialVariantId?: string }) {
    return <main data-testid="pdp" data-initial-variant={props.initialVariantId ?? ""} data-has-product={props.product ? "1" : "0"} />;
}

function setup(found: unknown = product, opts: { editor?: boolean } = {}) {
    (headers as Mock).mockResolvedValue({ get: (key: string) => (key === "host" ? "shop.example.com" : null) });
    (getShopByDomain as Mock).mockResolvedValue({ shopId: "shop-1", shopName: "Shop", settings: { currency: "AED" } });
    (getTheme as Mock).mockResolvedValue({ templateId: "spark", themeConfig: {}, navbar: {}, footer: {} });
    (loadTheme as Mock).mockResolvedValue({ ProductDetailsPage: FakeProductDetailsPage });
    (getProductDetails as Mock).mockResolvedValue({ product: found, variants: [], variantOptions: null, relatedProducts: [] });
    (isVerifiedEditorPreview as Mock).mockResolvedValue(!!opts.editor);
}

const render = async (slug: string, query: Record<string, string | string[]> = {}) =>
    renderToStaticMarkup(await ProductPage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(query) }));

describe("product page /products/[slug]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("looks the product up by the URL segment", async () => {
        setup();
        await render("blue-shirt");
        expect(getProductDetails).toHaveBeenCalledWith("https://api.example.com", "shop-1", "blue-shirt");
    });

    it("redirects an id link to the slug URL for good", async () => {
        setup();
        await expect(render("PROD-abc1234567")).rejects.toThrow("REDIRECT /products/blue-shirt");
        expect(permanentRedirect).toHaveBeenCalledWith("/products/blue-shirt");
    });

    it("keeps the query string (variant, campaign tags) when redirecting", async () => {
        setup();
        await expect(render("PROD-abc1234567", { variant: "VAR-2", utm_source: "ad" })).rejects.toThrow(
            "REDIRECT /products/blue-shirt?variant=VAR-2&utm_source=ad"
        );
    });

    it("redirects a differently-cased slug to the canonical one", async () => {
        setup();
        await expect(render("Blue-Shirt")).rejects.toThrow("REDIRECT /products/blue-shirt");
    });

    it("does not redirect when the segment already is the slug (no loop)", async () => {
        setup();
        await expect(render("blue-shirt", { variant: "VAR-2" })).resolves.toContain('data-testid="pdp"');
        expect(permanentRedirect).not.toHaveBeenCalled();
    });

    it("does not redirect inside the theme customizer's verified preview", async () => {
        setup(product, { editor: true });
        await expect(render("PROD-abc1234567")).resolves.toContain('data-testid="pdp"');
        expect(permanentRedirect).not.toHaveBeenCalled();
    });

    it("does not redirect a product that has no slug yet", async () => {
        setup({ ...product, slug: null });
        await expect(render("PROD-abc1234567")).resolves.toContain('data-testid="pdp"');
        expect(permanentRedirect).not.toHaveBeenCalled();
    });

    it("hands ?variant= to the theme page as initialVariantId, and nothing when absent", async () => {
        setup();
        expect(await render("blue-shirt", { variant: "VAR-2" })).toContain('data-initial-variant="VAR-2"');
        expect(await render("blue-shirt")).toContain('data-initial-variant=""');
        expect(await render("blue-shirt", { variant: ["VAR-3", "VAR-4"] })).toContain('data-initial-variant="VAR-3"');
    });

    it("adds Product structured data with the canonical URL, escaped", async () => {
        setup({ ...product, name: "Blue </script> Shirt" });
        const html = await render("blue-shirt");
        const match = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
        expect(match).not.toBeNull();
        const ld = JSON.parse(match![1]!.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
        expect(ld).toMatchObject({
            "@type": "Product",
            url: "http://shop.example.com/products/blue-shirt",
            offers: { price: 100, priceCurrency: "AED", availability: "https://schema.org/InStock" },
        });
        expect(html).not.toContain("</script> Shirt");
    });

    it("has no structured data when the product isn't found", async () => {
        setup(null);
        const html = await render("nope");
        expect(html).not.toContain("ld+json");
        expect(html).toContain('data-has-product="0"');
    });
});

describe("product page metadata", () => {
    beforeEach(() => vi.clearAllMocks());

    it("sets title, description, canonical and social tags from the product", async () => {
        setup();
        const meta = await generateMetadata({ params: Promise.resolve({ slug: "PROD-abc1234567" }), searchParams: Promise.resolve({ variant: "VAR-2" }) });
        expect(meta.title).toBe("Blue Shirt - Shop");
        expect(meta.description).toBe("A very blue shirt.");
        // the canonical is the slug page, not the id link and not a ?variant= address
        expect(meta.alternates?.canonical).toBe("http://shop.example.com/products/blue-shirt");
        expect(meta.openGraph).toMatchObject({ title: "Blue Shirt - Shop", url: "http://shop.example.com/products/blue-shirt", images: [{ url: "https://img/1.jpg" }] });
        expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
        expect(meta.robots).toEqual({ index: true, follow: true });
    });

    it("follows the store's indexing setting", async () => {
        setup();
        (getShopByDomain as Mock).mockResolvedValue({ shopId: "shop-1", shopName: "Shop", settings: { seo: { allowIndexing: false } } });
        const meta = await generateMetadata({ params: Promise.resolve({ slug: "blue-shirt" }), searchParams: Promise.resolve({}) });
        expect(meta.robots).toEqual({ index: false, follow: false });
    });

    it("falls back to a plain title when the product isn't found", async () => {
        setup(null);
        const meta = await generateMetadata({ params: Promise.resolve({ slug: "nope" }), searchParams: Promise.resolve({}) });
        expect(meta.title).toBe("Product Details - Shop");
        expect(meta.alternates).toBeUndefined();
    });
});
