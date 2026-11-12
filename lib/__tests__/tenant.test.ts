import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const kv = {
    get: vi.fn(),
    getWithMetadata: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
};

// Background KV tasks handed to ctx.waitUntil; flush() runs them to the end.
const backgroundTasks: Promise<unknown>[] = [];
const ctx = { waitUntil: vi.fn((promise: Promise<unknown>) => void backgroundTasks.push(promise)) };
let withCtx = true;

vi.mock("@opennextjs/cloudflare", () => ({
    getCloudflareContext: vi.fn(async () => ({ env: { FYPE_TENANT_CACHE: kv }, ...(withCtx ? { ctx } : {}) })),
}));

vi.mock("@/lib/api-base-url", () => ({
    getApiBaseUrl: vi.fn(async () => "https://api.example.com/api/v1"),
}));

import { resolveTenant, resetTenantCacheMemoryForTests } from "../tenant";

const DOMAIN = "www.zalloperfumes.com";
const CACHED = { shopId: "STORE-cached", storeDomain: DOMAIN, themeId: "spark", isPublished: true };
const STORE_1 = { shopId: "STORE-1", storeDomain: DOMAIN, themeId: "spark", isPublished: true };
const TTL = 24 * 60 * 60;

function jsonResponse(status: number, body: unknown) {
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function shopResponse(shop: { shopId: string; themeId?: string; isPublished?: boolean }) {
    return jsonResponse(200, { success: true, data: { shop: { themeId: "spark", ...shop } } });
}

async function flush() {
    while (backgroundTasks.length) await backgroundTasks.shift();
}

describe("resolveTenant", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        vi.stubGlobal("fetch", fetchMock);
        fetchMock.mockReset();
        resetTenantCacheMemoryForTests();
        backgroundTasks.length = 0;
        withCtx = true;
        ctx.waitUntil.mockClear();
        kv.get.mockReset().mockResolvedValue(CACHED);
        kv.getWithMetadata.mockReset().mockResolvedValue({ value: null, metadata: null });
        kv.put.mockReset().mockResolvedValue(undefined);
        kv.delete.mockReset().mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("returns the tenant from the API and caches it in the background", async () => {
        fetchMock.mockResolvedValue(shopResponse({ shopId: "STORE-1", themeId: "spark", isPublished: true }));

        const result = await resolveTenant(DOMAIN);
        await flush();

        expect(result).toEqual({ status: "found", tenant: STORE_1 });
        expect(ctx.waitUntil).toHaveBeenCalledTimes(1);
        expect(kv.put).toHaveBeenCalledWith(`tenant:${DOMAIN}`, JSON.stringify(STORE_1), {
            expirationTtl: TTL,
            metadata: { writtenAt: expect.any(Number) },
        });
        expect(fetchMock.mock.calls[0]?.[0]).toBe(
            `https://api.example.com/api/v1/commerce/shops/by-domain?domain=${encodeURIComponent(DOMAIN)}`
        );
    });

    it("on a 404 with nothing written by this instance, makes no KV call", async () => {
        fetchMock.mockResolvedValue(jsonResponse(404, { success: false, message: "Store not found for this domain" }));

        const result = await resolveTenant(DOMAIN);
        await flush();

        expect(result).toEqual({ status: "not_found" });
        expect(kv.get).not.toHaveBeenCalled();
        expect(kv.getWithMetadata).not.toHaveBeenCalled();
        expect(kv.put).not.toHaveBeenCalled();
        expect(kv.delete).not.toHaveBeenCalled();
    });

    it("on a 404 for a host this instance cached, deletes the entry and doesn't fall back to KV", async () => {
        fetchMock.mockResolvedValueOnce(shopResponse({ shopId: "STORE-1", themeId: "spark" }));
        await resolveTenant(DOMAIN);
        await flush();

        fetchMock.mockResolvedValueOnce(jsonResponse(404, {}));
        const result = await resolveTenant(DOMAIN);
        await flush();

        expect(result).toEqual({ status: "not_found" });
        expect(kv.delete).toHaveBeenCalledWith(`tenant:${DOMAIN}`);
        expect(kv.get).not.toHaveBeenCalled();

        // Deleted, so a host that gets a store again is written again.
        fetchMock.mockResolvedValueOnce(shopResponse({ shopId: "STORE-1", themeId: "spark" }));
        await resolveTenant(DOMAIN);
        await flush();
        expect(kv.put).toHaveBeenCalledTimes(2);
    });

    it("a failed delete is retried on the next 404", async () => {
        fetchMock.mockResolvedValueOnce(shopResponse({ shopId: "STORE-1" }));
        await resolveTenant(DOMAIN);
        await flush();

        kv.delete.mockRejectedValueOnce(new Error("KV 429"));
        fetchMock.mockResolvedValue(jsonResponse(404, {}));
        await resolveTenant(DOMAIN);
        await flush();
        await resolveTenant(DOMAIN);
        await flush();

        expect(kv.delete).toHaveBeenCalledTimes(2);
    });

    it("writes once, then makes no KV call while the answer stays the same", async () => {
        fetchMock.mockImplementation(async () => shopResponse({ shopId: "STORE-1", themeId: "spark" }));

        for (let i = 0; i < 5; i++) {
            await resolveTenant(DOMAIN);
            await flush();
        }

        expect(kv.getWithMetadata).toHaveBeenCalledTimes(1);
        expect(kv.put).toHaveBeenCalledTimes(1);
    });

    it("writes again when the store's details change", async () => {
        fetchMock.mockResolvedValueOnce(shopResponse({ shopId: "STORE-1", themeId: "spark" }));
        await resolveTenant(DOMAIN);
        await flush();

        fetchMock.mockResolvedValueOnce(shopResponse({ shopId: "STORE-1", themeId: "theme_one" }));
        await resolveTenant(DOMAIN);
        await flush();

        expect(kv.put).toHaveBeenCalledTimes(2);
        expect(kv.put).toHaveBeenLastCalledWith(
            `tenant:${DOMAIN}`,
            JSON.stringify({ ...STORE_1, themeId: "theme_one" }),
            expect.anything()
        );
    });

    it("rewrites a published entry once it's 23 hours old, so it never lapses", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        fetchMock.mockImplementation(async () => shopResponse({ shopId: "STORE-1", themeId: "spark" }));
        await resolveTenant(DOMAIN);
        await flush();

        vi.setSystemTime(Date.now() + 22 * 60 * 60 * 1000);
        await resolveTenant(DOMAIN);
        await flush();
        expect(kv.put).toHaveBeenCalledTimes(1);

        vi.setSystemTime(Date.now() + 2 * 60 * 60 * 1000);
        await resolveTenant(DOMAIN);
        await flush();
        expect(kv.put).toHaveBeenCalledTimes(2);
    });

    it("a fresh instance that finds the same, recent entry in KV reads once and doesn't write", async () => {
        kv.getWithMetadata.mockResolvedValue({ value: STORE_1, metadata: { writtenAt: Date.now() - 60_000 } });
        fetchMock.mockImplementation(async () => shopResponse({ shopId: "STORE-1", themeId: "spark" }));

        await resolveTenant(DOMAIN);
        await flush();
        await resolveTenant(DOMAIN);
        await flush();

        expect(kv.getWithMetadata).toHaveBeenCalledTimes(1);
        expect(kv.getWithMetadata).toHaveBeenCalledWith(`tenant:${DOMAIN}`, "json");
        expect(kv.put).not.toHaveBeenCalled();
    });

    it.each([
        ["different details", { value: { ...STORE_1, themeId: "theme_one" }, metadata: { writtenAt: Date.now() } }],
        ["no write time (written before this change)", { value: STORE_1, metadata: null }],
        ["an entry about to expire", { value: STORE_1, metadata: { writtenAt: Date.now() - 23.5 * 60 * 60 * 1000 } }],
        ["nothing", { value: null, metadata: null }],
    ])("a fresh instance that finds %s in KV writes", async (_label, stored) => {
        kv.getWithMetadata.mockResolvedValue(stored);
        fetchMock.mockResolvedValue(shopResponse({ shopId: "STORE-1", themeId: "spark" }));

        await resolveTenant(DOMAIN);
        await flush();

        expect(kv.put).toHaveBeenCalledTimes(1);
    });

    it("always writes 'unpublished' without trusting the KV copy, even when it matches", async () => {
        kv.getWithMetadata.mockResolvedValue({
            value: { ...STORE_1, isPublished: false },
            metadata: { writtenAt: Date.now() },
        });
        fetchMock.mockResolvedValue(shopResponse({ shopId: "STORE-1", themeId: "spark", isPublished: false }));

        await resolveTenant(DOMAIN);
        await flush();

        expect(kv.getWithMetadata).not.toHaveBeenCalled();
        expect(kv.put).toHaveBeenCalledWith(
            `tenant:${DOMAIN}`,
            JSON.stringify({ ...STORE_1, isPublished: false }),
            expect.objectContaining({ expirationTtl: TTL })
        );
    });

    it("rewrites 'unpublished' after a minute, not 23 hours", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        fetchMock.mockImplementation(async () => shopResponse({ shopId: "STORE-1", isPublished: false }));
        await resolveTenant(DOMAIN);
        await flush();

        vi.setSystemTime(Date.now() + 30_000);
        await resolveTenant(DOMAIN);
        await flush();
        expect(kv.put).toHaveBeenCalledTimes(1);

        vi.setSystemTime(Date.now() + 31_000);
        await resolveTenant(DOMAIN);
        await flush();
        expect(kv.put).toHaveBeenCalledTimes(2);
    });

    it("a failed write isn't remembered, so the next request retries", async () => {
        kv.put.mockRejectedValueOnce(new Error("KV 429"));
        fetchMock.mockImplementation(async () => shopResponse({ shopId: "STORE-1" }));

        expect(await resolveTenant(DOMAIN)).toEqual({ status: "found", tenant: STORE_1 });
        await flush();
        await resolveTenant(DOMAIN);
        await flush();

        expect(kv.put).toHaveBeenCalledTimes(2);
    });

    it("a failed KV read doesn't write", async () => {
        kv.getWithMetadata.mockRejectedValue(new Error("KV read limit"));
        fetchMock.mockResolvedValue(shopResponse({ shopId: "STORE-1" }));

        expect(await resolveTenant(DOMAIN)).toEqual({ status: "found", tenant: STORE_1 });
        await flush();

        expect(kv.put).not.toHaveBeenCalled();
    });

    it("doesn't hold the request up while KV is slow", async () => {
        kv.put.mockReturnValue(new Promise(() => {}));
        fetchMock.mockResolvedValue(shopResponse({ shopId: "STORE-1" }));

        expect(await resolveTenant(DOMAIN)).toEqual({ status: "found", tenant: STORE_1 });
        expect(ctx.waitUntil).toHaveBeenCalledTimes(1);
        backgroundTasks.length = 0;
    });

    it("starts one KV task per domain while one is in flight", async () => {
        let finishPut: () => void = () => {};
        kv.put.mockReturnValue(new Promise<void>((resolve) => (finishPut = resolve)));
        fetchMock.mockImplementation(async () => shopResponse({ shopId: "STORE-1" }));

        await Promise.all([resolveTenant(DOMAIN), resolveTenant(DOMAIN), resolveTenant(DOMAIN)]);
        expect(ctx.waitUntil).toHaveBeenCalledTimes(1);

        finishPut();
        await flush();
        expect(kv.put).toHaveBeenCalledTimes(1);
    });

    it("waits for the KV task when there's no Worker context (local next dev)", async () => {
        withCtx = false;
        fetchMock.mockResolvedValue(shopResponse({ shopId: "STORE-1" }));

        await resolveTenant(DOMAIN);

        expect(kv.put).toHaveBeenCalledTimes(1);
        expect(ctx.waitUntil).not.toHaveBeenCalled();
    });

    it("a flood of hosts with no store doesn't push out a remembered store", async () => {
        fetchMock.mockResolvedValueOnce(shopResponse({ shopId: "STORE-1", themeId: "spark" }));
        await resolveTenant(DOMAIN);
        await flush();

        fetchMock.mockResolvedValue(jsonResponse(404, {}));
        for (let i = 0; i < 600; i++) await resolveTenant(`bot-${i}.fypestore.com`);
        await flush();

        fetchMock.mockResolvedValue(shopResponse({ shopId: "STORE-1", themeId: "spark" }));
        await resolveTenant(DOMAIN);
        await flush();

        expect(kv.getWithMetadata).toHaveBeenCalledTimes(1);
        expect(kv.put).toHaveBeenCalledTimes(1);
        expect(kv.delete).not.toHaveBeenCalled();
    });

    it("forgets the oldest store past 500 remembered", async () => {
        fetchMock.mockImplementation(async () => shopResponse({ shopId: "STORE-1" }));
        for (let i = 0; i < 501; i++) {
            await resolveTenant(`shop-${i}.fypestore.com`);
            await flush();
        }
        kv.getWithMetadata.mockClear();

        await resolveTenant("shop-500.fypestore.com");
        await flush();
        expect(kv.getWithMetadata).not.toHaveBeenCalled();

        await resolveTenant("shop-0.fypestore.com");
        await flush();
        expect(kv.getWithMetadata).toHaveBeenCalledTimes(1);
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
