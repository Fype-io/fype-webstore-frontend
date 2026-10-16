import { describe, expect, it } from "vitest";
import { decodeOrderParam, orderHref, orderSegment } from "../order-url";

describe("orderHref", () => {
    it("encodes the default # prefix so it is not read as a URL fragment", () => {
        expect(orderHref("#1000")).toBe("/orders/%231000");
    });

    it("leaves a plain order number as it is", () => {
        expect(orderHref("1000")).toBe("/orders/1000");
        expect(orderHref("ORD-1000-IN")).toBe("/orders/ORD-1000-IN");
    });

    it("encodes anything else unsafe in a path segment (custom prefix/suffix)", () => {
        expect(orderHref("A/B 1000?x")).toBe("/orders/A%2FB%201000%3Fx");
    });
});

describe("orderSegment", () => {
    it("is the encoded order number alone", () => {
        expect(orderSegment("#1000")).toBe("%231000");
    });
});

describe("decodeOrderParam", () => {
    it("turns the page's encoded param back into the order number", () => {
        expect(decodeOrderParam("%231000")).toBe("#1000");
    });

    it("round-trips with orderSegment", () => {
        for (const n of ["#1000", "1000", "A/B 1000?x", "50%-OFF-1"]) {
            expect(decodeOrderParam(orderSegment(n))).toBe(n);
        }
    });

    it("returns a malformed param unchanged instead of throwing", () => {
        expect(decodeOrderParam("100%")).toBe("100%");
    });
});
