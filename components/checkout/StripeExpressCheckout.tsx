"use client";

import { useEffect, useRef, useState } from "react";
import type { Stripe, StripeElements } from "@stripe/stripe-js";
import { createGatewayOrder, verifyGatewayPayment } from "@/lib/payment-api";

/** What the backend's public store settings say about the store's Stripe methods. */
export interface StripeExpressConfig {
    paymentMethodTypes: string[];
    wallets: { applePay: boolean; googlePay: boolean };
}

/** Which express buttons the store allows, in the shape Stripe's element expects. */
export function expressPaymentMethodsOption(config: StripeExpressConfig) {
    return {
        applePay: config.wallets.applePay ? ("auto" as const) : ("never" as const),
        googlePay: config.wallets.googlePay ? ("auto" as const) : ("never" as const),
        link: config.paymentMethodTypes.includes("link") ? ("auto" as const) : ("never" as const),
    };
}

/** False when the store turned every express method off, so nothing is mounted. */
export function hasExpressMethods(config: StripeExpressConfig | undefined): config is StripeExpressConfig {
    if (!config) return false;
    const { applePay, googlePay, link } = expressPaymentMethodsOption(config);
    return applePay === "auto" || googlePay === "auto" || link === "auto";
}

interface StripeExpressCheckoutProps {
    stripe: Stripe | null;
    storeId: string;
    /** The store's currency code, e.g. "INR". */
    currency: string;
    /** The order total in the currency's smallest unit; the server re-prices and must agree. */
    totalMinor: number;
    config: StripeExpressConfig;
    shippingAddress: Record<string, unknown>;
    billingAddress?: Record<string, unknown>;
    /** True while the total or address is still changing; the buttons stay visible but can't be used. */
    disabled?: boolean;
    /** Runs before anything is charged (stock check). Returns an error message to stop, or null to go on. */
    beforePay: () => Promise<string | null>;
    /** The payment succeeded and the server verified it: place the order. */
    onPaid: (gatewayRef: Record<string, unknown>) => Promise<void>;
    onError: (message: string) => void;
}

/**
 * Apple Pay, Google Pay and Link as one-click buttons, shown only for the
 * methods the store enabled and the browser supports. The PaymentIntent is
 * created after the shopper authorises (deferred intent), by the same
 * server-priced endpoint the card form uses, and the order is placed through
 * the same verify-then-create path.
 */
export default function StripeExpressCheckout(props: StripeExpressCheckoutProps) {
    const { stripe, currency, config, totalMinor, disabled } = props;
    const containerRef = useRef<HTMLDivElement>(null);
    const elementsRef = useRef<StripeElements | null>(null);
    const latest = useRef(props);
    // Handlers registered once with Stripe read the newest props through this ref.
    useEffect(() => {
        latest.current = props;
    });
    const [available, setAvailable] = useState(false);

    const typesKey = [...config.paymentMethodTypes].sort().join(",");
    const { applePay, googlePay } = config.wallets;

    useEffect(() => {
        if (!stripe || !containerRef.current) return;
        let active = true;
        let destroy: (() => void) | undefined;

        // An extra payment button must never take checkout down: any Stripe.js
        // failure here just leaves the section hidden and the card form working.
        try {
            const elements = stripe.elements({
                mode: "payment",
                amount: latest.current.totalMinor,
                currency: currency.toLowerCase(),
                paymentMethodTypes: typesKey.split(","),
            });
            elementsRef.current = elements;
            const express = elements.create("expressCheckout", {
                paymentMethods: expressPaymentMethodsOption({ paymentMethodTypes: typesKey.split(","), wallets: { applePay, googlePay } }),
            });
            destroy = () => express.destroy();

            express.on("ready", (event) => {
                const methods = event.availablePaymentMethods;
                if (active) setAvailable(!!methods && Object.values(methods).some(Boolean));
            });
            express.on("loaderror", (event) => {
                console.warn("[StripeExpressCheckout] could not load:", event.error?.message);
                if (active) setAvailable(false);
            });

            let paying = false;
            express.on("confirm", async (event) => {
                if (paying) return;
                paying = true;
                const current = latest.current;
                const fail = (message: string) => {
                    event.paymentFailed({ reason: "fail" });
                    current.onError(message);
                };
                try {
                    const { error: submitError } = await elements.submit();
                    if (submitError) return fail(submitError.message || "Payment failed. Please try again.");

                    const stop = await current.beforePay();
                    if (stop) return fail(stop);

                    const order = await createGatewayOrder(current.storeId, "stripe", {
                        amount: current.totalMinor,
                        shippingAddress: current.shippingAddress,
                        ...(current.billingAddress ? { billingAddress: current.billingAddress } : {}),
                    });
                    if (!order || !order.clientSecret) return fail("Failed to start the payment. Please try again.");
                    // The wallet sheet showed our total; never charge a different amount.
                    if (order.amount !== current.totalMinor || order.currency?.toLowerCase() !== current.currency.toLowerCase()) {
                        return fail("The price changed. Please review your order and try again.");
                    }

                    const { error, paymentIntent } = await stripe.confirmPayment({
                        elements,
                        clientSecret: order.clientSecret,
                        redirect: "if_required",
                    });
                    if (error || !paymentIntent) return fail(error?.message || "Payment failed. Please try again.");

                    const verification = await verifyGatewayPayment(current.storeId, "stripe", { paymentIntentId: paymentIntent.id });
                    if (!verification || !verification.verified) {
                        current.onError("Payment verification failed. Please contact the store.");
                        return;
                    }
                    await current.onPaid({ paymentIntentId: paymentIntent.id });
                } catch (err) {
                    fail(err instanceof Error ? err.message : "Payment failed. Please try again.");
                } finally {
                    paying = false;
                }
            });

            express.mount(containerRef.current);
        } catch (err) {
            console.warn("[StripeExpressCheckout] could not start:", err instanceof Error ? err.message : err);
            elementsRef.current = null;
        }

        return () => {
            active = false;
            elementsRef.current = null;
            try {
                destroy?.();
            } catch {
                // already gone
            }
        };
        // latest holds the changing props; only a new Stripe, currency or method set remounts.
    }, [stripe, currency, typesKey, applePay, googlePay]);

    useEffect(() => {
        elementsRef.current?.update({ amount: totalMinor });
    }, [totalMinor]);

    return (
        <section
            data-testid="stripe-express-checkout"
            className={available ? "bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4 sm:p-5 flex flex-col gap-3 md:mt-5" : "invisible absolute left-0 right-0 h-12 overflow-hidden pointer-events-none"}
        >
            {available && <h2 className="text-[16px] sm:text-lg font-bold text-gray-800 tracking-tight">Express checkout</h2>}
            <div ref={containerRef} className={disabled ? "pointer-events-none opacity-50" : ""} aria-busy={disabled || undefined} />
        </section>
    );
}
