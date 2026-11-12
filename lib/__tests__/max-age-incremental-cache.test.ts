import { describe, it, expect, vi } from "vitest";
import { MAX_CACHE_AGE_MS, withMaxAge, type IncrementalCache } from "../cache/max-age-incremental-cache";

const NOW = 1_800_000_000_000;
const now = () => NOW;
const VALUE = { kind: "FETCH", data: { headers: {}, body: "{}", url: "https://api.test/x" }, revalidate: 60 };

function fakeStore(entry: unknown): IncrementalCache & {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
} {
    return {
        name: "cf-r2-incremental-cache",
        get: vi.fn().mockResolvedValue(entry),
        set: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
    } as never;
}

describe("withMaxAge", () => {
    it("caps cached data at 10 minutes", () => {
        expect(MAX_CACHE_AGE_MS).toBe(10 * 60 * 1000);
    });

    it("returns a fetch entry younger than the cap, even past its revalidate window", async () => {
        const entry = { value: VALUE, lastModified: NOW - 9 * 60 * 1000 };
        const store = fakeStore(entry);

        expect(await withMaxAge(store, MAX_CACHE_AGE_MS, now).get("k", "fetch")).toBe(entry);
        expect(store.get).toHaveBeenCalledWith("k", "fetch");
    });

    it("treats a fetch entry older than the cap as a miss", async () => {
        const store = fakeStore({ value: VALUE, lastModified: NOW - MAX_CACHE_AGE_MS - 1 });

        expect(await withMaxAge(store, MAX_CACHE_AGE_MS, now).get("k", "fetch")).toBeNull();
    });

    it("returns an entry exactly at the cap", async () => {
        const entry = { value: VALUE, lastModified: NOW - MAX_CACHE_AGE_MS };

        expect(await withMaxAge(fakeStore(entry), MAX_CACHE_AGE_MS, now).get("k", "fetch")).toBe(entry);
    });

    it("leaves other entry types alone (only fetch data is capped)", async () => {
        const entry = { value: { type: "app" }, lastModified: NOW - 24 * 60 * 60 * 1000 };

        expect(await withMaxAge(fakeStore(entry), MAX_CACHE_AGE_MS, now).get("k", "cache")).toBe(entry);
    });

    it("returns an entry with no lastModified as it is", async () => {
        const entry = { value: VALUE };

        expect(await withMaxAge(fakeStore(entry), MAX_CACHE_AGE_MS, now).get("k", "fetch")).toBe(entry);
    });

    it("passes a miss through (R2's own errors already come back as a miss)", async () => {
        expect(await withMaxAge(fakeStore(null), MAX_CACHE_AGE_MS, now).get("k", "fetch")).toBeNull();
    });

    it("passes writes and deletes through unchanged", async () => {
        const store = fakeStore(null);
        const cache = withMaxAge(store, MAX_CACHE_AGE_MS, now);

        await cache.set("k", VALUE as never, "fetch");
        await cache.delete("k");

        expect(store.set).toHaveBeenCalledWith("k", VALUE, "fetch");
        expect(store.delete).toHaveBeenCalledWith("k");
    });

    it("keeps the store's name, which deploys use to pick the cache to populate", () => {
        expect(withMaxAge(fakeStore(null)).name).toBe("cf-r2-incremental-cache");
    });

    it("uses the real clock by default", async () => {
        const fresh = { value: VALUE, lastModified: Date.now() };

        expect(await withMaxAge(fakeStore(fresh)).get("k", "fetch")).toBe(fresh);
    });
});
