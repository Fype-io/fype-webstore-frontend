import { describe, expect, it } from "vitest";
import { productHref } from "../product-url";

describe("productHref", () => {
    it("links to the slug", () => {
        expect(productHref({ productId: "PROD-abc", slug: "blue-shirt" })).toBe("/products/blue-shirt");
    });

    it("falls back to the product id when there is no slug yet (null, undefined or empty)", () => {
        expect(productHref({ productId: "PROD-abc", slug: null })).toBe("/products/PROD-abc");
        expect(productHref({ productId: "PROD-abc" })).toBe("/products/PROD-abc");
        expect(productHref({ productId: "PROD-abc", slug: "" })).toBe("/products/PROD-abc");
    });

    it("adds ?variant= when a variant id is given", () => {
        expect(productHref({ productId: "PROD-abc", slug: "blue-shirt" }, "VAR-123")).toBe("/products/blue-shirt?variant=VAR-123");
        expect(productHref({ productId: "PROD-abc", slug: null }, "VAR-123")).toBe("/products/PROD-abc?variant=VAR-123");
    });

    it("leaves the plain path when the variant id is empty or null", () => {
        expect(productHref({ productId: "P", slug: "s" }, "")).toBe("/products/s");
        expect(productHref({ productId: "P", slug: "s" }, null)).toBe("/products/s");
    });

    it("encodes anything unsafe in a path segment", () => {
        expect(productHref({ productId: "P", slug: "a/b c" })).toBe("/products/a%2Fb%20c");
    });
});
