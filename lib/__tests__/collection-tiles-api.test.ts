import { describe, it, expect, vi, afterEach } from "vitest";
import { getCollectionProductsWithTotal, getCollectionTiles } from "../storefront-api";

afterEach(() => vi.unstubAllGlobals());

const respond = (body: unknown, ok = true) => vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => body }));

describe("getCollectionTiles", () => {
    it("asks for one chunk and reports whether more follow", async () => {
        respond({ data: { items: [{ kind: "group", _id: "g", name: "G", slug: "g" }], pagination: { hasNextPage: true } } });

        const result = await getCollectionTiles("https://api.test/api/v1", "s1", { page: 2, limit: 12 });

        expect(fetch).toHaveBeenCalledWith("https://api.test/api/v1/commerce/s1/storefront/collections?page=2&limit=12", expect.anything());
        expect(result).toEqual({ tiles: [{ kind: "group", _id: "g", name: "G", slug: "g" }], hasNextPage: true });
    });

    it("returns an empty last page rather than throwing when the request fails", async () => {
        respond({}, false);

        expect(await getCollectionTiles("https://api.test/api/v1", "s1")).toEqual({ tiles: [], hasNextPage: false });
    });
});

describe("getCollectionProductsWithTotal", () => {
    it("returns the products and the total number a shopper could see", async () => {
        respond({ data: { products: [{ productId: "p1" }], total: 9 } });

        expect(await getCollectionProductsWithTotal("https://api.test/api/v1", "s1", "c1", 4)).toEqual({ products: [{ productId: "p1" }], total: 9 });
    });

    it("falls back to the product count for an older API, and to nothing on failure or no collection", async () => {
        respond({ data: { products: [{ productId: "p1" }, { productId: "p2" }] } });
        expect((await getCollectionProductsWithTotal("https://api.test/api/v1", "s1", "c1")).total).toBe(2);

        respond({}, false);
        expect(await getCollectionProductsWithTotal("https://api.test/api/v1", "s1", "c1")).toEqual({ products: [], total: 0 });
        expect(await getCollectionProductsWithTotal("https://api.test/api/v1", "s1", "")).toEqual({ products: [], total: 0 });
    });
});
