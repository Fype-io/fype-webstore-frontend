import { describe, it, expect, vi, beforeEach } from "vitest";
import robots from "../robots";
import { getShopByDomain } from "@/lib/storefront-api";

vi.mock("next/headers", () => ({
    headers: vi.fn(),
}));

vi.mock("@/lib/storefront-api", () => ({
    getApiBaseUrl: vi.fn().mockResolvedValue("https://api.example.com"),
    getShopByDomain: vi.fn(),
}));

import { headers } from "next/headers";

function mockHost(host: string) {
    (headers as any).mockResolvedValue({ get: (key: string) => (key === "host" ? host : null) });
}

describe("robots.ts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("allows crawling and links the sitemap when allowIndexing is true", async () => {
        mockHost("mystore.example.com");
        (getShopByDomain as any).mockResolvedValue({
            shopId: "shop-1",
            settings: { seo: { allowIndexing: true } },
        });

        const result = await robots();

        expect(result.rules).toEqual({ userAgent: "*", allow: "/" });
        expect(result.sitemap).toBe("http://mystore.example.com/sitemap.xml");
    });

    it("allows crawling when allowIndexing is unset (default true)", async () => {
        mockHost("mystore.example.com");
        (getShopByDomain as any).mockResolvedValue({ shopId: "shop-1", settings: {} });

        const result = await robots();

        expect(result.rules).toEqual({ userAgent: "*", allow: "/" });
    });

    it("disallows all crawling when allowIndexing is false", async () => {
        mockHost("mystore.example.com");
        (getShopByDomain as any).mockResolvedValue({
            shopId: "shop-1",
            settings: { seo: { allowIndexing: false } },
        });

        const result = await robots();

        expect(result.rules).toEqual({ userAgent: "*", disallow: "/" });
        expect(result.sitemap).toBeUndefined();
    });

    it("defaults to allowing crawling when the shop can't be resolved", async () => {
        mockHost("unknown.example.com");
        (getShopByDomain as any).mockResolvedValue(null);

        const result = await robots();

        expect(result.rules).toEqual({ userAgent: "*", allow: "/" });
    });
});
