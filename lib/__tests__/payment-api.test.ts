import { describe, it, expect, vi, beforeEach } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { createGatewayOrder } from "@/lib/payment-api";
import { getAuthToken, postApi } from "@/lib/client-api";
import { payButtonLabel } from "@/hooks/useStripeAdapter";

vi.mock("@/lib/client-api", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/client-api")>();
    return { ...actual, getAuthToken: vi.fn(), postApi: vi.fn() };
});

// Server-priced checkout (crmApp PR1): payment/order now prices the cart itself
// and needs the shipping address; `amount` is still sent for an older backend.

const SHIPPING = { fullName: "Test User", addressLine1: "1 Test Street", city: "Kochi", state: "Kerala", postalCode: "682001", country: "India" };

describe("createGatewayOrder", () => {
    beforeEach(() => {
        vi.mocked(getAuthToken).mockReturnValue("token");
        vi.mocked(postApi).mockReset();
    });

    it("sends the shipping address (and the legacy amount) and returns the server's priced order", async () => {
        vi.mocked(postApi).mockResolvedValue({
            data: { success: true, data: { orderId: "order_1", amount: 51198, currency: "INR", checkoutId: "chk-1", keyId: "rzp_test_x" } },
        } as unknown as Awaited<ReturnType<typeof postApi>>);

        const result = await createGatewayOrder("store-1", "razorpay", { amount: 50000, shippingAddress: SHIPPING });

        expect(postApi).toHaveBeenCalledWith("/commerce/store-1/orders/payment/order?provider=razorpay", { amount: 50000, shippingAddress: SHIPPING });
        expect(result).toMatchObject({ orderId: "order_1", amount: 51198, checkoutId: "chk-1" });
    });

    it("throws the backend's message so checkout can show it", async () => {
        const error = new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
            status: 400, statusText: "Bad Request", headers: {}, config: { headers: new AxiosHeaders() },
            data: { success: false, code: "PINCODE_NOT_SERVICEABLE", message: "We do not deliver to this pincode yet." },
        });
        vi.mocked(postApi).mockRejectedValue(error);

        await expect(createGatewayOrder("store-1", "stripe", { amount: 1, shippingAddress: SHIPPING }))
            .rejects.toThrow("We do not deliver to this pincode yet.");
    });

    it("returns null without calling the API when the customer isn't logged in", async () => {
        vi.mocked(getAuthToken).mockReturnValue(null);
        expect(await createGatewayOrder("store-1", "razorpay", { amount: 1, shippingAddress: SHIPPING })).toBeNull();
        expect(postApi).not.toHaveBeenCalled();
    });
});

describe("payButtonLabel", () => {
    it("shows the amount the backend priced", () => {
        expect(payButtonLabel(51198, "inr")).toBe("Pay ₹511.98");
    });

    it("falls back to plain Pay for unusable input", () => {
        expect(payButtonLabel(Number.NaN, "INR")).toBe("Pay");
        expect(payButtonLabel(100, "")).toBe("Pay");
        expect(payButtonLabel(100, "NOT-A-CURRENCY")).toBe("Pay");
    });
});
