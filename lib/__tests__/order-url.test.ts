import { describe, expect, it } from "vitest";
import { decodeOrderParam, orderHref, orderSegment } from "../order-url";

const ORDER_ID = "3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b";

describe("orderHref", () => {
    it("links to the order id, so the URL has no %23 for a #-prefixed number", () => {
        expect(orderHref({ orderId: ORDER_ID, orderNumber: "#1000" })).toBe(`/orders/${ORDER_ID}`);
    });

    it("falls back to the encoded order number when there is no id (null, undefined or empty)", () => {
        expect(orderHref({ orderId: null, orderNumber: "#1000" })).toBe("/orders/%231000");
        expect(orderHref({ orderNumber: "#1000" })).toBe("/orders/%231000");
        expect(orderHref({ orderId: "", orderNumber: "#1000" })).toBe("/orders/%231000");
    });

    it("encodes anything else unsafe in the fallback (custom prefix/suffix)", () => {
        expect(orderHref({ orderNumber: "A/B 1000?x" })).toBe("/orders/A%2FB%201000%3Fx");
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
