// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/tenant", () => ({
    resolveTenant: vi.fn(),
}));

import { middleware } from "../middleware";
import { resolveTenant } from "@/lib/tenant";

const mockResolveTenant = vi.mocked(resolveTenant);

function requestFor(url: string, host: string) {
    return new NextRequest(url, { headers: { host } });
}

describe("middleware", () => {
    beforeEach(() => {
        mockResolveTenant.mockReset();
    });

    it("looks the tenant up by the normalized host", async () => {
        mockResolveTenant.mockResolvedValue({ status: "not_found" });

        await middleware(requestFor("https://www.shop.example.com/", "WWW.Shop.Example.com.:443"));

        expect(mockResolveTenant).toHaveBeenCalledWith("www.shop.example.com");
    });

    it("answers an unknown host with a 404 page, not a redirect", async () => {
        mockResolveTenant.mockResolvedValue({ status: "not_found" });

        const res = await middleware(requestFor("https://www.unknown.example.com/products", "www.unknown.example.com"));

        expect(res.status).toBe(404);
        expect(res.headers.get("location")).toBeNull();
        expect(res.headers.get("cache-control")).toBe("no-store");
        expect(await res.text()).toContain("Store not found");
    });

    it.each(["/theme-preview/spark", "/api/storefront-unlock"])(
        "lets %s through for a host with no store",
        async (path) => {
            mockResolveTenant.mockResolvedValue({ status: "not_found" });

            const res = await middleware(requestFor(`https://themes.fypestore.com${path}`, "themes.fypestore.com"));

            expect(res.status).toBe(200);
            expect(res.headers.get("x-middleware-next")).toBe("1");
        }
    );

    it("carries on as before when the tenant lookup is unavailable", async () => {
        mockResolveTenant.mockResolvedValue({ status: "unavailable" });

        const res = await middleware(requestFor("https://mystore.fypestore.com/", "mystore.fypestore.com"));

        expect(res.status).toBe(200);
        expect(res.headers.get("x-middleware-next")).toBe("1");
    });

    it("passes the tenant headers through for a known host", async () => {
        mockResolveTenant.mockResolvedValue({
            status: "found",
            tenant: { shopId: "STORE-1", storeDomain: "mystore.fypestore.com", themeId: "spark", isPublished: true },
        });

        const res = await middleware(requestFor("https://mystore.fypestore.com/", "mystore.fypestore.com"));

        expect(res.status).toBe(200);
        expect(res.headers.get("x-middleware-request-x-shop-id")).toBe("STORE-1");
    });

    it("still redirects an unpublished store to the password page", async () => {
        mockResolveTenant.mockResolvedValue({
            status: "found",
            tenant: { shopId: "STORE-1", storeDomain: "mystore.fypestore.com", themeId: "spark", isPublished: false },
        });

        const res = await middleware(requestFor("https://mystore.fypestore.com/cart", "mystore.fypestore.com"));

        expect(res.status).toBe(307);
        expect(res.headers.get("location")).toContain("/storefront-password?return_to=%2Fcart");
    });
});
