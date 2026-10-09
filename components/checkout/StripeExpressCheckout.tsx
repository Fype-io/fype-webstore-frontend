"use client";

import { useEffect, useRef } from "react";
import type { Stripe, StripeElements } from "@stripe/stripe-js";
import { createGatewayOrder, verifyGatewayPayment } from "@/lib/payment-api";
import type { PaymentMethodOption } from "@/types/checkoutGateway";

/** What the backend's public store settings say about the store's Stripe methods. */
export interface StripeExpressConfig {
    paymentMethodTypes: string[];
    wallets: { applePay: boolean; googlePay: boolean };
}

export type StripeWallet = "googlePay" | "applePay";

/** Whether this browser can pay with each wallet; a wallet not yet reported is unknown. */
export type WalletAvailability = Partial<Record<StripeWallet, boolean>>;

const WALLETS: { wallet: StripeWallet; id: string; title: string; subtitle: string }[] = [
    { wallet: "googlePay", id: "stripe_google_pay", title: "Google Pay", subtitle: "Pay with a card saved in your Google account" },
    { wallet: "applePay", id: "stripe_apple_pay", title: "Apple Pay", subtitle: "Pay with Face ID, Touch ID or your iPhone" },
];

export const WALLET_UNAVAILABLE_SUBTITLE = "Not available on this device";

/** The wallets the store turned on, in list order. */
export function enabledWallets(config: StripeExpressConfig | undefined): StripeWallet[] {
    if (!config) return [];
    return WALLETS.filter(({ wallet }) => config.wallets[wallet]).map(({ wallet }) => wallet);
}

/** The wallet a payment-method row stands for, or null for any other row. */
export function walletOf(methodId: string | null | undefined): StripeWallet | null {
    return WALLETS.find(({ id }) => id === methodId)?.wallet ?? null;
}

/**
 * One payment-method row per wallet the store enabled. A wallet the browser
 * reported it can't use stays listed (the store chose to offer it) but can't be
 * picked; one not yet reported is pickable.
 */
export function stripeWalletMethods(config: StripeExpressConfig | undefined, availability: WalletAvailability): PaymentMethodOption[] {
    const enabled = enabledWallets(config);
    return WALLETS.filter(({ wallet }) => enabled.includes(wallet)).map(({ wallet, id, title, subtitle }) => {
        const unavailable = availability[wallet] === false;
        return { id, gatewayKey: "stripe", title, subtitle: unavailable ? WALLET_UNAVAILABLE_SUBTITLE : subtitle, ...(unavailable ? { disabled: true } : {}) };
    });
}

/**
 * The wallet buttons the store allows, in the shape Stripe's element expects,
 * optionally narrowed to one wallet. An enabled wallet is "always", not "auto":
 * with "auto" Stripe shows Apple Pay / Google Pay only when it judges the shopper
 * ready (a card already in the wallet), so a store's enabled wallet silently
 * vanished. "always" shows it on every supported browser and starts a sign-in
 * flow if needed (Apple Pay in a non-Safari desktop browser is a QR code to scan
 * with an iPhone); it still can't appear on an unsupported browser, over plain
 * HTTP, or on a domain not registered with Stripe. Link is offered inside the
 * card form, so never here.
 */
export function expressPaymentMethodsOption(config: StripeExpressConfig, only?: StripeWallet) {
    const show = (wallet: StripeWallet) => (config.wallets[wallet] && (!only || only === wallet) ? ("always" as const) : ("never" as const));
    return { applePay: show("applePay"), googlePay: show("googlePay"), link: "never" as const };
}

interface StripeExpressCheckoutProps {
    stripe: Stripe | null;
    storeId: string;
    /** The store's currency code, e.g. "INR". */
    currency: string;
    /** The order total in the currency's smallest unit; the server re-prices and must agree. */
    totalMinor: number;
    config: StripeExpressConfig;
    /** Show only this wallet's button. Without it, every wallet the store enabled. */
    wallet?: StripeWallet;
    /** Mounted off-screen, only to learn which wallets this browser can use. */
    hidden?: boolean;
    /** Reports which of the requested wallets this browser can use, once Stripe knows. */
    onAvailabilityChange?: (availability: WalletAvailability) => void;
    shippingAddress: Record<string, unknown>;
    billingAddress?: Record<string, unknown>;
    /** True while the total or address is still changing; the button stays visible but can't be used. */
    disabled?: boolean;
    /** Runs before anything is charged (stock check). Returns an error message to stop, or null to go on. */
    beforePay: () => Promise<string | null>;
    /** The payment succeeded and the server verified it: place the order. */
    onPaid: (gatewayRef: Record<string, unknown>) => Promise<void>;
    onError: (message: string) => void;
}

/**
 * Stripe's Apple Pay / Google Pay button. The checkout lists each wallet as a
 * payment method and shows this button in place of "Place order" when one is
 * chosen: a wallet's payment sheet only opens from a click on Stripe's own
 * button, never from our button after an await. The PaymentIntent is created
 * after the shopper authorises (deferred intent), by the same server-priced
 * endpoint the card form uses, and the order is placed through the same
 * verify-then-create path.
 */
export default function StripeExpressCheckout(props: StripeExpressCheckoutProps) {
    const { stripe, currency, config, wallet, totalMinor, disabled, hidden } = props;
    const containerRef = useRef<HTMLDivElement>(null);
    const elementsRef = useRef<StripeElements | null>(null);
    const latest = useRef(props);
    // Handlers registered once with Stripe read the newest props through this ref.
    useEffect(() => {
        latest.current = props;
    });

    const typesKey = [...config.paymentMethodTypes].sort().join(",");
    const { applePay, googlePay } = config.wallets;

    useEffect(() => {
        if (!stripe || !containerRef.current) return;
        let active = true;
        let destroy: (() => void) | undefined;
        const requested = { applePay, googlePay };
        const wanted = (Object.keys(requested) as StripeWallet[]).filter((key) => requested[key] && (!wallet || wallet === key));
        const report = (methods: Partial<Record<string, boolean>> | undefined) => {
            if (!active) return;
            const availability: WalletAvailability = {};
            for (const key of wanted) availability[key] = !!methods?.[key];
            latest.current.onAvailabilityChange?.(availability);
        };

        // A payment button must never take checkout down: any Stripe.js failure
        // here just reports the wallets unavailable and the card form keeps working.
        try {
            const elements = stripe.elements({
                mode: "payment",
                amount: latest.current.totalMinor,
                currency: currency.toLowerCase(),
                paymentMethodTypes: typesKey.split(","),
            });
            elementsRef.current = elements;
            const express = elements.create("expressCheckout", {
                paymentMethods: expressPaymentMethodsOption({ paymentMethodTypes: typesKey.split(","), wallets: requested }, wallet),
            });
            destroy = () => express.destroy();

            express.on("ready", (event) => report(event.availablePaymentMethods as Partial<Record<string, boolean>> | undefined));
            express.on("loaderror", (event) => {
                console.warn("[StripeExpressCheckout] could not load:", event.error?.message);
                report(undefined);
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
            report(undefined);
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
        // latest holds the changing props; only a new Stripe, currency, wallet or method set remounts.
    }, [stripe, currency, typesKey, applePay, googlePay, wallet]);

    useEffect(() => {
        elementsRef.current?.update({ amount: totalMinor });
    }, [totalMinor]);

    if (hidden) {
        // Off-screen rather than display:none, which would stop Stripe from rendering and reporting.
        return <div data-testid="stripe-wallet-probe" ref={containerRef} aria-hidden className="invisible absolute left-0 right-0 h-12 overflow-hidden pointer-events-none" />;
    }
    return (
        <div
            data-testid="stripe-wallet-button"
            ref={containerRef}
            className={disabled ? "pointer-events-none opacity-50" : ""}
            aria-busy={disabled || undefined}
        />
    );
}
