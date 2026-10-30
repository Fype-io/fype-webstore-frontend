import { describe, expect, it } from "vitest";
import { normalizeOrderStatus, orderStatusLabel, orderStatusTone, trackingProgress } from "../order-status";

// Order statuses as the shopper sees them (lib/order-status.ts): labels, badge
// tones and the tracking popup's steps, for every status the backend writes.

describe("normalizeOrderStatus", () => {
    it.each([
        ["Out For Delivery", "out_for_delivery"],
        ["out-for-delivery", "out_for_delivery"],
        ["DELIVERY_FAILED", "delivery_failed"],
        ["booked", "pending"],
        ["return_in_progress", "rto_in_progress"], // only RTO ever wrote it
        ["", ""],
        [undefined, ""],
    ])("%p -> %p", (raw, expected) => {
        expect(normalizeOrderStatus(raw)).toBe(expected);
    });
});

describe("orderStatusLabel", () => {
    it.each([
        ["out_for_delivery", "Out For Delivery"],
        ["delivery_failed", "Delivery Failed"],
        ["rto_in_progress", "Returning To Seller"],
        ["rto_complete", "Returned To Seller"],
        ["return_pending", "Return Requested"],
        ["return_in_transit", "Return On Its Way"],
        ["return_complete", "Returned"],
        ["partially_returned", "Partially Returned"],
        ["return_in_progress", "Returning To Seller"],
        ["in_transit", "In Transit"],
        ["something_new", "Something New"],
    ])("%p -> %p", (status, label) => {
        expect(orderStatusLabel(status)).toBe(label);
    });
});

describe("orderStatusTone", () => {
    it.each([
        ["delivered", "success"],
        ["delivery_failed", "danger"],
        ["cancelled", "danger"],
        ["refunded", "refund"],
        ["out_for_delivery", "info"],
        ["rto_in_progress", "warning"],
        ["return_pending", "warning"],
        ["partially_returned", "warning"],
        ["pending", "neutral"],
    ])("%p -> %p", (status, tone) => {
        expect(orderStatusTone(status)).toBe(tone);
    });
});

describe("trackingProgress", () => {
    it.each([
        ["pending", 0],
        ["confirmed", 1],
        ["in_transit", 3],
        ["out_for_delivery", 4],
        ["Out For Delivery", 4],
        ["delivered", 5],
        ["partially_delivered", 5],
    ])("%p is step %p", (status, step) => {
        expect(trackingProgress(status)).toEqual({ endCard: null, currentStep: step, deliveryFailed: false });
    });

    it("a failed attempt stays on Out for Delivery, marked failed (the courier tries again)", () => {
        expect(trackingProgress("delivery_failed")).toEqual({ endCard: null, currentStep: 4, deliveryFailed: true });
    });

    it.each([
        ["cancelled", "Order Cancelled"],
        ["refunded", "Order Refunded"],
        ["return_pending", "Return Requested"],
        ["return_in_transit", "Return On Its Way"],
        ["return_complete", "Order Returned"],
        ["returned", "Order Returned"],
        ["partially_returned", "Some Items Returned"],
        ["rto_in_progress", "Returning To The Seller"],
        ["return_in_progress", "Returning To The Seller"],
        ["rto_complete", "Returned To The Seller"],
    ])("%p shows the card %p instead of the steps", (status, label) => {
        const progress = trackingProgress(status);
        expect(progress.endCard?.label).toBe(label);
        expect(progress.currentStep).toBe(-1);
    });

    it("an unknown status shows the steps with none active, never a blank card", () => {
        expect(trackingProgress("lost_in_space")).toEqual({ endCard: null, currentStep: -1, deliveryFailed: false });
    });
});
