import { describe, it, expect } from "vitest";
import { codAvailability, formatStoreMoney } from "../checkoutUtils";

describe("codAvailability", () => {
    it("never saved: COD only when no gateway is active", () => {
        expect(codAvailability(undefined, false, 100)).toEqual({ offered: true, minimum: null });
        expect(codAvailability({ enabled: null }, true, 100)).toEqual({ offered: false, minimum: null });
    });

    it("follows the saved setting, with or without gateways", () => {
        expect(codAvailability({ enabled: true }, true, 100)).toEqual({ offered: true, minimum: null });
        expect(codAvailability({ enabled: false }, false, 100)).toEqual({ offered: false, minimum: null });
    });

    it("hides COD below the minimum order value; at or above it, offers it", () => {
        expect(codAvailability({ enabled: true, minOrderValue: 500 }, false, 499.99)).toEqual({ offered: false, minimum: 500 });
        expect(codAvailability({ enabled: true, minOrderValue: 500 }, false, 500)).toEqual({ offered: true, minimum: null });
        expect(codAvailability({ enabled: true, minOrderValue: 0 }, false, 1)).toEqual({ offered: true, minimum: null });
    });
});

describe("formatStoreMoney", () => {
    it("formats in the store's currency, INR when unknown", () => {
        expect(formatStoreMoney(500, "INR")).toBe("₹500");
        expect(formatStoreMoney(25.5, "USD")).toBe("$25.5");
        expect(formatStoreMoney(100, "AED")).toMatch(/^AED\s100$/);
        expect(formatStoreMoney(500, null)).toBe("₹500");
    });
});
