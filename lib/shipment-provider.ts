import type { ShopIdentity } from "@/types/storefront";

// The store's shipment provider, resolved the same way crmApp does
// (shippingQuote.service.ts resolveShipmentProvider): DTDC, then Delhivery, when
// active and enabled; otherwise "manual" (no logistics app - the merchant ships
// it). Order creation prices and books shipping with the backend's copy of this
// rule, so the two must stay in step.
export type ShipmentProvider = "dtdc" | "delhivery" | "manual";

export function resolveShipmentProvider(shop: Pick<ShopIdentity, "settings"> | null | undefined): ShipmentProvider {
    const logistics = shop?.settings?.logistics;
    const active = logistics?.active ?? ["manualShipping"];
    if (active.includes("dtdc") && logistics?.dtdc?.enabled) return "dtdc";
    if (active.includes("delhivery") && logistics?.delhivery?.enabled) return "delhivery";
    return "manual";
}

// Providers whose integration collects cash on delivery (crmApp's
// codSetting.service.ts COD_SHIPMENT_PROVIDERS). Manual shipping has no courier
// to collect it, so COD is never offered there.
const COD_SHIPMENT_PROVIDERS: readonly ShipmentProvider[] = ["dtdc", "delhivery"];

export function providerSupportsCod(provider: ShipmentProvider): boolean {
    return COD_SHIPMENT_PROVIDERS.includes(provider);
}
