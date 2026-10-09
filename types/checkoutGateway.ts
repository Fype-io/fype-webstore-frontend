import type { ReactNode } from "react";

/**
 * A single selectable payment method shown at checkout. Distinct from the
 * *gateway* that processes it — "card" existed before multi-gateway support
 * and belonged implicitly to Razorpay; now every method explicitly carries the
 * gatewayKey of the adapter that owns it, so a merged list (Razorpay's upi/
 * card/netbanking + Stripe's own card method) never collides on id or gets
 * dispatched to the wrong adapter. IDs are namespaced per gateway
 * (e.g. "razorpay_card" vs "stripe_card") specifically to avoid an id
 * collision if two gateways both offer a method they'd naturally both call
 * "card".
 */
export interface PaymentMethodOption {
    id: string;
    gatewayKey: string;
    title: string;
    subtitle: string;
    extra?: ReactNode;
    /** Listed but can't be picked (e.g. a wallet this device can't use); the subtitle says why. */
    disabled?: boolean;
}

export interface GatewayOrderRef {
    // Smallest unit of the store's currency. Only sent so an older backend keeps working
    // during the rollout: the backend now prices the checkout itself and ignores
    // it, and the gateway is opened with the amount the backend returns.
    amount: number;
    // The address the order ships to; the backend charges shipping for it.
    shippingAddress: Record<string, unknown>;
    billingAddress?: Record<string, unknown>;
    userDetails: { name: string; email?: string; phone: string };
    methodId?: string;
}

export interface GatewayOpenResult {
    gatewayRef: Record<string, unknown>;
}

/**
 * Common shape every payment gateway hook conforms to, so CheckoutView never
 * special-cases a gateway by name outside of instantiating its hook - adding
 * gateway #3 means writing one more adapter hook and one more line wiring it
 * into activeGateways, not touching CheckoutView's dispatch logic.
 */
export interface CheckoutGatewayAdapter {
    key: string;
    isReady: boolean;
    isLoading: boolean;
    availableMethods: PaymentMethodOption[];
    open(orderRef: GatewayOrderRef): Promise<GatewayOpenResult>;
}
