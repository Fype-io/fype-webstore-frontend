import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { TRAIL_KEY, recordPage, resolveBackTarget } from "../back-target";

const trail = () => JSON.parse(sessionStorage.getItem(TRAIL_KEY) ?? "[]");

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("recording the pages a shopper visits", () => {
    it("remembers pages in the order they were visited", () => {
        recordPage("/");
        recordPage("/collections");
        recordPage("/collections/wedding-formal");

        expect(trail()).toEqual(["/", "/collections", "/collections/wedding-formal"]);
    });

    it("does not repeat a page that is already the latest one (reload, re-render)", () => {
        recordPage("/");
        recordPage("/");

        expect(trail()).toEqual(["/"]);
    });

    it("treats arriving at the page before the latest as a step back, so the list follows the browser's Back button", () => {
        ["/", "/collections/a", "/collections/b"].forEach(recordPage);

        recordPage("/collections/a");

        expect(trail()).toEqual(["/", "/collections/a"]);
    });

    it("keeps only the most recent pages", () => {
        for (let i = 0; i < 40; i++) recordPage(`/products/p${i}`);

        expect(trail()).toHaveLength(20);
        expect(trail().at(-1)).toBe("/products/p39");
    });

    it("ignores damaged stored data instead of failing", () => {
        for (const bad of ["not json", '{"a":1}', "[1,2,3]", '["/ok", 5]']) {
            sessionStorage.setItem(TRAIL_KEY, bad);
            expect(() => recordPage("/collections")).not.toThrow();
            expect(trail().at(-1)).toBe("/collections");
        }
    });

    it("does nothing, quietly, when the browser blocks storage", () => {
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("blocked");
        });

        expect(() => recordPage("/")).not.toThrow();
        expect(resolveBackTarget("/collections/a")).toBeNull();
    });
});

describe("where the Back link on a collection page goes", () => {
    it("goes to the home page when the shopper came from it", () => {
        ["/", "/collections/wedding-formal"].forEach(recordPage);

        expect(resolveBackTarget("/collections/wedding-formal")).toEqual({ href: "/", label: "Back to Home" });
    });

    it("works even if the current page has not been recorded yet", () => {
        recordPage("/");

        expect(resolveBackTarget("/collections/wedding-formal")).toEqual({ href: "/", label: "Back to Home" });
    });

    it("goes to the Collections list when the shopper came from it", () => {
        ["/collections", "/collections/a"].forEach(recordPage);

        expect(resolveBackTarget("/collections/a")).toEqual({ href: "/collections", label: "Back to Collections" });
    });

    it("keeps a group view's filter when the shopper came from one", () => {
        ["/collections?group=shop-by-occasion", "/collections/daily-wear"].forEach(recordPage);

        expect(resolveBackTarget("/collections/daily-wear")).toEqual({
            href: "/collections?group=shop-by-occasion",
            label: "Back to Collections",
        });
    });

    it("goes to the Shop page, with its filters, when the shopper came from it", () => {
        ["/products?sort=price", "/collections/a"].forEach(recordPage);

        expect(resolveBackTarget("/collections/a")).toEqual({ href: "/products?sort=price", label: "Back to Shop" });
    });

    it("uses a plain 'Back' for a product or another collection", () => {
        ["/products/ajmal-wisal", "/collections/a"].forEach(recordPage);
        expect(resolveBackTarget("/collections/a")).toEqual({ href: "/products/ajmal-wisal", label: "Back" });

        sessionStorage.clear();
        ["/collections/b", "/collections/a"].forEach(recordPage);
        expect(resolveBackTarget("/collections/a")).toEqual({ href: "/collections/b", label: "Back" });
    });

    it("has nothing to go back to when the shopper landed here directly", () => {
        recordPage("/collections/a");

        expect(resolveBackTarget("/collections/a")).toBeNull();
    });

    it("never points back at the page it is on", () => {
        ["/collections/a", "/collections/a?x=1"].forEach(recordPage);

        expect(resolveBackTarget("/collections/a?x=1")).toEqual({ href: "/collections/a", label: "Back" });
        sessionStorage.setItem(TRAIL_KEY, JSON.stringify(["/collections/a", "/collections/a"]));
        expect(resolveBackTarget("/collections/a")).toBeNull();
    });

    it("falls back (null) for pages that make no sense to return to, and for anything that is not a path on this store", () => {
        for (const odd of ["/checkout", "/cart", "/accounts/login", "/orders/123", "//evil.example.com", "https://evil.example.com", "javascript:alert(1)", ""]) {
            sessionStorage.setItem(TRAIL_KEY, JSON.stringify([odd, "/collections/a"]));
            expect(resolveBackTarget("/collections/a"), odd).toBeNull();
        }
    });
});
