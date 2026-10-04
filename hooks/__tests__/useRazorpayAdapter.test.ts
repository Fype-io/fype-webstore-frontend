import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useRazorpayAdapter } from "../useRazorpayAdapter";
import { createGatewayOrder, verifyGatewayPayment } from "@/lib/payment-api";

vi.mock("@/lib/payment-api", () => ({
    createGatewayOrder: vi.fn(),
    verifyGatewayPayment: vi.fn(),
}));

// First-ever test for this hook (the pre-refactor useRazorpay had none) - this
// is the regression baseline proving the refactor into the CheckoutGatewayAdapter
// shape preserved behavior: same script-ready polling, same options shape
// passed to window.Razorpay, same createGatewayOrder/verifyGatewayPayment calls.

const SHIPPING = { fullName: "Test User", addressLine1: "1 Test Street", city: "Kochi", state: "Kerala", postalCode: "682001", country: "India" };

describe("useRazorpayAdapter", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // @ts-expect-error - test-only global stub
        delete window.Razorpay;
    });

    afterEach(() => {
        // @ts-expect-error - test-only global stub
        delete window.Razorpay;
    });

    it("reports key and initial method list even before the SDK loads", () => {
        const { result } = renderHook(() => useRazorpayAdapter({ storeId: "store-1", storeName: "My Shop" }));

        expect(result.current.key).toBe("razorpay");
        expect(result.current.isReady).toBe(false);
        expect(result.current.availableMethods.map((m) => m.id)).toEqual(["razorpay_upi", "razorpay_card", "razorpay_netbanking"]);
        expect(result.current.availableMethods.every((m) => m.gatewayKey === "razorpay")).toBe(true);
    });

    it("becomes ready once window.Razorpay appears (script-ready polling preserved)", async () => {
        const { result } = renderHook(() => useRazorpayAdapter({ storeId: "store-1" }));
        expect(result.current.isReady).toBe(false);

        act(() => {
                        window.Razorpay = vi.fn();
        });

        await waitFor(() => expect(result.current.isReady).toBe(true), { timeout: 1000 });
    });

    it("open() rejects immediately if the SDK isn't ready", async () => {
        const { result } = renderHook(() => useRazorpayAdapter({ storeId: "store-1" }));

        await expect(
            result.current.open({ amount: 10000, shippingAddress: SHIPPING, userDetails: { name: "Test User", phone: "9999999999" } })
        ).rejects.toThrow("Razorpay SDK not loaded");
        expect(createGatewayOrder).not.toHaveBeenCalled();
    });

    it("open() creates the order, opens window.Razorpay with the expected options, and resolves on successful verification", async () => {
        vi.mocked(createGatewayOrder).mockResolvedValue({
            orderId: "order_abc1",
            amount: 10000,
            currency: "INR",
            keyId: "rzp_test_key1",
        });
        vi.mocked(verifyGatewayPayment).mockResolvedValue({ verified: true });

        let capturedOptions: any;
        const rzpOpen = vi.fn();
        const RazorpayMock = vi.fn().mockImplementation((options: any) => {
            capturedOptions = options;
            return { open: rzpOpen };
        });

                window.Razorpay = RazorpayMock;

        const { result } = renderHook(() => useRazorpayAdapter({ storeId: "store-1", storeName: "My Shop" }));
        await waitFor(() => expect(result.current.isReady).toBe(true));

        const openPromise = result.current.open({
            amount: 10000,
            shippingAddress: SHIPPING,
            userDetails: { name: "Test User", email: "test@example.com", phone: "9999999999" },
            methodId: "razorpay_upi",
        });

        await waitFor(() => expect(capturedOptions).toBeDefined());
        expect(createGatewayOrder).toHaveBeenCalledWith("store-1", "razorpay", { amount: 10000, shippingAddress: SHIPPING });
        expect(capturedOptions.key).toBe("rzp_test_key1");
        expect(capturedOptions.amount).toBe(10000);
        expect(capturedOptions.order_id).toBe("order_abc1");
        expect(capturedOptions.prefill).toEqual({ name: "Test User", email: "test@example.com", contact: "9999999999", method: "upi" });
        expect(rzpOpen).toHaveBeenCalled();

        // Simulate Razorpay's own checkout invoking our handler on success.
        await act(async () => {
            await capturedOptions.handler({
                razorpay_order_id: "order_abc1",
                razorpay_payment_id: "pay_abc1",
                razorpay_signature: "sig_abc1",
            });
        });

        const result2 = await openPromise;
        expect(verifyGatewayPayment).toHaveBeenCalledWith("store-1", "razorpay", {
            razorpay_order_id: "order_abc1",
            razorpay_payment_id: "pay_abc1",
            razorpay_signature: "sig_abc1",
        });
        expect(result2.gatewayRef).toEqual({
            razorpay_order_id: "order_abc1",
            razorpay_payment_id: "pay_abc1",
            razorpay_signature: "sig_abc1",
        });
    });

    it("open() rejects when the customer dismisses the Razorpay modal", async () => {
        vi.mocked(createGatewayOrder).mockResolvedValue({
            orderId: "order_abc2",
            amount: 10000,
            currency: "INR",
            keyId: "rzp_test_key1",
        });

        let capturedOptions: any;
                window.Razorpay = vi.fn().mockImplementation((options: any) => {
            capturedOptions = options;
            return { open: vi.fn() };
        });

        const { result } = renderHook(() => useRazorpayAdapter({ storeId: "store-1" }));
        await waitFor(() => expect(result.current.isReady).toBe(true));

        const openPromise = result.current.open({ amount: 10000, shippingAddress: SHIPPING, userDetails: { name: "Test User", phone: "9999999999" } });
        const settled = openPromise.catch((e) => e); // mark as handled immediately, assert below
        await waitFor(() => expect(capturedOptions).toBeDefined());

        act(() => {
            capturedOptions.modal.ondismiss();
        });

        await expect(settled).resolves.toEqual(new Error("Payment cancelled"));
    });

    it("open() rejects when verification fails", async () => {
        vi.mocked(createGatewayOrder).mockResolvedValue({
            orderId: "order_abc3",
            amount: 10000,
            currency: "INR",
            keyId: "rzp_test_key1",
        });
        vi.mocked(verifyGatewayPayment).mockResolvedValue({ verified: false });

        let capturedOptions: any;
                window.Razorpay = vi.fn().mockImplementation((options: any) => {
            capturedOptions = options;
            return { open: vi.fn() };
        });

        const { result } = renderHook(() => useRazorpayAdapter({ storeId: "store-1" }));
        await waitFor(() => expect(result.current.isReady).toBe(true));

        const openPromise = result.current.open({ amount: 10000, shippingAddress: SHIPPING, userDetails: { name: "Test User", phone: "9999999999" } });
        const settled = openPromise.catch((e) => e); // mark as handled immediately, assert below
        await waitFor(() => expect(capturedOptions).toBeDefined());

        await act(async () => {
            await capturedOptions.handler({
                razorpay_order_id: "order_abc3",
                razorpay_payment_id: "pay_abc3",
                razorpay_signature: "bad_sig",
            });
        });

        await expect(settled).resolves.toEqual(new Error("Payment verification failed"));
    });
});
