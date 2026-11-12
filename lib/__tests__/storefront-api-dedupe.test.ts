import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Vitest runs React's client build, where cache() doesn't keep results. This
// stand-in does, like the server build within one request; resetRequest()
// starts a new "request". It checks the wiring (which calls go through
// cache()); that the merging works in a real render was measured on a local
// OpenNext build (see the comment above fetchJsonUncached).
const { caches } = vi.hoisted(() => ({ caches: [] as Map<string, unknown>[] }));
function resetRequest() {
    for (const store of caches) store.clear();
}

vi.mock("react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("react")>();
    return {
        ...actual,
        cache: <A extends unknown[], R>(fn: (...args: A) => R) => {
            const store = new Map<string, R>();
            caches.push(store as Map<string, unknown>);
            return (...args: A): R => {
                const key = JSON.stringify(args);
                if (!store.has(key)) store.set(key, fn(...args));
                return store.get(key) as R;
            };
        },
    };
});

import { getCategories, getPagesByLocation, getShopByDomain, getTheme } from "../storefront-api";

const API = "https://api.test/api/v1";
const fetchMock = vi.fn();

function urls(): string[] {
    return fetchMock.mock.calls.map((call) => String(call[0]));
}

beforeEach(() => {
    resetRequest();
    fetchMock.mockReset().mockImplementation(async (url: string) => ({
        ok: true,
        status: 200,
        json: async () =>
            url.includes("/shops/by-domain")
                ? { data: { shop: { shopId: "s1", shopName: "Shop", isActive: true } } }
                : url.includes("/theme/storefront")
                  ? { data: { theme: { templateId: "spark" } } }
                  : { data: { data: [], pages: [] } },
    }));
    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("one backend call per URL per request", () => {
    it("asks for the store once however many places ask", async () => {
        const results = await Promise.all([
            getShopByDomain(API, "shop.example.com"),
            getShopByDomain(API, "shop.example.com"),
            getShopByDomain(API, "shop.example.com"),
        ]);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(results[0]?.shopId).toBe("s1");
        expect(results[1]).toBe(results[0]);
    });

    it("asks for the theme once", async () => {
        await getTheme(API, "s1");
        await getTheme(API, "s1");

        expect(urls()).toEqual([`${API}/commerce/stores/s1/theme/storefront`]);
    });

    it("asks for each catalog URL once", async () => {
        await Promise.all([
            getPagesByLocation(API, "s1", "navigation"),
            getPagesByLocation(API, "s1", "navigation"),
            getPagesByLocation(API, "s1", "footer"),
            getCategories(API, "s1", false),
            getCategories(API, "s1", false),
        ]);

        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("keeps different stores and domains apart", async () => {
        const [a, b] = await Promise.all([
            getShopByDomain(API, "a.example.com"),
            getShopByDomain(API, "b.example.com"),
        ]);
        await getTheme(API, "s1");
        await getTheme(API, "s2");

        expect(urls()).toEqual([
            `${API}/commerce/shops/by-domain?domain=a.example.com`,
            `${API}/commerce/shops/by-domain?domain=b.example.com`,
            `${API}/commerce/stores/s1/theme/storefront`,
            `${API}/commerce/stores/s2/theme/storefront`,
        ]);
        expect(a).not.toBe(b);
    });

    it("asks again in the next request: nothing carries over", async () => {
        await getShopByDomain(API, "shop.example.com");
        resetRequest();
        await getShopByDomain(API, "shop.example.com");

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("still asks the API with no-store for the store and theme", async () => {
        await getShopByDomain(API, "shop.example.com");
        await getTheme(API, "s1");

        for (const call of fetchMock.mock.calls) {
            expect((call[1] as RequestInit).cache).toBe("no-store");
        }
    });
});
