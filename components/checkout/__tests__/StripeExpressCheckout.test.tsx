/* eslint-disable @typescript-eslint/no-explicit-any -- Stripe.js is stubbed with partial mocks */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import StripeExpressCheckout, { expressPaymentMethodsOption, hasExpressMethods, type StripeExpressConfig } from "../StripeExpressCheckout";
import { createGatewayOrder, verifyGatewayPayment } from "@/lib/payment-api";

vi.mock("@/lib/payment-api", () => ({
    createGatewayOrder: vi.fn(),
    verifyGatewayPayment: vi.fn(),
}));

// Covers: input shape, the confirm flow end to end, every failure path (nothing
// is charged unless every step passes), and the store's method flags.
// Stripe.js itself is mocked; it can't render real wallet buttons in jsdom.

const CONFIG: StripeExpressConfig = { paymentMethodTypes: ["card", "link"], wallets: { applePay: true, googlePay: false } };
const ADDRESS = { fullName: "Test User", postalCode: "682001" };

function mockStripe() {
    const handlers: Record<string, (event: any) => unknown> = {};
    const express = {
        on: vi.fn((name: string, handler: (event: any) => unknown) => {
            handlers[name] = handler;
        }),
        mount: vi.fn(),
        destroy: vi.fn(),
    };
    const elements = { create: vi.fn(() => express), submit: vi.fn().mockResolvedValue({}), update: vi.fn() };
    const stripe = {
        elements: vi.fn(() => elements),
        confirmPayment: vi.fn().mockResolvedValue({ paymentIntent: { id: "pi_1" } }),
    };
    return { stripe, elements, express, handlers };
}

function baseProps() {
    return {
        stripe: null,
        storeId: "store-1",
        currency: "INR",
        totalMinor: 23500,
        config: CONFIG,
        shippingAddress: ADDRESS,
        billingAddress: ADDRESS,
        beforePay: vi.fn().mockResolvedValue(null),
        onPaid: vi.fn().mockResolvedValue(undefined),
        onError: vi.fn(),
    };
}

function renderExpress(overrides: Partial<React.ComponentProps<typeof StripeExpressCheckout>> = {}) {
    const mocks = mockStripe();
    const props = { ...baseProps(), stripe: mocks.stripe as any, ...overrides };
    const view = render(<StripeExpressCheckout {...props} />);
    return { ...mocks, props, view };
}

const confirmEvent = () => ({ paymentFailed: vi.fn() });

beforeEach(() => {
    vi.mocked(createGatewayOrder).mockReset();
    vi.mocked(verifyGatewayPayment).mockReset();
    vi.mocked(createGatewayOrder).mockResolvedValue({ orderId: "pi_1", amount: 23500, currency: "inr", clientSecret: "pi_1_secret" });
    vi.mocked(verifyGatewayPayment).mockResolvedValue({ verified: true });
});

describe("store method flags", () => {
    it("maps the wallet flags and Link to Stripe's auto/never options", () => {
        expect(expressPaymentMethodsOption(CONFIG)).toEqual({ applePay: "auto", googlePay: "never", link: "auto" });
        expect(expressPaymentMethodsOption({ paymentMethodTypes: ["card"], wallets: { applePay: false, googlePay: true } })).toEqual({
            applePay: "never",
            googlePay: "auto",
            link: "never",
        });
    });

    it("reports no express methods when the store turned them all off or sent no config", () => {
        expect(hasExpressMethods(CONFIG)).toBe(true);
        expect(hasExpressMethods({ paymentMethodTypes: ["card"], wallets: { applePay: false, googlePay: false } })).toBe(false);
        expect(hasExpressMethods(undefined)).toBe(false);
    });
});

describe("StripeExpressCheckout", () => {
    it("creates Elements for the order total with the store's payment types and mounts the express element", () => {
        const { stripe, elements, express } = renderExpress();

        expect(stripe.elements).toHaveBeenCalledWith({
            mode: "payment",
            amount: 23500,
            currency: "inr",
            paymentMethodTypes: ["card", "link"],
        });
        expect(elements.create).toHaveBeenCalledWith("expressCheckout", {
            paymentMethods: { applePay: "auto", googlePay: "never", link: "auto" },
        });
        expect(express.mount).toHaveBeenCalledTimes(1);
    });

    it("never breaks checkout when Stripe.js throws while setting up the buttons", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const stripe = { elements: vi.fn(() => { throw new Error("Invalid value for elements()"); }) };

        expect(() => render(<StripeExpressCheckout {...baseProps()} stripe={stripe as any} />)).not.toThrow();

        expect(screen.queryByText("Express checkout")).not.toBeInTheDocument();
        expect(warn).toHaveBeenCalledWith("[StripeExpressCheckout] could not start:", "Invalid value for elements()");
        warn.mockRestore();
    });

    it("hides the section when the element reports a load error", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const { handlers } = renderExpress();
        act(() => handlers["ready"]!({ availablePaymentMethods: { applePay: false, googlePay: false, link: true } }));
        expect(await screen.findByText("Express checkout")).toBeInTheDocument();

        act(() => handlers["loaderror"]!({ error: { message: "Link is not enabled" } }));

        expect(screen.queryByText("Express checkout")).not.toBeInTheDocument();
        warn.mockRestore();
    });

    it("does nothing until Stripe.js has loaded", () => {
        const { elements } = renderExpress({ stripe: null });
        expect(elements.create).not.toHaveBeenCalled();
    });

    it("shows the heading only when the browser can offer a method", async () => {
        const { handlers } = renderExpress();
        expect(screen.queryByText("Express checkout")).not.toBeInTheDocument();

        act(() => handlers["ready"]!({ availablePaymentMethods: undefined }));
        expect(screen.queryByText("Express checkout")).not.toBeInTheDocument();

        act(() => handlers["ready"]!({ availablePaymentMethods: { applePay: false, googlePay: false, link: true } }));
        expect(await screen.findByText("Express checkout")).toBeInTheDocument();
    });

    it("keeps the Elements amount in step with the total without remounting", () => {
        const { stripe, elements, props, view } = renderExpress();
        view.rerender(<StripeExpressCheckout {...props} totalMinor={31000} />);

        expect(elements.update).toHaveBeenCalledWith({ amount: 31000 });
        expect(stripe.elements).toHaveBeenCalledTimes(1);
    });

    it("destroys the element on unmount", () => {
        const { express, view } = renderExpress();
        view.unmount();
        expect(express.destroy).toHaveBeenCalledTimes(1);
    });

    describe("confirm", () => {
        it("charges the server-priced intent and places the order once verified", async () => {
            const { stripe, elements, handlers, props } = renderExpress();
            const event = confirmEvent();

            await act(async () => {
                await handlers["confirm"]!(event);
            });

            expect(elements.submit).toHaveBeenCalledTimes(1);
            expect(props.beforePay).toHaveBeenCalledTimes(1);
            expect(createGatewayOrder).toHaveBeenCalledWith("store-1", "stripe", {
                amount: 23500,
                shippingAddress: ADDRESS,
                billingAddress: ADDRESS,
            });
            expect(stripe.confirmPayment).toHaveBeenCalledWith({ elements, clientSecret: "pi_1_secret", redirect: "if_required" });
            expect(verifyGatewayPayment).toHaveBeenCalledWith("store-1", "stripe", { paymentIntentId: "pi_1" });
            expect(props.onPaid).toHaveBeenCalledWith({ paymentIntentId: "pi_1" });
            expect(props.onError).not.toHaveBeenCalled();
            expect(event.paymentFailed).not.toHaveBeenCalled();
        });

        it("uses the latest total and address, not the ones from when it mounted", async () => {
            const { handlers, props, view } = renderExpress();
            const newAddress = { fullName: "Other", postalCode: "560001" };
            view.rerender(<StripeExpressCheckout {...props} totalMinor={31000} shippingAddress={newAddress} billingAddress={newAddress} />);
            vi.mocked(createGatewayOrder).mockResolvedValue({ orderId: "pi_1", amount: 31000, currency: "inr", clientSecret: "pi_1_secret" });

            await act(async () => {
                await handlers["confirm"]!(confirmEvent());
            });

            expect(createGatewayOrder).toHaveBeenCalledWith("store-1", "stripe", {
                amount: 31000,
                shippingAddress: newAddress,
                billingAddress: newAddress,
            });
        });

        it("stops before creating any payment when the stock check fails", async () => {
            const { stripe, handlers, props } = renderExpress({ beforePay: vi.fn().mockResolvedValue("Some items have insufficient stock.") });
            const event = confirmEvent();

            await act(async () => {
                await handlers["confirm"]!(event);
            });

            expect(event.paymentFailed).toHaveBeenCalledWith({ reason: "fail" });
            expect(props.onError).toHaveBeenCalledWith("Some items have insufficient stock.");
            expect(createGatewayOrder).not.toHaveBeenCalled();
            expect(stripe.confirmPayment).not.toHaveBeenCalled();
        });

        it("refuses to charge when the server's price differs from the one the wallet showed", async () => {
            vi.mocked(createGatewayOrder).mockResolvedValue({ orderId: "pi_1", amount: 24900, currency: "inr", clientSecret: "pi_1_secret" });
            const { stripe, handlers, props } = renderExpress();
            const event = confirmEvent();

            await act(async () => {
                await handlers["confirm"]!(event);
            });

            expect(event.paymentFailed).toHaveBeenCalledWith({ reason: "fail" });
            expect(props.onError).toHaveBeenCalledWith("The price changed. Please review your order and try again.");
            expect(stripe.confirmPayment).not.toHaveBeenCalled();
            expect(props.onPaid).not.toHaveBeenCalled();
        });

        it("refuses to charge when the server's currency differs", async () => {
            vi.mocked(createGatewayOrder).mockResolvedValue({ orderId: "pi_1", amount: 23500, currency: "usd", clientSecret: "pi_1_secret" });
            const { stripe, handlers } = renderExpress();

            await act(async () => {
                await handlers["confirm"]!(confirmEvent());
            });

            expect(stripe.confirmPayment).not.toHaveBeenCalled();
        });

        it("reports a failed order creation without charging", async () => {
            vi.mocked(createGatewayOrder).mockRejectedValue(new Error("We couldn't complete your order right now. Please try again later or contact the store."));
            const { stripe, handlers, props } = renderExpress();
            const event = confirmEvent();

            await act(async () => {
                await handlers["confirm"]!(event);
            });

            expect(event.paymentFailed).toHaveBeenCalledWith({ reason: "fail" });
            expect(props.onError).toHaveBeenCalledWith("We couldn't complete your order right now. Please try again later or contact the store.");
            expect(stripe.confirmPayment).not.toHaveBeenCalled();
        });

        it("reports Stripe's error and places no order when the payment is declined", async () => {
            const { stripe, handlers, props } = renderExpress();
            stripe.confirmPayment.mockResolvedValue({ error: { message: "Your card was declined." } });
            const event = confirmEvent();

            await act(async () => {
                await handlers["confirm"]!(event);
            });

            expect(event.paymentFailed).toHaveBeenCalledWith({ reason: "fail" });
            expect(props.onError).toHaveBeenCalledWith("Your card was declined.");
            expect(verifyGatewayPayment).not.toHaveBeenCalled();
            expect(props.onPaid).not.toHaveBeenCalled();
        });

        it("reports a submit error from the wallet without creating a payment", async () => {
            const { elements, handlers, props } = renderExpress();
            elements.submit.mockResolvedValue({ error: { message: "Payment details incomplete." } });

            await act(async () => {
                await handlers["confirm"]!(confirmEvent());
            });

            expect(props.onError).toHaveBeenCalledWith("Payment details incomplete.");
            expect(createGatewayOrder).not.toHaveBeenCalled();
        });

        it("does not place the order when the server can't verify the payment", async () => {
            vi.mocked(verifyGatewayPayment).mockResolvedValue({ verified: false });
            const { handlers, props } = renderExpress();

            await act(async () => {
                await handlers["confirm"]!(confirmEvent());
            });

            expect(props.onError).toHaveBeenCalledWith("Payment verification failed. Please contact the store.");
            expect(props.onPaid).not.toHaveBeenCalled();
        });

        it("ignores a second confirm while one is in flight", async () => {
            let release: (value: unknown) => void = () => undefined;
            const { elements, handlers } = renderExpress();
            elements.submit.mockReturnValue(new Promise((resolve) => (release = resolve)));

            const first = handlers["confirm"]!(confirmEvent());
            await handlers["confirm"]!(confirmEvent());
            release({});
            await act(async () => {
                await first;
            });

            expect(createGatewayOrder).toHaveBeenCalledTimes(1);
        });
    });
});
