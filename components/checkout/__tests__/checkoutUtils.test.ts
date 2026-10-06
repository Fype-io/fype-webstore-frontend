import { describe, it, expect } from "vitest";
import { codAvailability, formatStoreMoney } from "../checkoutUtils";
import { providerSupportsCod, resolveShipmentProvider } from "@/lib/shipment-provider";

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

    it("only DTDC and Delhivery collect cash on delivery", () => {
        expect(providerSupportsCod("dtdc")).toBe(true);
        expect(providerSupportsCod("delhivery")).toBe(true);
        expect(providerSupportsCod("manual")).toBe(false);
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
