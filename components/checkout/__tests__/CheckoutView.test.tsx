import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import userReducer from "@/redux/slices/userSlice";
import CheckoutView from "../CheckoutView";
import type StripeExpressCheckout from "../StripeExpressCheckout";
import { ORDER_NOW_NOTE } from "../checkoutUtils";
import { useRazorpayAdapter } from "@/hooks/useRazorpayAdapter";
import { useStripeAdapter } from "@/hooks/useStripeAdapter";
import { fetchStockForCartItems } from "@/lib/stock-api";
import { calculateShippingRate } from "@/lib/shipping-api";
import { postApi } from "@/lib/client-api";
import { AxiosError, type AxiosResponse } from "axios";

// Mock next/navigation's useRouter (CheckoutView calls router.push on success).
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/shipping-api", () => ({
    calculateShippingRate: vi.fn().mockResolvedValue(null),
    getExpectedTAT: vi.fn().mockResolvedValue({ success: false }),
}));

vi.mock("@/lib/stock-api", () => ({
    fetchStockForCartItems: vi.fn().mockResolvedValue({}),
}));

// CheckoutView dispatches the real fetchAddresses/createOrder thunks on mount/
// submit, which call these client-api functions under the hood. Mocked here
// (not the thunks themselves) so the real reducer logic still runs - in
// particular, fetchAddresses resolving with a genuinely NEW array reference is
// what triggers CheckoutView's own addresses!==prevAddresses selection effect,
// same as it would from a real API response.
// vi.mock factories are hoisted above all top-level declarations, so the
// fixture referenced inside one must go through vi.hoisted().
const { TEST_ADDRESS } = vi.hoisted(() => ({
    TEST_ADDRESS: {
        addressId: "addr1",
        firstName: "Test",
        lastName: "User",
        phoneNumber: "9999999999",
        addressLine1: "123 Main St",
        city: "Mumbai",
        state: "MH",
        country: "IN",
        postalCode: "400001",
        isDefault: true,
    },
}));
vi.mock("@/lib/client-api", async () => {
    const actual = await vi.importActual<typeof import("@/lib/client-api")>("@/lib/client-api");
    return {
        ...actual,
        getApi: vi.fn().mockResolvedValue({ data: { success: true, data: { addresses: [TEST_ADDRESS] } } }),
        postApi: vi.fn().mockRejectedValue(new Error("not exercised in this test file")),
        deleteApi: vi.fn().mockResolvedValue({ data: { success: true } }),
    };
});

// The gateway adapters are mocked wholesale here - their own internals
// (script loading, Razorpay/Stripe SDK calls) are covered by
// useRazorpayAdapter.test.ts/useStripeAdapter.test.ts. This file tests only
// CheckoutView's own contract with the CheckoutGatewayAdapter shape: merging
// availableMethods across active adapters, dispatching handleCreateOrder to
// the adapter matching the selected method, and the COD/manual fallback.
vi.mock("@/hooks/useRazorpayAdapter", () => ({ useRazorpayAdapter: vi.fn() }));
vi.mock("@/hooks/useStripeAdapter", () => ({ useStripeAdapter: vi.fn() }));

// Stripe's own wallet buttons are covered by StripeExpressCheckout.test.tsx; here
// the component is replaced by a stub that records the props CheckoutView hands
// the hidden availability probe and the visible pay button separately.
type WalletProps = React.ComponentProps<typeof StripeExpressCheckout>;
const { walletProps } = vi.hoisted(() => ({ walletProps: { probe: null as WalletProps | null, button: null as WalletProps | null } }));
vi.mock("../StripeExpressCheckout", async () => {
    const actual = await vi.importActual<typeof import("../StripeExpressCheckout")>("../StripeExpressCheckout");
    return {
        ...actual,
        default: (props: WalletProps) => {
            if (props.hidden) {
                walletProps.probe = props;
                return <div data-testid="wallet-probe" />;
            }
            walletProps.button = props;
            return <div data-testid={`wallet-button-${props.wallet}`} />;
        },
    };
});

const notReadyRazorpay = { key: "razorpay", isReady: false, isLoading: false, availableMethods: [], open: vi.fn() };
const readyRazorpay = {
    key: "razorpay",
    isReady: true,
    isLoading: false,
    availableMethods: [
        { id: "razorpay_upi", gatewayKey: "razorpay", title: "Pay via UPI", subtitle: "Use any registered UPI ID" },
        { id: "razorpay_card", gatewayKey: "razorpay", title: "Debit/Credit cards", subtitle: "Visa, Mastercard, RuPay & more" },
    ],
    open: vi.fn().mockResolvedValue({ gatewayRef: { razorpay_order_id: "o1", razorpay_payment_id: "p1", razorpay_signature: "s1" } }),
};
const notReadyStripe = { key: "stripe", isReady: false, isLoading: false, availableMethods: [], open: vi.fn() };
const readyStripe = {
    key: "stripe",
    isReady: true,
    isLoading: false,
    availableMethods: [{ id: "stripe_card", gatewayKey: "stripe", title: "Card (international)", subtitle: "Visa, Mastercard, Amex via Stripe" }],
    open: vi.fn().mockResolvedValue({ gatewayRef: { paymentIntentId: "pi_1" } }),
};

function buildStore() {
    return configureStore({
        reducer: { user: userReducer },
        preloadedState: {
            user: {
                user: { id: "u1", firstName: "Test", lastName: "User", email: "test@example.com", phone: "9999999999" },
                isAuthenticated: true,
                authLoading: false,
                authChecked: true,
                authError: null,
                // Starts empty, same as a real fresh page load - populated
                // shortly after mount via CheckoutView's own fetchAddresses
                // dispatch (mocked client-api response, see TEST_ADDRESS above).
                // This matters: preloading a non-empty array directly here would
                // make it the SAME array reference CheckoutView's own
                // addresses!==prevAddresses effect starts with, so it would never
                // fire and selectedAddress would never get set - exactly the trap
                // this setup avoids.
                addresses: [],
                cart: {
                    _id: "cart1",
                    cartId: "cart1",
                    items: [
                        {
                            _id: "item1",
                            productId: "prod1",
                            name: "Test product",
                            image: "",
                            price: 100,
                            quantity: 1,
                            maxQuantity: 10,
                        },
                    ],
                    subtotal: 100,
                    tax: 0,
                    shipping: 0,
                    discount: 0,
                    total: 100,
                    itemCount: 1,
                },
                // Remaining UserState fields default sensibly for this test -
                // cast via `as any` for whatever this slice's full state shape
                // requires beyond what CheckoutView actually reads.
            } as any,
        },
    });
}

function renderCheckout(props: Partial<React.ComponentProps<typeof CheckoutView>> = {}) {
    const store = buildStore();
    return render(
        <Provider store={store}>
            <CheckoutView
                storeId="store-1"
                shopName="Test Shop"
                hasDeliveryApp={false}
                hasManualShipping={false}
                shipmentProvider="manual"
                activeGateways={[]}
                {...props}
            />
        </Provider>
    );
}

describe("CheckoutView - multi-gateway payment method rendering and dispatch", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchStockForCartItems).mockResolvedValue({});
        vi.mocked(useRazorpayAdapter).mockReturnValue(notReadyRazorpay as any);
        vi.mocked(useStripeAdapter).mockReturnValue(notReadyStripe as any);
    });

    it("neither gateway active, no logistics app: \"Order now\" only, no COD", async () => {
        renderCheckout({ activeGateways: [] });

        expect(await screen.findByText(ORDER_NOW_NOTE)).toBeInTheDocument();
        expect(screen.queryByText("Cash on delivery")).not.toBeInTheDocument();
        expect(screen.queryByText("Pay via UPI")).not.toBeInTheDocument();
        expect(screen.queryByText("Card (international)")).not.toBeInTheDocument();
    });

    it("only Razorpay active: shows Razorpay's methods, not Stripe's, no COD", async () => {
        vi.mocked(useRazorpayAdapter).mockReturnValue(readyRazorpay as any);

        renderCheckout({ activeGateways: ["razorpay"] });

        expect(await screen.findByText("Pay via UPI")).toBeInTheDocument();
        expect(screen.getByText("Debit/Credit cards")).toBeInTheDocument();
        expect(screen.queryByText("Card (international)")).not.toBeInTheDocument();
        expect(screen.queryByText("Cash on delivery")).not.toBeInTheDocument();
    });

    it("only Stripe active: shows Stripe's method, not Razorpay's, no COD", async () => {
        vi.mocked(useStripeAdapter).mockReturnValue(readyStripe as any);

        renderCheckout({ activeGateways: ["stripe"] });

        expect(await screen.findByText("Card (international)")).toBeInTheDocument();
        expect(screen.queryByText("Pay via UPI")).not.toBeInTheDocument();
        expect(screen.queryByText("Cash on delivery")).not.toBeInTheDocument();
    });

    it("both active: methods from both adapters are merged into one list, no id collision", async () => {
        vi.mocked(useRazorpayAdapter).mockReturnValue(readyRazorpay as any);
        vi.mocked(useStripeAdapter).mockReturnValue(readyStripe as any);

        renderCheckout({ activeGateways: ["razorpay", "stripe"] });

        expect(await screen.findByText("Pay via UPI")).toBeInTheDocument();
        expect(screen.getByText("Debit/Credit cards")).toBeInTheDocument();
        expect(screen.getByText("Card (international)")).toBeInTheDocument();
        expect(screen.queryByText("Cash on delivery")).not.toBeInTheDocument();
    });

    it("dispatches to the Razorpay adapter when a Razorpay method is selected", async () => {
        vi.mocked(useRazorpayAdapter).mockReturnValue(readyRazorpay as any);
        vi.mocked(useStripeAdapter).mockReturnValue(readyStripe as any);
        const user = userEvent.setup();

        renderCheckout({ activeGateways: ["razorpay", "stripe"] });

        await screen.findByText("Pay via UPI");
        // Click the radio input directly rather than the label's text - jsdom's
        // implicit label->control click forwarding isn't reliable enough here
        // to depend on for the test, and the radio is the actual state trigger.
        const upiRadio = document.querySelector('input[value="razorpay_upi"]') as HTMLInputElement;
        await user.click(upiRadio);
        await waitFor(() => expect(upiRadio.checked).toBe(true));
        const placeOrderButton = screen.getByText("Place order");
        await user.click(placeOrderButton);

        await waitFor(() => expect(readyRazorpay.open).toHaveBeenCalledTimes(1));
        expect(readyStripe.open).not.toHaveBeenCalled();
    });

    it("dispatches to the Stripe adapter when a Stripe method is selected", async () => {
        vi.mocked(useRazorpayAdapter).mockReturnValue(readyRazorpay as any);
        vi.mocked(useStripeAdapter).mockReturnValue(readyStripe as any);
        const user = userEvent.setup();

        renderCheckout({ activeGateways: ["razorpay", "stripe"] });

        await screen.findByText("Card (international)");
        const stripeRadio = document.querySelector('input[value="stripe_card"]') as HTMLInputElement;
        expect(stripeRadio).not.toBeNull();
        await user.click(stripeRadio);
        await waitFor(() => expect(stripeRadio.checked).toBe(true));
        const placeOrderButton = screen.getByText("Place order");
        expect(placeOrderButton.closest("button")).not.toBeDisabled();
        await user.click(placeOrderButton);

        await waitFor(() => expect(readyStripe.open).toHaveBeenCalledTimes(1));
        expect(readyRazorpay.open).not.toHaveBeenCalled();
    });
});

const asRazorpay = (a: object) => a as unknown as ReturnType<typeof useRazorpayAdapter>;
const asStripe = (a: object) => a as unknown as ReturnType<typeof useStripeAdapter>;

// COD needs a logistics app that collects the cash (shipmentProvider dtdc/
// delhivery), then follows the store's setting. With no gateway and no COD,
// "Order now" places the order unpaid (paymentMethod "manual") and the store
// arranges payment. It never appears alongside a gateway or COD.
describe("CheckoutView - COD needs a logistics app; \"Order now\" fallback", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchStockForCartItems).mockResolvedValue({});
        vi.mocked(calculateShippingRate).mockResolvedValue({ serviceable: true, deliveryCharge: 0 } as Awaited<ReturnType<typeof calculateShippingRate>>);
        vi.mocked(useRazorpayAdapter).mockReturnValue(asRazorpay(notReadyRazorpay));
        vi.mocked(useStripeAdapter).mockReturnValue(asStripe(notReadyStripe));
        vi.mocked(postApi).mockResolvedValue({ data: { success: true, data: { order: { orderNumber: "1001" } } } } as Awaited<ReturnType<typeof postApi>>);
    });

    const courier = { hasDeliveryApp: true, shipmentProvider: "dtdc" as const };
    const orderNowButtons = () => screen.queryAllByRole("button", { name: /order now/i });
    const postedPaymentMethod = () => (vi.mocked(postApi).mock.calls[0]?.[1] as { paymentMethod?: string } | undefined)?.paymentMethod;

    it("no payment app, no logistics app: only \"Order now\" (even with COD turned on); places a manual order", async () => {
        const user = userEvent.setup();
        renderCheckout({ activeGateways: [], cod: { enabled: true, minOrderValue: null } });

        expect(await screen.findByText(ORDER_NOW_NOTE)).toBeInTheDocument();
        expect(screen.queryByText("Cash on delivery")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /place order/i })).not.toBeInTheDocument();
        expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(0);

        const buttons = orderNowButtons();
        expect(buttons).toHaveLength(2); // mobile + desktop
        await waitFor(() => expect(buttons[1]).not.toBeDisabled()); // once the address loads
        await user.click(buttons[1]!);

        await waitFor(() => expect(postApi).toHaveBeenCalledTimes(1));
        expect(postedPaymentMethod()).toBe("manual");
    });

    it("no payment app, logistics connected, COD turned on: COD shown, no \"Order now\"; placed as \"cod\"", async () => {
        const user = userEvent.setup();
        renderCheckout({ ...courier, activeGateways: [], cod: { enabled: true, minOrderValue: null } });

        expect(await screen.findByText("Cash on delivery")).toBeInTheDocument();
        expect(orderNowButtons()).toHaveLength(0);
        expect(screen.queryByText(ORDER_NOW_NOTE)).not.toBeInTheDocument();

        const placeOrder = screen.getByRole("button", { name: /place order/i });
        await waitFor(() => expect(placeOrder).not.toBeDisabled());
        await user.click(placeOrder);

        await waitFor(() => expect(postApi).toHaveBeenCalledTimes(1));
        expect(postedPaymentMethod()).toBe("cod");
    });

    it("backend refuses COD (COD_REQUIRES_LOGISTICS, e.g. the logistics app was removed): a readable message, not a generic error", async () => {
        const user = userEvent.setup();
        vi.mocked(postApi).mockRejectedValue(
            new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
                status: 400,
                data: { success: false, code: "COD_REQUIRES_LOGISTICS", message: "Cash on delivery isn't available for this store." },
            } as AxiosResponse)
        );
        renderCheckout({ ...courier, activeGateways: [], cod: { enabled: true, minOrderValue: null } });

        const placeOrder = await screen.findByRole("button", { name: /place order/i });
        await waitFor(() => expect(placeOrder).not.toBeDisabled());
        await user.click(placeOrder);

        expect(
            await screen.findByText(
                "Cash on delivery isn't available for this store. This store's payment options have changed. Please refresh the page to see how you can pay."
            )
        ).toBeInTheDocument();
        expect(screen.queryByText("Order creation failed. Please contact support.")).not.toBeInTheDocument();
    });

    it("no payment app, logistics connected, COD turned off: \"Order now\"", async () => {
        renderCheckout({ ...courier, activeGateways: [], cod: { enabled: false, minOrderValue: null } });

        expect(await screen.findByText(ORDER_NOW_NOTE)).toBeInTheDocument();
        expect(orderNowButtons()).toHaveLength(2);
        expect(screen.queryByText("Cash on delivery")).not.toBeInTheDocument();
    });

    it("no payment app, logistics connected, COD below its minimum: \"Order now\"", async () => {
        renderCheckout({ ...courier, activeGateways: [], cod: { enabled: true, minOrderValue: 500 } });

        expect(await screen.findByText(ORDER_NOW_NOTE)).toBeInTheDocument();
        expect(screen.queryByText("Cash on delivery")).not.toBeInTheDocument();
    });

    it("Razorpay connected, no logistics app: Razorpay only - no COD, no \"Order now\"", async () => {
        vi.mocked(useRazorpayAdapter).mockReturnValue(asRazorpay(readyRazorpay));
        renderCheckout({ activeGateways: ["razorpay"], cod: { enabled: true, minOrderValue: null } });

        expect(await screen.findByText("Pay via UPI")).toBeInTheDocument();
        expect(screen.queryByText("Cash on delivery")).not.toBeInTheDocument();
        expect(orderNowButtons()).toHaveLength(0);
        expect(screen.queryByText(ORDER_NOW_NOTE)).not.toBeInTheDocument();
    });

    it("COD turned on alongside a gateway, logistics connected: both are offered, no \"Order now\"", async () => {
        vi.mocked(useRazorpayAdapter).mockReturnValue(asRazorpay(readyRazorpay));
        renderCheckout({ ...courier, activeGateways: ["razorpay"], cod: { enabled: true, minOrderValue: null } });

        expect(await screen.findByText("Pay via UPI")).toBeInTheDocument();
        expect(screen.getByText("Cash on delivery")).toBeInTheDocument();
        expect(orderNowButtons()).toHaveLength(0);
    });

    it("COD turned off with a gateway: gateway methods only", async () => {
        vi.mocked(useStripeAdapter).mockReturnValue(asStripe(readyStripe));
        renderCheckout({ ...courier, activeGateways: ["stripe"], cod: { enabled: false } });

        expect(await screen.findByText("Card (international)")).toBeInTheDocument();
        expect(screen.queryByText("Cash on delivery")).not.toBeInTheDocument();
        expect(orderNowButtons()).toHaveLength(0);
    });

    it("never saved (older backend or no setting): COD only with a logistics app and no gateway", async () => {
        const { unmount } = renderCheckout({ ...courier, activeGateways: [], cod: { enabled: null } });
        expect(await screen.findByText("Cash on delivery")).toBeInTheDocument();
        unmount();

        renderCheckout({ activeGateways: [], cod: { enabled: null } });
        expect(await screen.findByText(ORDER_NOW_NOTE)).toBeInTheDocument();
        expect(screen.queryByText("Cash on delivery")).not.toBeInTheDocument();
    });
});

describe("CheckoutView - Google Pay / Apple Pay as payment methods", () => {
    const WALLETS = { paymentMethodTypes: ["card", "link"], wallets: { applePay: true, googlePay: true } };

    beforeEach(() => {
        vi.clearAllMocks();
        walletProps.probe = null;
        walletProps.button = null;
        vi.mocked(fetchStockForCartItems).mockResolvedValue({});
        vi.mocked(useRazorpayAdapter).mockReturnValue(notReadyRazorpay as never);
        vi.mocked(useStripeAdapter).mockReturnValue({ ...readyStripe, stripe: { id: "stripe-js" } } as never);
        vi.mocked(postApi).mockResolvedValue({ data: { success: true, data: { order: { orderNumber: "1001" } } } } as Awaited<ReturnType<typeof postApi>>);
    });

    const reportAvailability = (availability: Record<string, boolean>) => act(() => walletProps.probe!.onAvailabilityChange!(availability));
    const radio = (id: string) => document.querySelector(`input[value="${id}"]`) as HTMLInputElement;

    async function chooseGooglePay() {
        renderCheckout({ activeGateways: ["stripe"], stripeExpress: WALLETS, currency: "INR" });
        await screen.findByTestId("wallet-probe");
        expect((await screen.findAllByText(/123 Main St/)).length).toBeGreaterThan(0);
        await userEvent.setup().click(radio("stripe_google_pay"));
        return screen.findByTestId("wallet-button-googlePay");
    }

    it("lists each enabled wallet as its own row after Stripe's card, with no separate express section", async () => {
        renderCheckout({ activeGateways: ["stripe"], stripeExpress: WALLETS, currency: "INR" });

        expect(await screen.findAllByText("Google Pay")).not.toHaveLength(0);
        expect(screen.getAllByText("Apple Pay")).not.toHaveLength(0);
        expect(screen.queryByText("Express checkout")).not.toBeInTheDocument();
        const ids = Array.from(document.querySelectorAll('input[name="paymentMethod"]')).map((el) => (el as HTMLInputElement).value);
        expect(ids).toEqual(["stripe_card", "stripe_google_pay", "stripe_apple_pay"]);
    });

    it("probes which wallets this device can use, with the store config and order total", async () => {
        renderCheckout({ activeGateways: ["stripe"], stripeExpress: WALLETS, currency: "INR" });
        await screen.findByTestId("wallet-probe");

        expect(walletProps.probe).toMatchObject({ hidden: true, currency: "INR", totalMinor: 10000, config: WALLETS });
        expect(walletProps.probe!.stripe).toEqual({ id: "stripe-js" });
    });

    it("keeps a wallet this device can't use listed, but greyed out and not selectable", async () => {
        renderCheckout({ activeGateways: ["stripe"], stripeExpress: WALLETS, currency: "INR" });
        await screen.findByTestId("wallet-probe");

        reportAvailability({ googlePay: true, applePay: false });

        await waitFor(() => expect(radio("stripe_apple_pay").disabled).toBe(true));
        expect(screen.getAllByText("Not available on this device").length).toBeGreaterThan(0);
        expect(radio("stripe_google_pay").disabled).toBe(false);
    });

    it("unpicks a wallet chosen before the device turned out not to support it", async () => {
        await chooseGooglePay();

        reportAvailability({ googlePay: false, applePay: true });

        await waitFor(() => expect(screen.queryByTestId("wallet-button-googlePay")).not.toBeInTheDocument());
        expect(radio("stripe_google_pay").checked).toBe(false);
    });

    it("choosing a wallet swaps \"Place order\" for that wallet's own Stripe button", async () => {
        await chooseGooglePay();

        expect(walletProps.button).toMatchObject({ wallet: "googlePay", totalMinor: 10000, config: WALLETS, shippingAddress: expect.objectContaining({ postalCode: "400001" }) });
        expect(screen.queryByRole("button", { name: "Place order" })).not.toBeInTheDocument();
    });

    it.each([
        ["Stripe isn't an active gateway", { activeGateways: [] as string[], stripeExpress: WALLETS, currency: "INR" }],
        ["the store sent no wallet config (older backend)", { activeGateways: ["stripe"], currency: "INR" }],
        ["the store turned both wallets off", { activeGateways: ["stripe"], stripeExpress: { paymentMethodTypes: ["card"], wallets: { applePay: false, googlePay: false } }, currency: "INR" }],
    ])("lists no wallet rows when %s", async (_why, props) => {
        renderCheckout(props);

        expect((await screen.findAllByText(/123 Main St/)).length).toBeGreaterThan(0);
        expect(screen.queryByText("Google Pay")).not.toBeInTheDocument();
        expect(screen.queryByTestId("wallet-probe")).not.toBeInTheDocument();
    });

    it("places the order through the normal path, as a Stripe payment, once the wallet payment is verified", async () => {
        await chooseGooglePay();

        await act(async () => {
            await walletProps.button!.onPaid({ paymentIntentId: "pi_9" });
        });

        await waitFor(() => expect(postApi).toHaveBeenCalledTimes(1));
        expect(vi.mocked(postApi).mock.calls[0]?.[1]).toMatchObject({
            paymentMethod: "stripe",
            gateway: "stripe",
            gatewayRef: { paymentIntentId: "pi_9" },
        });
    });

    it("runs the same stock check as the card flow before anything is charged", async () => {
        await chooseGooglePay();

        vi.mocked(fetchStockForCartItems).mockResolvedValue({ prod1: 0 });
        await expect(walletProps.button!.beforePay()).resolves.toBe("Some items have insufficient stock. Please update your cart.");

        vi.mocked(fetchStockForCartItems).mockResolvedValue({ prod1: 5 });
        await expect(walletProps.button!.beforePay()).resolves.toBeNull();
    });

    it("shows a payment error from the wallet button to the shopper", async () => {
        await chooseGooglePay();

        act(() => walletProps.button!.onError("The price changed. Please review your order and try again."));

        expect(await screen.findByText("The price changed. Please review your order and try again.")).toBeInTheDocument();
    });
});
