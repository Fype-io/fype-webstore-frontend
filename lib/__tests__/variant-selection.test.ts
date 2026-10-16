import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { galleryImages, initialSelectedOptions, syncVariantParam } from "../variant-selection";

const options = [
    { name: "Size", values: ["50ML", "100ML"] },
    { name: "Strength", values: ["EDP", "Parfum"] },
];
const variants = [
    { variantId: "VAR-1", options: { Size: "50ML", Strength: "EDP" } },
    { variantId: "VAR-2", options: { Size: "100ML", Strength: "EDP" } },
    { variantId: "VAR-3", options: { Size: "100ML", Strength: "Parfum" } },
];

describe("galleryImages", () => {
    it("shows the product's own images until a variant is chosen", () => {
        expect(galleryImages(["base.jpg"], ["var.jpg"], false)).toEqual(["base.jpg"]);
    });

    it("shows the chosen variant's images", () => {
        expect(galleryImages(["base.jpg"], ["var.jpg"], true)).toEqual(["var.jpg"]);
    });

    it("falls back to the other side when one has no images, ignoring blank entries", () => {
        expect(galleryImages([], ["var.jpg"], false)).toEqual(["var.jpg"]);
        expect(galleryImages(undefined, ["var.jpg"], false)).toEqual(["var.jpg"]);
        expect(galleryImages(["base.jpg"], [""], true)).toEqual(["base.jpg"]);
        expect(galleryImages(["base.jpg"], undefined, true)).toEqual(["base.jpg"]);
        expect(galleryImages([" "], [], false)).toEqual([]);
    });
});

describe("initialSelectedOptions", () => {
    it("starts on the first value of every option when no variant is requested", () => {
        expect(initialSelectedOptions(options, variants)).toEqual({ Size: "50ML", Strength: "EDP" });
        expect(initialSelectedOptions(options, variants, null)).toEqual({ Size: "50ML", Strength: "EDP" });
        expect(initialSelectedOptions(options, variants, "")).toEqual({ Size: "50ML", Strength: "EDP" });
    });

    it("starts on the requested variant's options", () => {
        expect(initialSelectedOptions(options, variants, "VAR-3")).toEqual({ Size: "100ML", Strength: "Parfum" });
        expect(initialSelectedOptions(options, variants, "VAR-2")).toEqual({ Size: "100ML", Strength: "EDP" });
    });

    it("ignores an unknown, stale or other product's variant id", () => {
        expect(initialSelectedOptions(options, variants, "VAR-gone")).toEqual({ Size: "50ML", Strength: "EDP" });
    });

    it("falls back per option when the variant has a value the product no longer offers", () => {
        const stale = [{ variantId: "VAR-9", options: { Size: "200ML", Strength: "Parfum" } }];
        expect(initialSelectedOptions(options, stale, "VAR-9")).toEqual({ Size: "50ML", Strength: "Parfum" });
    });

    it("skips an option with no values and returns nothing for a product without options", () => {
        expect(initialSelectedOptions([{ name: "Empty", values: [] }], [])).toEqual({});
        expect(initialSelectedOptions([], variants, "VAR-1")).toEqual({});
    });
});

describe("syncVariantParam", () => {
    beforeEach(() => {
        window.history.replaceState(null, "", "/products/blue-shirt?utm_source=ad#reviews");
    });
    afterEach(() => {
        window.history.replaceState(null, "", "/");
    });

    it("adds ?variant= and keeps the other parameters and the hash", () => {
        syncVariantParam("VAR-2");
        expect(window.location.pathname + window.location.search + window.location.hash).toBe(
            "/products/blue-shirt?utm_source=ad&variant=VAR-2#reviews"
        );
    });

    it("replaces a different variant and removes it when there is none", () => {
        syncVariantParam("VAR-2");
        syncVariantParam("VAR-3");
        expect(new URLSearchParams(window.location.search).get("variant")).toBe("VAR-3");
        syncVariantParam(null);
        expect(window.location.search).toBe("?utm_source=ad");
    });

    it("does not add a history entry", () => {
        const before = window.history.length;
        syncVariantParam("VAR-2");
        syncVariantParam("VAR-3");
        expect(window.history.length).toBe(before);
    });

    it("does nothing when the address already matches", () => {
        let calls = 0;
        const original = window.history.replaceState.bind(window.history);
        window.history.replaceState = ((...args: Parameters<History["replaceState"]>) => {
            calls += 1;
            return original(...args);
        }) as History["replaceState"];
        try {
            syncVariantParam(null);
            expect(calls).toBe(0);
        } finally {
            window.history.replaceState = original;
        }
    });
});
