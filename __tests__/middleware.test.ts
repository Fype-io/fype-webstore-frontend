// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/tenant", () => ({
    resolveTenant: vi.fn(),
}));

vi.mock("@/lib/storefront-token-secret", () => ({
    getStorefrontTokenSecret: vi.fn(),
}));

import { middleware } from "../middleware";
import { resolveTenant } from "@/lib/tenant";
import { getStorefrontTokenSecret } from "@/lib/storefront-token-secret";
import { signToken } from "@/lib/signed-token";
import { signUnlockCookie } from "@/lib/storefront-gate";

const mockResolveTenant = vi.mocked(resolveTenant);
const mockSecret = vi.mocked(getStorefrontTokenSecret);
const SECRET = "test-storefront-token-secret-0123456789abcdef";

function requestFor(url: string, host: string, headers: Record<string, string> = {}) {
    return new NextRequest(url, { headers: { host, ...headers } });
}

const now = () => Math.floor(Date.now() / 1000);
const previewToken = (claims: Record<string, unknown> = {}, secret = SECRET) =>
    signToken({ typ: "storefront_preview", sid: "STORE-1", sub: "user-1", exp: now() + 600, ...claims }, secret);

function unpublishedStore() {
    mockResolveTenant.mockResolvedValue({
        status: "found",
        tenant: { shopId: "STORE-1", storeDomain: "mystore.fypestore.com", themeId: "spark", isPublished: false },
    });
}

const isPasswordRedirect = (res: Response) =>
    res.status === 307 && (res.headers.get("location") ?? "").includes("/storefront-password");

describe("middleware", () => {
    beforeEach(() => {
        mockResolveTenant.mockReset();
        mockSecret.mockReset();
        mockSecret.mockResolvedValue(SECRET);
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

    describe("password gate", () => {
        const URL_BASE = "https://mystore.fypestore.com/products";
        const HOST = "mystore.fypestore.com";

        beforeEach(unpublishedStore);

        it("shows the password page with no flag or token", async () => {
            expect(isPasswordRedirect(await middleware(requestFor(URL_BASE, HOST)))).toBe(true);
        });

        it("shows the password page for a bare ?editorPreview=1", async () => {
            const res = await middleware(requestFor(`${URL_BASE}?editorPreview=1`, HOST));
            expect(isPasswordRedirect(res)).toBe(true);
        });

        it("lets a valid preview token through, forwards it, and keeps it as a cross-site cookie", async () => {
            const token = await previewToken();

            const res = await middleware(requestFor(`${URL_BASE}?previewToken=${token}`, HOST));

            expect(res.status).toBe(200);
            expect(res.headers.get("x-middleware-next")).toBe("1");
            expect(res.headers.get("x-middleware-request-x-sf-preview-token")).toBe(token);
            const setCookie = res.headers.get("set-cookie") ?? "";
            expect(setCookie).toContain(`sf_editor_preview=${token}`);
            expect(setCookie).toMatch(/HttpOnly/i);
            expect(setCookie).toMatch(/Secure/i);
            expect(setCookie).toMatch(/SameSite=none/i);
            expect(setCookie).toMatch(/Partitioned/i);
            const maxAge = Number(/Max-Age=(\d+)/i.exec(setCookie)?.[1]);
            expect(maxAge).toBeGreaterThan(590);
            expect(maxAge).toBeLessThanOrEqual(600);
        });

        it("shows the password page for an expired token", async () => {
            const token = await previewToken({ exp: now() - 1 });
            const res = await middleware(requestFor(`${URL_BASE}?previewToken=${token}`, HOST));
            expect(isPasswordRedirect(res)).toBe(true);
            expect(res.headers.get("set-cookie")).toBeNull();
        });

        it("shows the password page for a token for a different store", async () => {
            const token = await previewToken({ sid: "STORE-2" });
            const res = await middleware(requestFor(`${URL_BASE}?previewToken=${token}`, HOST));
            expect(isPasswordRedirect(res)).toBe(true);
        });

        it("shows the password page for a tampered signature", async () => {
            const [header, payload, signature] = (await previewToken()).split(".") as [string, string, string];
            const tampered = `${header}.${payload}.${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
            const res = await middleware(requestFor(`${URL_BASE}?previewToken=${tampered}`, HOST));
            expect(isPasswordRedirect(res)).toBe(true);
        });

        it("shows the password page for a token signed with another secret", async () => {
            const token = await previewToken({}, "some-other-secret-0123456789abcdef-xyz");
            const res = await middleware(requestFor(`${URL_BASE}?previewToken=${token}`, HOST));
            expect(isPasswordRedirect(res)).toBe(true);
        });

        it("shows the password page for an unlock token presented as a preview token", async () => {
            const token = await signUnlockCookie("STORE-1", SECRET);
            const res = await middleware(requestFor(`${URL_BASE}?previewToken=${token}`, HOST));
            expect(isPasswordRedirect(res)).toBe(true);
        });

        it("shows the password page when no secret is configured, even for a well-signed token", async () => {
            const token = await previewToken();
            mockSecret.mockResolvedValue(null);
            const res = await middleware(requestFor(`${URL_BASE}?previewToken=${token}`, HOST));
            expect(isPasswordRedirect(res)).toBe(true);
        });

        it("lets a valid preview cookie through without the query param", async () => {
            const token = await previewToken();
            const res = await middleware(requestFor(URL_BASE, HOST, { cookie: `sf_editor_preview=${token}` }));
            expect(res.status).toBe(200);
            expect(res.headers.get("x-middleware-request-x-sf-preview-token")).toBe(token);
            // Nothing new to store.
            expect(res.headers.get("set-cookie")).toBeNull();
        });

        it("shows the password page for an expired preview cookie", async () => {
            const token = await previewToken({ exp: now() - 1 });
            const res = await middleware(requestFor(URL_BASE, HOST, { cookie: `sf_editor_preview=${token}` }));
            expect(isPasswordRedirect(res)).toBe(true);
        });

        it("lets a signed unlock cookie through", async () => {
            const cookie = await signUnlockCookie("STORE-1", SECRET);
            const res = await middleware(requestFor(URL_BASE, HOST, { cookie: `sf_storefront_unlocked=${cookie}` }));
            expect(res.status).toBe(200);
        });

        it("shows the password page for the old, forgeable unlock cookie (the bare shop id)", async () => {
            const res = await middleware(requestFor(URL_BASE, HOST, { cookie: "sf_storefront_unlocked=STORE-1" }));
            expect(isPasswordRedirect(res)).toBe(true);
        });

        it("shows the password page for another store's unlock cookie", async () => {
            const cookie = await signUnlockCookie("STORE-2", SECRET);
            const res = await middleware(requestFor(URL_BASE, HOST, { cookie: `sf_storefront_unlocked=${cookie}` }));
            expect(isPasswordRedirect(res)).toBe(true);
        });

        it("ignores client-sent internal headers", async () => {
            const res = await middleware(
                requestFor(URL_BASE, HOST, { "x-editor-preview": "1", "x-sf-preview-token": "forged", "x-shop-id": "STORE-9" })
            );
            expect(isPasswordRedirect(res)).toBe(true);
        });

        it("drops client-sent internal headers on requests it lets through", async () => {
            mockResolveTenant.mockResolvedValue({ status: "unavailable" });
            const res = await middleware(requestFor(URL_BASE, HOST, { "x-editor-preview": "1", "x-sf-preview-token": "forged" }));
            expect(res.status).toBe(200);
            // Overridden headers are listed here; a deleted one is absent from the forwarded request.
            expect(res.headers.get("x-middleware-request-x-editor-preview")).toBeNull();
            expect(res.headers.get("x-middleware-request-x-sf-preview-token")).toBeNull();
        });

        it("never puts the token into the password page's return_to", async () => {
            const token = await previewToken({ exp: now() - 1 });
            const res = await middleware(requestFor(`${URL_BASE}?sort=new&previewToken=${token}`, HOST));
            const location = res.headers.get("location") ?? "";
            expect(location).not.toContain(token);
            expect(new URL(location).searchParams.get("return_to")).toBe("/products?sort=new");
        });

        it("doesn't gate the password page itself", async () => {
            const res = await middleware(requestFor("https://mystore.fypestore.com/storefront-password", HOST));
            expect(res.status).toBe(200);
        });
    });

    it("sets the preview cookie for a published store too (editor UI on later requests)", async () => {
        mockResolveTenant.mockResolvedValue({
            status: "found",
            tenant: { shopId: "STORE-1", storeDomain: "mystore.fypestore.com", themeId: "spark", isPublished: true },
        });
        const token = await previewToken();

        const res = await middleware(requestFor(`https://mystore.fypestore.com/?previewToken=${token}`, "mystore.fypestore.com"));

        expect(res.status).toBe(200);
        expect(res.headers.get("set-cookie")).toContain("sf_editor_preview=");
    });

    describe("verified preview response headers", () => {
        const HOST = "mystore.fypestore.com";

        beforeEach(() => {
            unpublishedStore();
            vi.stubEnv("EDITOR_ADMIN_ORIGINS", "http://localhost:3000, https://admin.example.com/some/path, not a url");
        });

        afterEach(() => {
            vi.unstubAllEnvs();
        });

        it("allows framing only by the configured admin origins, and sends no Referer", async () => {
            const token = await previewToken();
            const res = await middleware(requestFor(`https://${HOST}/?previewToken=${token}`, HOST));

            expect(res.status).toBe(200);
            expect(res.headers.get("content-security-policy")).toBe("frame-ancestors http://localhost:3000 https://admin.example.com");
            expect(res.headers.get("referrer-policy")).toBe("no-referrer");
        });

        it("sets the same headers for a preview carried by the cookie", async () => {
            const token = await previewToken();
            const res = await middleware(requestFor(`https://${HOST}/products`, HOST, { cookie: `sf_editor_preview=${token}` }));

            expect(res.headers.get("content-security-policy")).toBe("frame-ancestors http://localhost:3000 https://admin.example.com");
            expect(res.headers.get("referrer-policy")).toBe("no-referrer");
        });

        it("allows no framing at all when no admin origin is configured", async () => {
            vi.stubEnv("EDITOR_ADMIN_ORIGINS", "");
            const token = await previewToken();
            const res = await middleware(requestFor(`https://${HOST}/?previewToken=${token}`, HOST));

            expect(res.headers.get("content-security-policy")).toBe("frame-ancestors 'none'");
        });

        it("adds neither header to ordinary traffic", async () => {
            mockResolveTenant.mockResolvedValue({
                status: "found",
                tenant: { shopId: "STORE-1", storeDomain: HOST, themeId: "spark", isPublished: true },
            });
            const res = await middleware(requestFor(`https://${HOST}/`, HOST));

            expect(res.headers.get("content-security-policy")).toBeNull();
            expect(res.headers.get("referrer-policy")).toBeNull();
        });

        it("still sends no Referer for a URL with an invalid token on a published store", async () => {
            mockResolveTenant.mockResolvedValue({
                status: "found",
                tenant: { shopId: "STORE-1", storeDomain: HOST, themeId: "spark", isPublished: true },
            });
            const res = await middleware(requestFor(`https://${HOST}/?previewToken=garbage`, HOST));

            expect(res.status).toBe(200);
            expect(res.headers.get("referrer-policy")).toBe("no-referrer");
            expect(res.headers.get("content-security-policy")).toBeNull();
            expect(res.headers.get("set-cookie")).toBeNull();
        });
    });
});
