import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import userReducer from "@/redux/slices/userSlice";
import CheckoutView from "../CheckoutView";
import { useRazorpayAdapter } from "@/hooks/useRazorpayAdapter";
import { useStripeAdapter } from "@/hooks/useStripeAdapter";
import { fetchStockForCartItems } from "@/lib/stock-api";

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

    it("neither gateway active: COD/manual-only, matching today's exact fallback behavior", async () => {
        renderCheckout({ activeGateways: [] });

        // Desktop payment method list is always in the DOM (hidden via CSS on mobile).
        expect(await screen.findByText("Cash on delivery")).toBeInTheDocument();
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

describe("CheckoutView - cash on delivery setting and no-payment message", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchStockForCartItems).mockResolvedValue({});
        vi.mocked(useRazorpayAdapter).mockReturnValue(asRazorpay(notReadyRazorpay));
        vi.mocked(useStripeAdapter).mockReturnValue(asStripe(notReadyStripe));
    });

    const NO_PAYMENTS = "This store isn't accepting payments right now. Please contact the store.";

    it("COD turned off and no gateway: shows the message, no COD, Place order disabled", async () => {
        renderCheckout({ activeGateways: [], cod: { enabled: false, minOrderValue: null } });

        expect(await screen.findByRole("alert")).toHaveTextContent(NO_PAYMENTS);
        expect(screen.queryByText("Cash on delivery")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /place order/i })).toBeDisabled();
    });

    it("COD below its minimum and no gateway: says the minimum, in the store's currency", async () => {
        renderCheckout({ activeGateways: [], cod: { enabled: true, minOrderValue: 500 }, currency: "INR" });

        expect(await screen.findByRole("alert")).toHaveTextContent("Cash on delivery is available for orders of ₹500 or more.");
        expect(screen.queryByText("Cash on delivery")).not.toBeInTheDocument();
    });

    it("COD turned on alongside a gateway: both are offered", async () => {
        vi.mocked(useRazorpayAdapter).mockReturnValue(asRazorpay(readyRazorpay));

        renderCheckout({ activeGateways: ["razorpay"], cod: { enabled: true, minOrderValue: null } });

        expect(await screen.findByText("Pay via UPI")).toBeInTheDocument();
        expect(screen.getByText("Cash on delivery")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("COD turned off with a gateway: gateway methods only, no message", async () => {
        vi.mocked(useStripeAdapter).mockReturnValue(asStripe(readyStripe));

        renderCheckout({ activeGateways: ["stripe"], cod: { enabled: false } });

        expect(await screen.findByText("Card (international)")).toBeInTheDocument();
        expect(screen.queryByText("Cash on delivery")).not.toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("never saved (older backend or no setting): COD only when no gateway is active, as before", async () => {
        renderCheckout({ activeGateways: [], cod: { enabled: null } });
        expect(await screen.findByText("Cash on delivery")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
});
