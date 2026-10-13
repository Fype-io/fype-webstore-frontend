import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import sitemap from "../sitemap";
import { getShopByDomain, getAllProducts, getAllCollections, getAllPages } from "@/lib/storefront-api";

vi.mock("next/headers", () => ({
    headers: vi.fn(),
}));

vi.mock("@/lib/storefront-api", () => ({
    getApiBaseUrl: vi.fn().mockResolvedValue("https://api.example.com"),
    getShopByDomain: vi.fn(),
    getAllProducts: vi.fn(),
    getAllCollections: vi.fn(),
    getAllPages: vi.fn(),
}));

import { headers } from "next/headers";

function mockHost(host: string) {
    (headers as Mock).mockResolvedValue({ get: (key: string) => (key === "host" ? host : null) });
}

describe("sitemap.ts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("falls back to just the homepage when the shop can't be resolved", async () => {
        mockHost("unknown.example.com");
        (getShopByDomain as Mock).mockResolvedValue(null);

        const result = await sitemap();

        expect(result).toHaveLength(1);
        expect(result[0].url).toBe("http://unknown.example.com");
    });

    it("includes the homepage, products, active collections, and visible pages", async () => {
        mockHost("mystore.example.com");
        (getShopByDomain as Mock).mockResolvedValue({ shopId: "shop-1" });
        (getAllProducts as Mock).mockResolvedValue({
            products: [
                { productId: "p1", slug: "cool-shirt" },
                { productId: "p2", slug: null },
            ],
            pagination: null,
        });
        (getAllCollections as Mock).mockResolvedValue({
            collections: [{ _id: "c1", slug: "summer-sale" }],
            pagination: null,
        });
        (getAllPages as Mock).mockResolvedValue([
            { _id: "pg1", slug: "about-us", status: "visible", isActive: true },
            { _id: "pg2", slug: "draft-page", status: "hidden", isActive: true },
        ]);

        const result = await sitemap();
        const urls = result.map((entry) => entry.url);

        expect(urls).toContain("http://mystore.example.com");
        expect(urls).toContain("http://mystore.example.com/products/cool-shirt");
        // a product not backfilled yet is listed by its id until it has a slug
        expect(urls).toContain("http://mystore.example.com/products/p2");
        expect(urls).not.toContain("http://mystore.example.com/products/p1");
        expect(urls).toContain("http://mystore.example.com/collections/summer-sale");
        expect(urls).toContain("http://mystore.example.com/about-us");
        expect(urls).not.toContain("http://mystore.example.com/draft-page");
    });
});
