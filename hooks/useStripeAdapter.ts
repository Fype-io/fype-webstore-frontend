"use client";

import { useCallback, useEffect, useState } from "react";
import { loadStripe, type Stripe, type StripeElements } from "@stripe/stripe-js";
import { createGatewayOrder, verifyGatewayPayment } from "@/lib/payment-api";
import type { CheckoutGatewayAdapter, GatewayOpenResult, GatewayOrderRef, PaymentMethodOption } from "@/types/checkoutGateway";

interface UseStripeAdapterOptions {
    storeId: string;
    /** shop.settings.payment.stripe.publishableKey - required, not fetched
     * internally, so loading stays gated on the caller already knowing
     * 'stripe' is active (see useActiveGateways) rather than this hook making
     * its own settings call. */
    publishableKey: string | undefined;
}

const STRIPE_METHODS: PaymentMethodOption[] = [
    { id: "stripe_card", gatewayKey: "stripe", title: "Card (international)", subtitle: "Visa, Mastercard, Amex via Stripe" },
];

/**
 * Mounts Stripe's Payment Element into a minimal full-screen overlay (Stripe's
 * core SDK has no prebuilt popup the way Razorpay's checkout.js does - this is
 * the plain-JS equivalent of Razorpay's own modal, not a redirect flow) and
 * resolves once the customer completes or cancels payment.
 */
/** "Pay ₹511.98": the amount the backend priced, so the customer sees what they'll be charged. */
export function payButtonLabel(amountMinor: number, currency: string): string {
    if (!Number.isFinite(amountMinor) || !currency) return "Pay";
    try {
        const formatted = new Intl.NumberFormat("en-IN", { style: "currency", currency: currency.toUpperCase() }).format(amountMinor / 100);
        return `Pay ${formatted}`;
    } catch {
        return "Pay";
    }
}

function collectStripePayment(stripe: Stripe, clientSecret: string, payLabel = "Pay"): Promise<{ paymentIntentId: string } | null> {
    return new Promise((resolve, reject) => {
        const overlay = document.createElement("div");
        overlay.style.cssText =
            "position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);";
        const modal = document.createElement("div");
        modal.style.cssText = "background:#fff;border-radius:16px;padding:24px;width:100%;max-width:420px;";
        const paymentElementContainer = document.createElement("div");
        const payButton = document.createElement("button");
        payButton.textContent = payLabel;
        payButton.style.cssText =
            "width:100%;margin-top:16px;padding:12px;background:#000;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;";
        const cancelButton = document.createElement("button");
        cancelButton.textContent = "Cancel";
        cancelButton.style.cssText = "width:100%;margin-top:8px;padding:12px;background:transparent;border:none;color:#666;cursor:pointer;";

        modal.appendChild(paymentElementContainer);
        modal.appendChild(payButton);
        modal.appendChild(cancelButton);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const cleanup = () => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        };

        const elements: StripeElements = stripe.elements({ clientSecret });
        const paymentElement = elements.create("payment");
        paymentElement.mount(paymentElementContainer);

        cancelButton.onclick = () => {
            cleanup();
            resolve(null);
        };

        payButton.onclick = async () => {
            payButton.disabled = true;
            const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: "if_required" });
            if (error) {
                cleanup();
                reject(new Error(error.message || "Payment failed"));
                return;
            }
            cleanup();
            resolve({ paymentIntentId: paymentIntent.id });
        };
    });
}

export function useStripeAdapter({ storeId, publishableKey }: UseStripeAdapterOptions): CheckoutGatewayAdapter {
    const [stripe, setStripe] = useState<Stripe | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!publishableKey) return;
        let cancelled = false;
        loadStripe(publishableKey).then((instance) => {
            if (!cancelled) setStripe(instance);
        });
        return () => {
            cancelled = true;
        };
    }, [publishableKey]);

    const open = useCallback(
        async (orderRef: GatewayOrderRef): Promise<GatewayOpenResult> => {
            if (!stripe) {
                throw new Error("Stripe SDK not loaded");
            }
            setIsLoading(true);
            try {
                const orderData = await createGatewayOrder(storeId, "stripe", {
                    amount: orderRef.amount,
                    shippingAddress: orderRef.shippingAddress,
                    ...(orderRef.billingAddress ? { billingAddress: orderRef.billingAddress } : {}),
                });
                if (!orderData || !orderData.clientSecret) {
                    throw new Error("Failed to create payment order");
                }

                const result = await collectStripePayment(stripe, orderData.clientSecret, payButtonLabel(orderData.amount, orderData.currency));
                if (!result) {
                    throw new Error("Payment cancelled");
                }

                const verification = await verifyGatewayPayment(storeId, "stripe", { paymentIntentId: result.paymentIntentId });
                if (!verification || !verification.verified) {
                    throw new Error("Payment verification failed");
                }

                return { gatewayRef: { paymentIntentId: result.paymentIntentId } };
            } finally {
                setIsLoading(false);
            }
        },
        [stripe, storeId]
    );

    return {
        key: "stripe",
        isReady: !!stripe,
        isLoading,
        availableMethods: STRIPE_METHODS,
        open,
    };
}
