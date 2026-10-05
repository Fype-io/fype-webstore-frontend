import { getApiErrorMessage, getAuthToken, postApi } from "./client-api";
import type { ApiResponse } from "@/types/api";

export interface GatewayOrderResponse {
    orderId: string;
    amount: number;
    currency: string;
    status?: string;
    receipt?: string;
    // Gateway-specific client-side config, spread directly from the backend's
    // clientConfig passthrough (see crmApp payment.controller.ts) - keyId for
    // Razorpay, publishableKey+clientSecret for Stripe. Every field is
    // optional here since which ones exist depends entirely on which gateway
    // responded.
    keyId?: string;
    publishableKey?: string;
    clientSecret?: string;
    // Added by the server-priced checkout: the session reference and the totals
    // (major units) the amount was computed from.
    checkoutId?: string;
    totals?: { subtotal: number; tax: number; shipping: number; discount: number; total: number };
}

export interface GatewayOrderRequest {
    amount: number;
    shippingAddress: Record<string, unknown>;
    billingAddress?: Record<string, unknown>;
}

interface PaymentVerificationResponse {
    verified: boolean;
    orderId?: string;
}

/**
 * Opens a payment for the customer's cart with any registered gateway (crmApp's
 * payment.controller.ts dispatches ?provider=<key> through its PaymentGateway
 * registry). The backend prices the cart itself (server cart, tax, and shipping
 * for `shippingAddress`) and returns the amount to charge; `amount` is only sent
 * so an older backend still works during the rollout.
 *
 * Returns null when the customer isn't logged in. Throws with the backend's
 * message otherwise (e.g. "We do not deliver to this pincode yet."), so checkout
 * can show it instead of a generic failure.
 */
export async function createGatewayOrder(storeId: string, provider: string, request: GatewayOrderRequest): Promise<GatewayOrderResponse | null> {
    if (!getAuthToken()) {
        console.warn("[payment-api] User not authenticated, cannot initiate payment");
        return null;
    }

    try {
        const response = await postApi<ApiResponse<GatewayOrderResponse>>(`/commerce/${storeId}/orders/payment/order?provider=${provider}`, {
            amount: request.amount,
            shippingAddress: request.shippingAddress,
            ...(request.billingAddress ? { billingAddress: request.billingAddress } : {}),
        });

        if (response.data.success) return response.data.data;
        throw new Error(response.data.message || "Could not start the payment. Please try again.");
    } catch (error) {
        console.error(`Failed to create ${provider} order:`, error);
        throw new Error(getApiErrorMessage(error, "Could not start the payment. Please try again."));
    }
}

/**
 * Payment verification for any registered gateway. `paymentDetails` shape is
 * gateway-specific (Razorpay: razorpay_order_id/payment_id/signature; Stripe:
 * paymentIntentId) - passed through as-is to the backend, which dispatches it
 * to the matching gateway's verifyPayment().
 */
export async function verifyGatewayPayment(
    storeId: string,
    provider: string,
    paymentDetails: Record<string, unknown>
): Promise<PaymentVerificationResponse | null> {
    try {
        const response = await postApi<ApiResponse<PaymentVerificationResponse>>(
            `/commerce/${storeId}/orders/payment/verify?provider=${provider}`,
            paymentDetails
        );

        if (response.data.success) return response.data.data;
        return null;
    } catch (error) {
        console.error(`${provider} payment verification failed:`, error);
        return null;
    }
}
