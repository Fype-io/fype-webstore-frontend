import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useStripeAdapter } from "../useStripeAdapter";
import { createGatewayOrder, verifyGatewayPayment } from "@/lib/payment-api";
import { loadStripe } from "@stripe/stripe-js";

vi.mock("@/lib/payment-api", () => ({
    createGatewayOrder: vi.fn(),
    verifyGatewayPayment: vi.fn(),
}));

vi.mock("@stripe/stripe-js", () => ({
    loadStripe: vi.fn(),
}));

// Mirrors useRazorpayAdapter.test.ts's coverage shape for the new adapter, per
// the plan. Stripe's own confirmPayment/Elements flow is mocked - this tests
// the adapter's contract (readiness gating, order-creation call, verification
// call, gatewayRef shape), not Stripe.js's real UI.

function mockStripeInstance(overrides: Partial<{ confirmPayment: any }> = {}) {
    return {
        elements: vi.fn().mockReturnValue({
            create: vi.fn().mockReturnValue({ mount: vi.fn() }),
        }),
        confirmPayment: overrides.confirmPayment ?? vi.fn().mockResolvedValue({ paymentIntent: { id: "pi_mock1" } }),
    };
}

const SHIPPING = { fullName: "Test User", addressLine1: "1 Test Street", city: "Kochi", state: "Kerala", postalCode: "682001", country: "India" };

// amount 10000 (minor units) in INR, as the backend returns it.
const PAY_LABEL = "Pay ₹100.00";

describe("useStripeAdapter", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("is not ready when no publishableKey is provided (gateway not active)", () => {
        const { result } = renderHook(() => useStripeAdapter({ storeId: "store-1", publishableKey: undefined }));

        expect(result.current.key).toBe("stripe");
        expect(result.current.isReady).toBe(false);
        expect(loadStripe).not.toHaveBeenCalled();
    });

    it("loads Stripe.js lazily once given a publishableKey, and reports its own method list", async () => {
        vi.mocked(loadStripe).mockResolvedValue(mockStripeInstance() as any);

        const { result } = renderHook(() => useStripeAdapter({ storeId: "store-1", publishableKey: "pk_test_abc" }));

        await waitFor(() => expect(result.current.isReady).toBe(true));
        expect(loadStripe).toHaveBeenCalledWith("pk_test_abc");
        expect(result.current.availableMethods).toEqual([
            { id: "stripe_card", gatewayKey: "stripe", title: "Card (international)", subtitle: "Visa, Mastercard, Amex via Stripe" },
        ]);
    });

    it("open() rejects if Stripe isn't loaded yet", async () => {
        const { result } = renderHook(() => useStripeAdapter({ storeId: "store-1", publishableKey: undefined }));

        await expect(
            result.current.open({ amount: 10000, shippingAddress: SHIPPING, userDetails: { name: "Test User", phone: "9999999999" } })
        ).rejects.toThrow("Stripe SDK not loaded");
        expect(createGatewayOrder).not.toHaveBeenCalled();
    });

    it("open() creates the order and resolves with a paymentIntentId once verified", async () => {
        vi.mocked(loadStripe).mockResolvedValue(mockStripeInstance() as any);
        vi.mocked(createGatewayOrder).mockResolvedValue({
            orderId: "pi_mock1",
            amount: 10000,
            currency: "inr",
            clientSecret: "pi_mock1_secret",
        });
        vi.mocked(verifyGatewayPayment).mockResolvedValue({ verified: true });

        const { result } = renderHook(() => useStripeAdapter({ storeId: "store-1", publishableKey: "pk_test_abc" }));
        await waitFor(() => expect(result.current.isReady).toBe(true));

        // jsdom has no real layout, and the DOM-mounted Payment Element is
        // clicked programmatically in a real browser - here we just fire the
        // Pay button's click handler directly to simulate the customer
        // completing the form, since the button is injected into
        // document.body by open() before the customer would click it.
        const openPromise = result.current.open({ amount: 10000, shippingAddress: SHIPPING, userDetails: { name: "Test User", phone: "9999999999" } });
        await waitFor(() => {
            const buttons = Array.from(document.body.querySelectorAll("button"));
            expect(buttons.some((b) => b.textContent === PAY_LABEL)).toBe(true);
        });
        const payButton = Array.from(document.body.querySelectorAll("button")).find((b) => b.textContent === PAY_LABEL)!;
        payButton.click();

        const openResult = await openPromise;
        expect(createGatewayOrder).toHaveBeenCalledWith("store-1", "stripe", { amount: 10000, shippingAddress: SHIPPING });
        expect(verifyGatewayPayment).toHaveBeenCalledWith("store-1", "stripe", { paymentIntentId: "pi_mock1" });
        expect(openResult.gatewayRef).toEqual({ paymentIntentId: "pi_mock1" });
        // The overlay must be cleaned up from the DOM after completion.
        expect(document.body.querySelector("button")).toBeNull();
    });

    it("open() rejects when the customer cancels", async () => {
        vi.mocked(loadStripe).mockResolvedValue(mockStripeInstance() as any);
        vi.mocked(createGatewayOrder).mockResolvedValue({
            orderId: "pi_mock2",
            amount: 10000,
            currency: "inr",
            clientSecret: "pi_mock2_secret",
        });

        const { result } = renderHook(() => useStripeAdapter({ storeId: "store-1", publishableKey: "pk_test_abc" }));
        await waitFor(() => expect(result.current.isReady).toBe(true));

        const openPromise = result.current.open({ amount: 10000, shippingAddress: SHIPPING, userDetails: { name: "Test User", phone: "9999999999" } });
        const settled = openPromise.catch((e) => e);
        await waitFor(() => {
            const buttons = Array.from(document.body.querySelectorAll("button"));
            expect(buttons.some((b) => b.textContent === "Cancel")).toBe(true);
        });
        const cancelButton = Array.from(document.body.querySelectorAll("button")).find((b) => b.textContent === "Cancel")!;
        cancelButton.click();

        await expect(settled).resolves.toEqual(new Error("Payment cancelled"));
    });

    it("open() rejects when Stripe's own confirmPayment returns an error", async () => {
        vi.mocked(loadStripe).mockResolvedValue(
            mockStripeInstance({ confirmPayment: vi.fn().mockResolvedValue({ error: { message: "Your card was declined." } }) }) as any
        );
        vi.mocked(createGatewayOrder).mockResolvedValue({
            orderId: "pi_mock3",
            amount: 10000,
            currency: "inr",
            clientSecret: "pi_mock3_secret",
        });

        const { result } = renderHook(() => useStripeAdapter({ storeId: "store-1", publishableKey: "pk_test_abc" }));
        await waitFor(() => expect(result.current.isReady).toBe(true));

        const openPromise = result.current.open({ amount: 10000, shippingAddress: SHIPPING, userDetails: { name: "Test User", phone: "9999999999" } });
        const settled = openPromise.catch((e) => e);
        await waitFor(() => {
            const buttons = Array.from(document.body.querySelectorAll("button"));
            expect(buttons.some((b) => b.textContent === PAY_LABEL)).toBe(true);
        });
        const payButton = Array.from(document.body.querySelectorAll("button")).find((b) => b.textContent === PAY_LABEL)!;
        payButton.click();

        await expect(settled).resolves.toEqual(new Error("Your card was declined."));
        expect(verifyGatewayPayment).not.toHaveBeenCalled();
    });
});
