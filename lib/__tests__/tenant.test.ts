import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const kv = {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
};

vi.mock("@opennextjs/cloudflare", () => ({
    getCloudflareContext: vi.fn(async () => ({ env: { FYPE_TENANT_CACHE: kv } })),
}));

vi.mock("@/lib/api-base-url", () => ({
    getApiBaseUrl: vi.fn(async () => "https://api.example.com/api/v1"),
}));

import { resolveTenant } from "../tenant";

const DOMAIN = "www.zalloperfumes.com";
const CACHED = { shopId: "STORE-cached", storeDomain: DOMAIN, themeId: "spark", isPublished: true };

function jsonResponse(status: number, body: unknown) {
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("resolveTenant", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        vi.stubGlobal("fetch", fetchMock);
        fetchMock.mockReset();
        kv.get.mockReset().mockResolvedValue(CACHED);
        kv.put.mockReset().mockResolvedValue(undefined);
        kv.delete.mockReset().mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("returns the tenant from the API and caches it", async () => {
        fetchMock.mockResolvedValue(
            jsonResponse(200, { success: true, data: { shop: { shopId: "STORE-1", themeId: "spark", isPublished: true } } })
        );

        const result = await resolveTenant(DOMAIN);

        expect(result).toEqual({
            status: "found",
            tenant: { shopId: "STORE-1", storeDomain: DOMAIN, themeId: "spark", isPublished: true },
        });
        expect(kv.put).toHaveBeenCalledWith(`tenant:${DOMAIN}`, expect.any(String), { expirationTtl: 300 });
        expect(fetchMock.mock.calls[0]?.[0]).toBe(
            `https://api.example.com/api/v1/commerce/shops/by-domain?domain=${encodeURIComponent(DOMAIN)}`
        );
    });

    it("on a 404, deletes the KV entry and returns not_found without falling back to KV", async () => {
        fetchMock.mockResolvedValue(jsonResponse(404, { success: false, message: "Store not found for this domain" }));

        const result = await resolveTenant(DOMAIN);

        expect(result).toEqual({ status: "not_found" });
        expect(kv.delete).toHaveBeenCalledWith(`tenant:${DOMAIN}`);
        expect(kv.get).not.toHaveBeenCalled();
        expect(kv.put).not.toHaveBeenCalled();
    });

    it("on a 5xx, falls back to the KV entry", async () => {
        fetchMock.mockResolvedValue(jsonResponse(503, { success: false }));

        const result = await resolveTenant(DOMAIN);

        expect(result).toEqual({ status: "found", tenant: CACHED });
        expect(kv.get).toHaveBeenCalledWith(`tenant:${DOMAIN}`, "json");
        expect(kv.delete).not.toHaveBeenCalled();
    });

    it("on a network error, falls back to the KV entry", async () => {
        fetchMock.mockRejectedValue(new TypeError("fetch failed"));

        const result = await resolveTenant(DOMAIN);

        expect(result).toEqual({ status: "found", tenant: CACHED });
        expect(kv.delete).not.toHaveBeenCalled();
    });

    it("on a timeout, falls back to the KV entry", async () => {
        fetchMock.mockRejectedValue(new DOMException("The operation was aborted due to timeout", "TimeoutError"));

        const result = await resolveTenant(DOMAIN);

        expect(result).toEqual({ status: "found", tenant: CACHED });
    });

    it("passes a timeout signal to fetch", async () => {
        fetchMock.mockResolvedValue(jsonResponse(404, {}));

        await resolveTenant(DOMAIN);

        const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
        expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it("returns unavailable when the API fails and KV has nothing", async () => {
        fetchMock.mockResolvedValue(jsonResponse(500, {}));
        kv.get.mockResolvedValue(null);

        expect(await resolveTenant(DOMAIN)).toEqual({ status: "unavailable" });
    });

    it.each([429, 408, 400, 403])("on a %i, falls back to the KV entry like a 5xx and doesn't delete it", async (status) => {
        fetchMock.mockResolvedValue(jsonResponse(status, { success: false }));

        const result = await resolveTenant(DOMAIN);

        expect(result).toEqual({ status: "found", tenant: CACHED });
        expect(kv.get).toHaveBeenCalledWith(`tenant:${DOMAIN}`, "json");
        expect(kv.delete).not.toHaveBeenCalled();
    });

    it("on a 429 with nothing in KV, returns unavailable (not not_found)", async () => {
        fetchMock.mockResolvedValue(jsonResponse(429, { success: false }));
        kv.get.mockResolvedValue(null);

        expect(await resolveTenant(DOMAIN)).toEqual({ status: "unavailable" });
    });

    it("on a 2xx without a shop, falls back to the KV entry", async () => {
        fetchMock.mockResolvedValue(jsonResponse(200, { success: true, data: {} }));

        expect(await resolveTenant(DOMAIN)).toEqual({ status: "found", tenant: CACHED });
        expect(kv.delete).not.toHaveBeenCalled();
    });
});
