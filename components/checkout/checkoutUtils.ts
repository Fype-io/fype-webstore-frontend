import type { Address, CartItem } from "@/redux/slices/userSlice";
import { countryName } from "./ui/countries";
import { formatPrice } from "@/lib/currency";

export type CheckoutViewState = "checkout" | "add-address" | "select-address" | "payment-methods";
// Widened from a closed 'upi'|'card'|'netbanking'|'cod' union: method ids are
// now gateway-namespaced (e.g. "razorpay_upi", "stripe_card") since each
// active gateway adapter contributes its own methods - see
// types/checkoutGateway.ts's PaymentMethodOption. "cod" remains the one
// literal id outside any gateway adapter (manual payment, not a gateway).
export type PaymentMethodId = string;

export function addressKey(address: Address): string {
    return address.addressId || address._id || "";
}

export function addressDisplayName(address: Address): string {
    return [address.firstName, address.lastName].filter(Boolean).join(" ").trim() || "Address";
}

export function addressDetails(address: Address): string {
    const country = countryName(address.country);
    return [address.addressLine1, address.addressLine2, address.city, address.state, country, address.postalCode]
        .filter(Boolean)
        .join(", ");
}

export function addressTypeLabel(address: Address): string {
    return address.isDefault ? "Default" : "Home";
}

export function variantLabel(item: CartItem): string {
    if (!item.options) return "";
    return Object.values(item.options).filter(Boolean).join(" / ");
}

// Cash on delivery as the store set it (public settings payment.cod). enabled
// null/undefined: never saved - the legacy rule applies (COD only when no
// online gateway is active). A minimum order value hides COD below it.
export interface CodSetting {
    enabled?: boolean | null;
    minOrderValue?: number | null;
}

export function codAvailability(cod: CodSetting | undefined, hasPaymentGateway: boolean, total: number): { offered: boolean; minimum: number | null } {
    const enabled = cod?.enabled;
    if (enabled === false) return { offered: false, minimum: null };
    if (enabled !== true) return { offered: !hasPaymentGateway, minimum: null };
    const min = typeof cod?.minOrderValue === "number" && cod.minOrderValue > 0 ? cod.minOrderValue : null;
    if (min !== null && total < min) return { offered: false, minimum: min };
    return { offered: true, minimum: null };
}

export const PAYMENTS_UNAVAILABLE_MESSAGE = "This store isn't accepting payments right now. Please contact the store.";

/** An amount in the store's currency ("₹500", "$25", "AED 100"); INR when the currency is unknown. */
export function formatStoreMoney(amount: number, currency?: string | null): string {
    return formatPrice(amount, currency);
}

export function splitName(fullName: string): { firstName: string; lastName: string } {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return { firstName: parts[0], lastName: "" };
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}
