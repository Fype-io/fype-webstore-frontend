import { describe, it, expect } from "vitest";
import { canBuy, productContinueSelling, variantContinueSelling } from "@/lib/stock";

// The product page decides "can this be bought" the way the backend's checkout does.

describe("canBuy", () => {
    it("buys what is in stock, refuses what is not", () => {
        expect(canBuy({ available: 3, trackQuantity: true })).toBe(true);
        expect(canBuy({ available: 0, trackQuantity: true })).toBe(false);
        expect(canBuy({ available: undefined, trackQuantity: true })).toBe(false);
        expect(canBuy({ available: null })).toBe(false);
    });

    it("an item that does not track quantity is always buyable", () => {
        expect(canBuy({ available: 0, trackQuantity: false })).toBe(true);
    });

    it("selling past zero makes it buyable", () => {
        expect(canBuy({ available: 0, trackQuantity: true, continueSelling: true })).toBe(true);
        expect(canBuy({ available: 0, trackQuantity: true, continueSelling: false })).toBe(false);
    });
});

describe("continue selling", () => {
    it("the product's switch is read from whichever field the response carries", () => {
        expect(productContinueSelling({ continueSelling: true })).toBe(true);
        expect(productContinueSelling({ inventory: { continueSelling: true } })).toBe(true);
        expect(productContinueSelling({ continueSellWhenOutOfStock: true })).toBe(true);
        expect(productContinueSelling({})).toBe(false);
        expect(productContinueSelling({ continueSelling: false, continueSellWhenOutOfStock: true })).toBe(false);
    });

    it("a variant's own switch wins, else the product's", () => {
        expect(variantContinueSelling({ continueSelling: true }, { continueSelling: false })).toBe(true);
        expect(variantContinueSelling({ continueSelling: false }, { continueSelling: true })).toBe(false);
        expect(variantContinueSelling({}, { continueSelling: true })).toBe(true);
        expect(variantContinueSelling({}, {})).toBe(false);
    });
});
