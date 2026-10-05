"use client";

import { useCallback, useEffect, useState } from "react";
import { createGatewayOrder, verifyGatewayPayment } from "@/lib/payment-api";
import type { CheckoutGatewayAdapter, GatewayOpenResult, GatewayOrderRef, PaymentMethodOption } from "@/types/checkoutGateway";
import { Building2 } from "lucide-react";
import { createElement } from "react";
import { UpiChips } from "@/components/checkout/PaymentMethodList";

declare global {
    interface Window {
        Razorpay: new (options: Record<string, unknown>) => { open: () => void };
    }
}

interface UseRazorpayAdapterOptions {
    storeId: string;
    storeName?: string;
}

const RAZORPAY_METHODS: PaymentMethodOption[] = [
    { id: "razorpay_upi", gatewayKey: "razorpay", title: "Pay via UPI", subtitle: "Use any registered UPI ID", extra: createElement(UpiChips) },
    {
        id: "razorpay_card",
        gatewayKey: "razorpay",
        title: "Debit/Credit cards",
        subtitle: "Visa, Mastercard, RuPay & more",
        extra: createElement(
            "div",
            { className: "flex items-center bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100" },
            createElement("span", { className: "text-[10px] font-black text-[#1A1F71] italic" }, "VISA")
        ),
    },
    {
        id: "razorpay_netbanking",
        gatewayKey: "razorpay",
        title: "Netbanking",
        subtitle: "Select from a list of banks",
        extra: createElement(Building2, { className: "w-3 h-3 text-gray-600", size: 12 }),
    },
];

// razorpay_upi -> upi (Razorpay's own `prefill.method` hint expects its bare name)
function toRazorpayMethod(methodId?: string): string | undefined {
    return methodId?.replace(/^razorpay_/, "");
}

/**
 * Behavior-preserving refactor of the former useRazorpay hook into the shared
 * CheckoutGatewayAdapter shape - same script-ready polling, same
 * createGatewayOrder/verifyGatewayPayment calls (now via the gateway-agnostic
 * functions, still hitting the identical ?provider=razorpay endpoints), same
 * options object passed to window.Razorpay. The one structural change: the
 * former onSuccess/onFailure callback pair is now a Promise returned by
 * open(), so CheckoutView can await a single call instead of wiring two
 * callbacks per gateway.
 */
export function useRazorpayAdapter({ storeId, storeName }: UseRazorpayAdapterOptions): CheckoutGatewayAdapter {
    const [isLoading, setIsLoading] = useState(false);
    const [isReady, setIsReady] = useState(() => typeof window !== "undefined" && !!window.Razorpay);

    useEffect(() => {
        if (isReady) return;
        const interval = setInterval(() => {
            if (typeof window !== "undefined" && window.Razorpay) {
                setIsReady(true);
                clearInterval(interval);
            }
        }, 200);
        return () => clearInterval(interval);
    }, [isReady]);

    const open = useCallback(
        async (orderRef: GatewayOrderRef): Promise<GatewayOpenResult> => {
            if (!isReady) {
                throw new Error("Razorpay SDK not loaded");
            }
            setIsLoading(true);
            try {
                const orderData = await createGatewayOrder(storeId, "razorpay", {
                    amount: orderRef.amount,
                    shippingAddress: orderRef.shippingAddress,
                    ...(orderRef.billingAddress ? { billingAddress: orderRef.billingAddress } : {}),
                });
                if (!orderData || !orderData.keyId || !orderData.orderId) {
                    throw new Error("Failed to create payment order");
                }

                return await new Promise<GatewayOpenResult>((resolve, reject) => {
                    const options = {
                        key: orderData.keyId,
                        amount: orderData.amount,
                        currency: orderData.currency,
                        name: storeName || "My Store",
                        description: "Order Payment",
                        order_id: orderData.orderId,
                        prefill: {
                            name: orderRef.userDetails.name,
                            email: orderRef.userDetails.email || "",
                            contact: orderRef.userDetails.phone,
                            method: toRazorpayMethod(orderRef.methodId),
                        },
                        theme: { color: "#000000" },
                        handler: async function (response: {
                            razorpay_order_id: string;
                            razorpay_payment_id: string;
                            razorpay_signature: string;
                        }) {
                            try {
                                const verification = await verifyGatewayPayment(storeId, "razorpay", {
                                    razorpay_order_id: response.razorpay_order_id,
                                    razorpay_payment_id: response.razorpay_payment_id,
                                    razorpay_signature: response.razorpay_signature,
                                });
                                if (verification && verification.verified) {
                                    resolve({
                                        gatewayRef: {
                                            razorpay_order_id: response.razorpay_order_id,
                                            razorpay_payment_id: response.razorpay_payment_id,
                                            razorpay_signature: response.razorpay_signature,
                                        },
                                    });
                                } else {
                                    reject(new Error("Payment verification failed"));
                                }
                            } catch (error) {
                                reject(error);
                            } finally {
                                setIsLoading(false);
                            }
                        },
                        modal: {
                            ondismiss: function () {
                                setIsLoading(false);
                                reject(new Error("Payment cancelled"));
                            },
                        },
                    };
                    const rzp = new window.Razorpay(options);
                    rzp.open();
                });
            } catch (error) {
                setIsLoading(false);
                throw error;
            }
        },
        [isReady, storeId, storeName]
    );

    return {
        key: "razorpay",
        isReady,
        isLoading,
        availableMethods: RAZORPAY_METHODS,
        open,
    };
}
