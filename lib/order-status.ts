/**
 * Order and shipment statuses as the shopper sees them: the badge on My orders
 * (both themes) and the tracking popup's steps. Values are the backend's
 * (crmApp order.model.ts ORDER_STATUSES): rto_* is the courier taking a parcel it
 * couldn't deliver back to the store; return_* / partially_returned follow a
 * return the store started. An unknown value shows title-cased, never blank.
 */

export type OrderStatusTone = "success" | "danger" | "refund" | "info" | "warning" | "neutral";

/** Lowercase snake_case, whatever the spelling ("Out For Delivery", "out-for-delivery"); old names renamed. */
export function normalizeOrderStatus(status?: string | null): string {
    if (!status) return "";
    const s = status.trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (s === "booked") return "pending";
    // Only RTO ever wrote return_in_progress (renamed by the backend migration).
    if (s === "return_in_progress") return "rto_in_progress";
    return s;
}

const LABELS: Record<string, string> = {
    out_for_delivery: "Out For Delivery",
    delivery_failed: "Delivery Failed",
    return_pending: "Return Requested",
    return_in_transit: "Return On Its Way",
    return_complete: "Returned",
    returned: "Returned",
    partially_returned: "Partially Returned",
    rto_in_progress: "Returning To Seller",
    rto_complete: "Returned To Seller",
};

/** "Out For Delivery", "Returning To Seller"; anything else title-cased. */
export function orderStatusLabel(status?: string | null): string {
    const s = normalizeOrderStatus(status);
    if (!s) return "";
    return (
        LABELS[s] ??
        s
            .split("_")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ")
    );
}

export function orderStatusTone(status?: string | null): OrderStatusTone {
    switch (normalizeOrderStatus(status)) {
        case "delivered":
            return "success";
        case "cancelled":
        case "delivery_failed":
            return "danger";
        case "refunded":
            return "refund";
        case "shipped":
        case "in_transit":
        case "out_for_delivery":
        case "partially_delivered":
            return "info";
        case "return_pending":
        case "return_in_transit":
        case "return_complete":
        case "returned":
        case "partially_returned":
        case "rto_in_progress":
        case "rto_complete":
            return "warning";
        default:
            return "neutral";
    }
}

export const TRACKING_STEPS = [
    { key: "pending", label: "Order Placed" },
    { key: "confirmed", label: "Order Confirmed" },
    { key: "shipped", label: "Shipped" },
    { key: "in_transit", label: "In Transit" },
    { key: "out_for_delivery", label: "Out for Delivery" },
    { key: "delivered", label: "Delivered" },
] as const;

/** Statuses past the delivery steps: one card instead of the steps. */
const END_CARDS: Record<string, { label: string; tone: OrderStatusTone }> = {
    cancelled: { label: "Order Cancelled", tone: "danger" },
    refunded: { label: "Order Refunded", tone: "refund" },
    return_pending: { label: "Return Requested", tone: "warning" },
    return_in_transit: { label: "Return On Its Way", tone: "warning" },
    return_complete: { label: "Order Returned", tone: "neutral" },
    returned: { label: "Order Returned", tone: "neutral" },
    partially_returned: { label: "Some Items Returned", tone: "neutral" },
    rto_in_progress: { label: "Returning To The Seller", tone: "warning" },
    rto_complete: { label: "Returned To The Seller", tone: "neutral" },
};

export interface TrackingProgress {
    /** A card in place of the steps (cancelled, refunded, returns, RTO). */
    endCard: { label: string; tone: OrderStatusTone } | null;
    /** Index into TRACKING_STEPS of the current step; -1 when unknown. */
    currentStep: number;
    /** The courier tried and couldn't deliver; it'll try again (shown on the "Out for Delivery" step). */
    deliveryFailed: boolean;
}

/** Where an order (or its shipment) is on the tracking steps. */
export function trackingProgress(status?: string | null): TrackingProgress {
    let s = normalizeOrderStatus(status);
    const endCard = END_CARDS[s] ?? null;
    if (endCard) return { endCard, currentStep: -1, deliveryFailed: false };
    const deliveryFailed = s === "delivery_failed";
    if (deliveryFailed) s = "out_for_delivery";
    if (s === "partially_delivered") s = "delivered";
    return { endCard: null, currentStep: TRACKING_STEPS.findIndex((step) => step.key === s), deliveryFailed };
}
