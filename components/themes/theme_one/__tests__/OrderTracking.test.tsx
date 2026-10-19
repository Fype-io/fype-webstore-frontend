import { describe, expect, it } from "vitest";
import { trackingReference } from "../OrderTracking";

describe("trackingReference", () => {
    it("shows the order number as it is - it already has the store's # prefix", () => {
        expect(trackingReference("#1000", true)).toEqual({ text: "#1000", label: "Order Number" });
    });

    it("shows an order number with any other prefix unchanged", () => {
        expect(trackingReference("FY-1000", true)).toEqual({ text: "FY-1000", label: "Order Number" });
    });

    it("prefixes an AWB with # and labels it as one", () => {
        expect(trackingReference("7X1234567", false)).toEqual({ text: "#7X1234567", label: "AWB Number" });
    });
});
