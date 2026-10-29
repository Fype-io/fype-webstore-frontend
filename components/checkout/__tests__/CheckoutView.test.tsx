import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import userReducer from "@/redux/slices/userSlice";
import CheckoutView from "../CheckoutView";
import type StripeExpressCheckout from "../StripeExpressCheckout";
import { ADDRESS_REQUIRED_MESSAGE, ORDER_NOW_NOTE } from "../checkoutUtils";
import { useRazorpayAdapter } from "@/hooks/useRazorpayAdapter";
import { useStripeAdapter, type StripeCheckoutAdapter } from "@/hooks/useStripeAdapter";
import type { CheckoutGatewayAdapter } from "@/types/checkoutGateway";
import { fetchStockForCartItems } from "@/lib/stock-api";
import { calculateShippingRate, getExpectedTAT } from "@/lib/shipping-api";
import { deleteApi, getApi, postApi, putApi } from "@/lib/client-api";
import { AxiosError, type AxiosResponse } from "axios";

// Mock next/navigation's useRouter (CheckoutView calls router.push on success,
// and router.back once the last cart item is removed).
const { routerBack } = vi.hoisted(() => ({ routerBack: vi.fn() }));
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), back: routerBack }),
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
        putApi: vi.fn(),
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

const notReadyRazorpay: CheckoutGatewayAdapter = { key: "razorpay", isReady: false, isLoading: false, availableMethods: [], open: vi.fn() };
const readyRazorpay: CheckoutGatewayAdapter = {
    key: "razorpay",
    isReady: true,
    isLoading: false,
    availableMethods: [
        { id: "razorpay_upi", gatewayKey: "razorpay", title: "Pay via UPI", subtitle: "Use any registered UPI ID" },
        { id: "razorpay_card", gatewayKey: "razorpay", title: "Debit/Credit cards", subtitle: "Visa, Mastercard, RuPay & more" },
    ],
    open: vi.fn().mockResolvedValue({ gatewayRef: { razorpay_order_id: "o1", razorpay_payment_id: "p1", razorpay_signature: "s1" } }),
};
const notReadyStripe: StripeCheckoutAdapter = { key: "stripe", isReady: false, isLoading: false, availableMethods: [], open: vi.fn(), stripe: null };
const readyStripe: StripeCheckoutAdapter = {
    key: "stripe",
    isReady: true,
    isLoading: false,
    availableMethods: [{ id: "stripe_card", gatewayKey: "stripe", title: "Card (international)", subtitle: "Visa, Mastercard, Amex via Stripe" }],
    open: vi.fn().mockResolvedValue({ gatewayRef: { paymentIntentId: "pi_1" } }),
    stripe: null,
};

type UserState = ReturnType<typeof userReducer>;

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
                // Remaining UserState fields are left out - this test only
                // provides what CheckoutView actually reads - and `user` uses an
                // older shape (`id`, no verification flags), hence the cast
                // through `unknown` to the slice's real state type.
            } as unknown as UserState,
        },
    });
}

// Place order is no longer disabled while the address loads (a missing address
// is a validation error on click), so a test that orders waits for the address.
const addressLoaded = async () => expect((await screen.findAllByText(/123 Main St/)).length).toBeGreaterThan(0);

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
        vi.mocked(useRazorpayAdapter).mockReturnValue(notReadyRazorpay);
        vi.mocked(useStripeAdapter).mockReturnValue(notReadyStripe);
    });

    it("neither gateway active, no logistics app: \"Order now\" only, no COD", async () => {
        renderCheckout({ activeGateways: [] });

        expect(await screen.findByText(ORDER_NOW_NOTE)).toBeInTheDocument();
        expect(screen.queryByText("Cash on delivery")).not.toBeInTheDocument();
        expect(screen.queryByText("Pay via UPI")).not.toBeInTheDocument();
        expect(screen.queryByText("Card (international)")).not.toBeInTheDocument();
    });

    it("only Razorpay active: shows Razorpay's methods, not Stripe's, no COD", async () => {
        vi.mocked(useRazorpayAdapter).mockReturnValue(readyRazorpay);

        renderCheckout({ activeGateways: ["razorpay"] });

        expect(await screen.findByText("Pay via UPI")).toBeInTheDocument();
        expect(screen.getByText("Debit/Credit cards")).toBeInTheDocument();
        expect(screen.queryByText("Card (international)")).not.toBeInTheDocument();
        expect(screen.queryByText("Cash on delivery")).not.toBeInTheDocument();
    });

    it("only Stripe active: shows Stripe's method, not Razorpay's, no COD", async () => {
        vi.mocked(useStripeAdapter).mockReturnValue(readyStripe);

        renderCheckout({ activeGateways: ["stripe"] });

        expect(await screen.findByText("Card (international)")).toBeInTheDocument();
        expect(screen.queryByText("Pay via UPI")).not.toBeInTheDocument();
        expect(screen.queryByText("Cash on delivery")).not.toBeInTheDocument();
    });

    it("both active: methods from both adapters are merged into one list, no id collision", async () => {
        vi.mocked(useRazorpayAdapter).mockReturnValue(readyRazorpay);
        vi.mocked(useStripeAdapter).mockReturnValue(readyStripe);

        renderCheckout({ activeGateways: ["razorpay", "stripe"] });

        expect(await screen.findByText("Pay via UPI")).toBeInTheDocument();
        expect(screen.getByText("Debit/Credit cards")).toBeInTheDocument();
        expect(screen.getByText("Card (international)")).toBeInTheDocument();
        expect(screen.queryByText("Cash on delivery")).not.toBeInTheDocument();
    });

    it("dispatches to the Razorpay adapter when a Razorpay method is selected", async () => {
        vi.mocked(useRazorpayAdapter).mockReturnValue(readyRazorpay);
        vi.mocked(useStripeAdapter).mockReturnValue(readyStripe);
        const user = userEvent.setup();

        renderCheckout({ activeGateways: ["razorpay", "stripe"] });

        await screen.findByText("Pay via UPI");
        await addressLoaded();
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
        vi.mocked(useRazorpayAdapter).mockReturnValue(readyRazorpay);
        vi.mocked(useStripeAdapter).mockReturnValue(readyStripe);
        const user = userEvent.setup();

        renderCheckout({ activeGateways: ["razorpay", "stripe"] });

        await screen.findByText("Card (international)");
        await addressLoaded();
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

// The cart API finds a line by productId + variantId (crmApp cart.controller.ts).
// Checkout used to send the line's own _id ("item1"), so every +/- was a 404 and
// every delete a no-op, and the failure was never shown.
describe("CheckoutView - changing and removing cart items", () => {
    const cartWith = (quantity: number) => ({
        _id: "cart1",
        cartId: "cart1",
        items: [{ _id: "item1", productId: "prod1", name: "Test product", image: "", price: 100, quantity, maxQuantity: 10 }],
        subtotal: 100 * quantity,
        tax: 0,
        shipping: 0,
        discount: 0,
        total: 100 * quantity,
        itemCount: quantity,
    });
    const cartResponse = (cart: object) => ({ data: { success: true, data: { cart } } });
    const notFound = () =>
        new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
            status: 404,
            data: { success: false, code: "ITEM_NOT_FOUND", message: "Item not found in cart" },
        } as AxiosResponse);
    // CartItemsCard renders twice (mobile and desktop); either copy triggers the same handler.
    const button = (name: string) => screen.getAllByRole("button", { name })[0]!;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchStockForCartItems).mockResolvedValue({});
        vi.mocked(useRazorpayAdapter).mockReturnValue(notReadyRazorpay);
        vi.mocked(useStripeAdapter).mockReturnValue(notReadyStripe);
    });

    it("increases the quantity by productId, not the cart line's _id, and shows the new quantity", async () => {
        vi.mocked(putApi).mockResolvedValueOnce(cartResponse(cartWith(2)) as Awaited<ReturnType<typeof putApi>>);
        const user = userEvent.setup();
        renderCheckout();

        await user.click(await screen.findAllByRole("button", { name: "Increase quantity of Test product" }).then((b) => b[0]!));

        await waitFor(() => expect(putApi).toHaveBeenCalledTimes(1));
        expect(vi.mocked(putApi).mock.calls[0]?.[0]).toBe("/commerce/cart/store-1/update/prod1");
        expect(vi.mocked(putApi).mock.calls[0]?.[1]).toMatchObject({ quantity: 2 });
        expect(await screen.findAllByText("2 items")).not.toHaveLength(0);
    });

    it("removes the item by productId and goes back once the cart is empty", async () => {
        vi.mocked(deleteApi).mockResolvedValueOnce(cartResponse({ ...cartWith(1), items: [], itemCount: 0 }) as Awaited<ReturnType<typeof deleteApi>>);
        const user = userEvent.setup();
        renderCheckout();

        await user.click(await screen.findAllByRole("button", { name: "Remove Test product" }).then((b) => b[0]!));

        await waitFor(() => expect(routerBack).toHaveBeenCalledTimes(1));
        expect(vi.mocked(deleteApi).mock.calls[0]?.[0]).toBe("/commerce/cart/store-1/remove/prod1");
    });

    it("shows why a quantity change failed instead of silently doing nothing", async () => {
        vi.mocked(putApi).mockRejectedValueOnce(notFound());
        const user = userEvent.setup();
        renderCheckout();

        await user.click(await screen.findAllByRole("button", { name: "Increase quantity of Test product" }).then((b) => b[0]!));

        expect((await screen.findAllByRole("alert")).map((el) => el.textContent)).toContain("Item not found in cart");
        expect(button("Increase quantity of Test product")).toBeInTheDocument();
    });

    it("stays on checkout and shows the error when removing the last item fails", async () => {
        vi.mocked(deleteApi).mockRejectedValueOnce(notFound());
        const user = userEvent.setup();
        renderCheckout();

        await user.click(await screen.findAllByRole("button", { name: "Remove Test product" }).then((b) => b[0]!));

        expect((await screen.findAllByRole("alert")).map((el) => el.textContent)).toContain("Item not found in cart");
        expect(routerBack).not.toHaveBeenCalled();
        expect(button("Remove Test product")).toBeInTheDocument();
    });
});

const asRazorpay = (a: object) => a as unknown as ReturnType<typeof useRazorpayAdapter>;
const asStripe = (a: object) => a as unknown as ReturnType<typeof useStripeAdapter>;

// COD needs a logistics app that collects the cash (shipmentProvider dtdc/
// delhivery), then follows the store's setting. With no gateway and no COD,
// "Order now" places the order unpaid (paymentMethod "manual") and the store
// arranges payment. It never appears alongside a gateway or COD.
// A missing address used to grey out Place order with no explanation (and on
// mobile turn the button into "Add address"). It's now a validation error on the
// address card when the shopper tries to order.
describe("CheckoutView - ordering without a delivery address", () => {
    const addressesResponse = (addresses: unknown[]) => ({ data: { success: true, data: { addresses } } });
    const orderNowButtons = () => screen.getAllByRole("button", { name: /order now/i });

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchStockForCartItems).mockResolvedValue({});
        vi.mocked(useRazorpayAdapter).mockReturnValue(notReadyRazorpay);
        vi.mocked(useStripeAdapter).mockReturnValue(notReadyStripe);
        vi.mocked(getApi).mockResolvedValue(addressesResponse([]) as Awaited<ReturnType<typeof getApi>>);
    });
    afterEach(() => {
        vi.mocked(getApi).mockResolvedValue(addressesResponse([TEST_ADDRESS]) as Awaited<ReturnType<typeof getApi>>);
    });

    it("keeps the order buttons clickable and shows a validation error instead of ordering", async () => {
        const user = userEvent.setup();
        renderCheckout({ activeGateways: [] });
        await waitFor(() => expect(getApi).toHaveBeenCalled());

        const [mobile, desktop] = orderNowButtons();
        expect(mobile).not.toBeDisabled();
        expect(desktop).not.toBeDisabled();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();

        await user.click(desktop!);

        expect(await screen.findByRole("alert")).toHaveTextContent(ADDRESS_REQUIRED_MESSAGE);
        expect(postApi).not.toHaveBeenCalled();
    });

    it("on mobile, the bottom button shows the same error rather than jumping to the address form", async () => {
        const user = userEvent.setup();
        renderCheckout({ activeGateways: [] });
        await waitFor(() => expect(getApi).toHaveBeenCalled());

        await user.click(orderNowButtons()[0]!);

        expect(await screen.findByRole("alert")).toHaveTextContent(ADDRESS_REQUIRED_MESSAGE);
        expect(screen.queryByText("Add New Address")).not.toBeInTheDocument();
        expect(postApi).not.toHaveBeenCalled();
    });

    it("opens the address form from the card's add button", async () => {
        const user = userEvent.setup();
        renderCheckout({ activeGateways: [] });

        await user.click(await screen.findByRole("button", { name: "+ Add delivery address" }));

        expect((await screen.findAllByText("Add New Address")).length).toBeGreaterThan(0);
    });
});

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
        await addressLoaded();
        await waitFor(() => expect(buttons[1]).not.toBeDisabled());
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
        await addressLoaded();
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
        await addressLoaded();
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

// A UAE store shipping with Jeebly: addresses have no postal code, so the rate
// is asked for by city, state and country, and there's no TAT lookup (the
// backend estimates delivery from the pickup date).
describe("CheckoutView - Jeebly (quoted by city)", () => {
    const UAE_ADDRESS = {
        addressId: "addr-ae",
        firstName: "Aisha",
        lastName: "Test",
        phoneNumber: "+971505186403",
        addressLine1: "Villa 43",
        addressLine2: "Street 12",
        city: "Al Barsha",
        state: "Dubai",
        country: "AE",
        postalCode: "",
        isDefault: true,
    };
    const addressesResponse = (address: object) => ({ data: { success: true, data: { addresses: [address] } } }) as unknown as AxiosResponse;
    const rate = (r: object) => r as Awaited<ReturnType<typeof calculateShippingRate>>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchStockForCartItems).mockResolvedValue({});
        vi.mocked(useRazorpayAdapter).mockReturnValue(notReadyRazorpay);
        vi.mocked(useStripeAdapter).mockReturnValue(notReadyStripe);
        vi.mocked(getApi).mockResolvedValue(addressesResponse(UAE_ADDRESS));
    });
    afterEach(() => {
        // Back to the Indian address the rest of this file uses.
        vi.mocked(getApi).mockResolvedValue(addressesResponse(TEST_ADDRESS));
        vi.mocked(calculateShippingRate).mockResolvedValue(null);
    });

    it("asks for the rate by city, without a pincode or a TAT lookup", async () => {
        vi.mocked(calculateShippingRate).mockResolvedValue(rate({ serviceable: true, deliveryCharge: 15, estimatedDays: 1, source: "api" }));

        renderCheckout({ hasDeliveryApp: true, shipmentProvider: "jeebly" });

        await waitFor(() =>
            expect(calculateShippingRate).toHaveBeenCalledWith("store-1", "", expect.any(Array), "jeebly", { city: "Al Barsha", state: "Dubai", country: "AE" })
        );
        expect(getExpectedTAT).not.toHaveBeenCalled();
        expect(screen.queryByText(/not serviceable|don't deliver/)).not.toBeInTheDocument();
        // Jeebly collects cash, so COD is offered with no gateway.
        expect(await screen.findByText("Cash on delivery")).toBeInTheDocument();
    });

    it("tells the shopper when Jeebly doesn't deliver to the address's area", async () => {
        vi.mocked(calculateShippingRate).mockResolvedValue(
            rate({ serviceable: false, deliveryCharge: null, estimatedDays: null, reason: "not_serviceable", source: "api" })
        );

        renderCheckout({ hasDeliveryApp: true, shipmentProvider: "jeebly" });

        expect(await screen.findByText(/We don't deliver to this area yet/)).toBeInTheDocument();
    });

    describe("the store's COD charge", () => {
        const summaryTotal = () => screen.getByText("Payment summary").closest("section")!.textContent;

        it("COD as the only way to pay: the summary adds the charge to the total", async () => {
            vi.mocked(calculateShippingRate).mockResolvedValue(rate({ serviceable: true, deliveryCharge: 15, estimatedDays: 1, source: "api" }));

            renderCheckout({ hasDeliveryApp: true, shipmentProvider: "jeebly", activeGateways: [], cod: { enabled: true, minOrderValue: null }, codCharge: 5 });

            expect(await screen.findByText("COD charge")).toBeInTheDocument();
            // 100 subtotal + 15 shipping + 5 COD charge
            await waitFor(() => expect(summaryTotal()).toMatch(/Total\D*120/));
        });

        it("paying online: no charge until COD is chosen, and the COD row shows the higher amount", async () => {
            const user = userEvent.setup();
            vi.mocked(calculateShippingRate).mockResolvedValue(rate({ serviceable: true, deliveryCharge: 15, estimatedDays: 1, source: "api" }));

            renderCheckout({ hasDeliveryApp: true, shipmentProvider: "jeebly", activeGateways: ["razorpay"], cod: { enabled: true, minOrderValue: null }, codCharge: 5 });

            const codRow = (await screen.findAllByText("Cash on delivery"))[0]!.closest("label")!;
            await waitFor(() => expect(codRow.textContent).toMatch(/120/));
            expect(screen.queryByText("COD charge")).not.toBeInTheDocument();
            await waitFor(() => expect(summaryTotal()).toMatch(/Total\D*115/));

            await user.click(codRow);
            expect(await screen.findByText("COD charge")).toBeInTheDocument();
            expect(summaryTotal()).toMatch(/Total\D*120/);
        });

        it("no charge set: nothing added", async () => {
            vi.mocked(calculateShippingRate).mockResolvedValue(rate({ serviceable: true, deliveryCharge: 15, estimatedDays: 1, source: "api" }));
            renderCheckout({ hasDeliveryApp: true, shipmentProvider: "jeebly", activeGateways: [], cod: { enabled: true, minOrderValue: null } });
            await waitFor(() => expect(summaryTotal()).toMatch(/Total\D*115/));
            expect(screen.queryByText("COD charge")).not.toBeInTheDocument();
        });
    });
});

describe("CheckoutView - tax on shipping is in the total shown", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchStockForCartItems).mockResolvedValue({});
        vi.mocked(useRazorpayAdapter).mockReturnValue(asRazorpay(notReadyRazorpay));
        vi.mocked(useStripeAdapter).mockReturnValue(asStripe(notReadyStripe));
    });

    it("a rated delivery charge brings its tax: total = items 100 + delivery 60 + tax on delivery 3", async () => {
        vi.mocked(calculateShippingRate).mockResolvedValue({ serviceable: true, deliveryCharge: 60, shippingTax: 3 } as Awaited<ReturnType<typeof calculateShippingRate>>);
        renderCheckout({ hasDeliveryApp: true, shipmentProvider: "dtdc", activeGateways: [] });
        await addressLoaded();
        await waitFor(() => expect(screen.getAllByText("₹163").length).toBeGreaterThan(0));
        expect(screen.queryAllByText("Tax on shipping").length).toBe(0); // one total row without the server's tax lines
    });
});
