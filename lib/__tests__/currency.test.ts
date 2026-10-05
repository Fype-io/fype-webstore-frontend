import { describe, it, expect } from "vitest";
import { currencyPrefix, currencySymbol, formatPrice, storeCurrencyCode } from "../currency";

describe("store currency display", () => {
    it("shows AED as its code with a space, never the Arabic sign", () => {
        expect(currencyPrefix("AED")).toBe("AED ");
        expect(formatPrice(1299, "AED")).toBe("AED 1,299");
        expect(formatPrice(1299.5, "AED")).toBe("AED 1,299.5");
        expect(formatPrice(1299, "aed")).toBe("AED 1,299");
        expect(formatPrice(1299, "AED")).not.toMatch(/[؀-ۿ]/);
    });

    it("uses the sign for INR (Indian grouping) and USD", () => {
        expect(formatPrice(129999, "INR")).toBe("₹1,29,999");
        expect(formatPrice(129999, "USD")).toBe("$129,999");
        expect(formatPrice(10, "USD", 2)).toBe("$10.00");
    });

    it("falls back to INR for a store without a (supported) currency, as before", () => {
        expect(storeCurrencyCode(null)).toBe("INR");
        expect(storeCurrencyCode("EUR")).toBe("INR");
        expect(formatPrice(500, undefined)).toBe("₹500");
    });

    it("gives the bare symbol for labels", () => {
        expect(currencySymbol("AED")).toBe("AED");
        expect(currencySymbol("INR")).toBe("₹");
    });

    it("treats a missing or invalid amount as 0", () => {
        expect(formatPrice(undefined, "USD")).toBe("$0");
        expect(formatPrice("abc", "USD")).toBe("$0");
        expect(formatPrice("12.5", "USD")).toBe("$12.5");
    });
});
