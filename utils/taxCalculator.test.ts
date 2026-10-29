import { describe, it, expect } from "vitest";
import { calculateProductTax, taxLineLabel } from "./taxCalculator";

const inclusive = { inclusivePricing: { webstore: true } };

describe("calculateProductTax - the server's effective rate decides", () => {
    it("shows price + tax when prices include tax, at the effective rate", () => {
        expect(calculateProductTax(200, { ...inclusive, global: true, rate: 5 }, { effectiveRate: 5 }).displayPrice).toBe("210");
    });

    it("never taxes a product whose effective rate is 0, even when the store has a rate (no fallback to the store rate)", () => {
        expect(calculateProductTax(200, { ...inclusive, global: false, rate: 18 }, { applied: false, effectiveRate: 0 }).displayPrice).toBe("200");
    });

    it("uses a variant's own rate rather than the product's", () => {
        expect(calculateProductTax(100, inclusive, { applied: true, rate: 5, effectiveRate: 18 }).displayPrice).toBe("118");
    });

    it("leaves the price alone when prices do not include tax (tax is added at checkout)", () => {
        expect(calculateProductTax(200, { global: true, rate: 5 }, { effectiveRate: 5 }).displayPrice).toBe("200");
    });

    it("an older API without effectiveRate keeps the previous behaviour", () => {
        expect(calculateProductTax(100, { ...inclusive, global: true, rate: 10 }, {}).displayPrice).toBe("110");
        expect(calculateProductTax(100, inclusive, { applied: true, rate: 12 }).displayPrice).toBe("112");
    });
});

describe("taxLineLabel", () => {
    it("names the tax and its rate", () => {
        expect(taxLineLabel({ type: "CGST", rate: 9 })).toBe("CGST (9%)");
        expect(taxLineLabel({ type: "VAT", rate: 5 })).toBe("VAT (5%)");
        expect(taxLineLabel({ type: "VAT", rate: 0 })).toBe("VAT");
    });
});
