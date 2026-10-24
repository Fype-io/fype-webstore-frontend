import { describe, it, expect } from "vitest";
import { codAvailability, codChargeOf, formatStoreMoney } from "../checkoutUtils";
import { defaultAddressCountry, providerSupportsCod, quotesByCity, resolveShipmentProvider } from "@/lib/shipment-provider";

describe("codAvailability", () => {
    it("never saved: COD only when no gateway is active", () => {
        expect(codAvailability(undefined, false, 100, "dtdc")).toEqual({ offered: true, minimum: null });
        expect(codAvailability({ enabled: null }, true, 100, "dtdc")).toEqual({ offered: false, minimum: null });
    });

    it("follows the saved setting, with or without gateways", () => {
        expect(codAvailability({ enabled: true }, true, 100, "delhivery")).toEqual({ offered: true, minimum: null });
        expect(codAvailability({ enabled: false }, false, 100, "delhivery")).toEqual({ offered: false, minimum: null });
    });

    it("hides COD below the minimum order value; at or above it, offers it", () => {
        expect(codAvailability({ enabled: true, minOrderValue: 500 }, false, 499.99, "dtdc")).toEqual({ offered: false, minimum: 500 });
        expect(codAvailability({ enabled: true, minOrderValue: 500 }, false, 500, "dtdc")).toEqual({ offered: true, minimum: null });
        expect(codAvailability({ enabled: true, minOrderValue: 0 }, false, 1, "dtdc")).toEqual({ offered: true, minimum: null });
    });

    it("never offers COD with manual shipping (no logistics app to collect the cash), whatever the setting", () => {
        expect(codAvailability({ enabled: true }, false, 100, "manual")).toEqual({ offered: false, minimum: null });
        expect(codAvailability({ enabled: null }, false, 100, "manual")).toEqual({ offered: false, minimum: null });
        expect(codAvailability(undefined, false, 100, "manual")).toEqual({ offered: false, minimum: null });
    });
});

describe("resolveShipmentProvider (same rule as crmApp's shippingQuote)", () => {
    const shop = (logistics: object | undefined) => ({ settings: { logistics } }) as Parameters<typeof resolveShipmentProvider>[0];

    it("DTDC, then Delhivery, when active and enabled; otherwise manual", () => {
        expect(resolveShipmentProvider(shop({ active: ["dtdc"], dtdc: { enabled: true } }))).toBe("dtdc");
        expect(resolveShipmentProvider(shop({ active: ["dtdc", "delhivery"], dtdc: { enabled: true }, delhivery: { enabled: true } }))).toBe("dtdc");
        expect(resolveShipmentProvider(shop({ active: ["delhivery"], delhivery: { enabled: true } }))).toBe("delhivery");
        // Listed but not enabled, enabled but not listed, or nothing set up: manual.
        expect(resolveShipmentProvider(shop({ active: ["dtdc"], dtdc: { enabled: false } }))).toBe("manual");
        expect(resolveShipmentProvider(shop({ active: ["manualShipping"], delhivery: { enabled: true } }))).toBe("manual");
        expect(resolveShipmentProvider(shop(undefined))).toBe("manual");
        expect(resolveShipmentProvider(null)).toBe("manual");
    });

    it("Jeebly after DTDC and Delhivery, when active and enabled", () => {
        expect(resolveShipmentProvider(shop({ active: ["jeebly"], jeebly: { enabled: true } }))).toBe("jeebly");
        expect(resolveShipmentProvider(shop({ active: ["delhivery", "jeebly"], delhivery: { enabled: true }, jeebly: { enabled: true } }))).toBe("delhivery");
        expect(resolveShipmentProvider(shop({ active: ["jeebly"], jeebly: { enabled: false } }))).toBe("manual");
    });

    it("the couriers collect cash on delivery; manual shipping doesn't", () => {
        expect(providerSupportsCod("dtdc")).toBe(true);
        expect(providerSupportsCod("delhivery")).toBe(true);
        expect(providerSupportsCod("jeebly")).toBe(true);
        expect(providerSupportsCod("manual")).toBe(false);
    });

    it("a Jeebly store's new addresses start in the UAE; other stores leave it to the shopper", () => {
        expect(defaultAddressCountry("jeebly")).toBe("AE");
        expect(defaultAddressCountry("dtdc")).toBeUndefined();
        expect(defaultAddressCountry("delhivery")).toBeUndefined();
        expect(defaultAddressCountry("manual")).toBeUndefined();
    });

    it("only Jeebly quotes by city instead of a pincode", () => {
        expect(quotesByCity("jeebly")).toBe(true);
        expect(quotesByCity("dtdc")).toBe(false);
        expect(quotesByCity("delhivery")).toBe(false);
        expect(quotesByCity("manual")).toBe(false);
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

describe("codChargeOf", () => {
    const shop = (codCharge?: unknown) => ({ settings: { logistics: { jeebly: { codCharge } } } }) as never;

    it("is Jeebly's COD charge per order", () => {
        expect(codChargeOf(shop(5), "jeebly")).toBe(5);
    });

    it.each([
        ["another courier", shop(5), "dtdc"],
        ["no charge set", shop(undefined), "jeebly"],
        ["a zero charge", shop(0), "jeebly"],
        ["a negative charge", shop(-1), "jeebly"],
        ["text", shop("abc"), "jeebly"],
        ["no shop", null, "jeebly"],
    ])("is 0 for %s", (_label, s, provider) => {
        expect(codChargeOf(s, provider)).toBe(0);
    });
});
