"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
    addAddress,
    clearCart,
    createOrder,
    deleteAddress,
    fetchAddresses,
    removeFromCart,
    updateAddress,
    updateCartItem,
    type Address,
    type CartItem,
} from "@/redux/slices/userSlice";
import { calculateShippingRate, getExpectedTAT } from "@/lib/shipping-api";
import { fetchStockForCartItems } from "@/lib/stock-api";
import { useRazorpayAdapter } from "@/hooks/useRazorpayAdapter";
import { useStripeAdapter } from "@/hooks/useStripeAdapter";
import type { PaymentMethodOption } from "@/types/checkoutGateway";
import AuthModal from "@/components/shared/AuthModal";
import AddAddressPanel from "./AddAddressPanel";
import CartItemsCard from "./CartItemsCard";
import CheckoutCta from "./CheckoutCta";
import CheckoutHeader from "./CheckoutHeader";
import DeliveryAddressCard from "./DeliveryAddressCard";
import PaymentMethodList from "./PaymentMethodList";
import PaymentSummaryCard from "./PaymentSummaryCard";
import StripeExpressCheckout, { hasExpressMethods, type StripeExpressConfig } from "./StripeExpressCheckout";
import SelectAddressPanel from "./SelectAddressPanel";
import { addressKey, codAvailability, ORDER_NOW_NOTE, type CheckoutViewState, type CodSetting, type PaymentMethodId } from "./checkoutUtils";
import type { ShipmentProvider } from "@/lib/shipment-provider";

interface CheckoutViewProps {
    storeId: string;
    shopName?: string;
    hasDeliveryApp: boolean;
    hasManualShipping: boolean;
    /** The store's resolved shipment provider (lib/shipment-provider.ts); COD needs one that collects cash. */
    shipmentProvider: ShipmentProvider;
    /** Registered, adapter-backed gateway keys active for this store (e.g.
     * ['razorpay'], ['stripe'], both, or []) - see useActiveGateways. */
    activeGateways: string[];
    stripePublishableKey?: string;
    /** Which Stripe methods the store allows (public settings); drives the express checkout buttons. */
    stripeExpress?: StripeExpressConfig;
    /** The store's currency code; the express buttons need it before any payment exists. */
    currency?: string;
    /** The store's cash-on-delivery setting (public settings payment.cod). */
    cod?: CodSetting;
}

const getCartHash = (items: { productId: string; variantId?: string; quantity: number }[]) =>
    [...items]
        .sort((a, b) => a.productId.localeCompare(b.productId))
        .map((i) => `${i.productId}:${i.variantId || ""}:${i.quantity}`)
        .join("|");

export default function CheckoutView({
    storeId,
    shopName,
    hasDeliveryApp,
    hasManualShipping,
    shipmentProvider,
    activeGateways,
    stripePublishableKey,
    stripeExpress,
    currency,
    cod,
}: CheckoutViewProps) {
    const dispatch = useAppDispatch();
    const router = useRouter();
    const { user, isAuthenticated, cart, addresses } = useAppSelector((state) => state.user);

    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [view, setView] = useState<CheckoutViewState>("checkout");
    const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
    const [editingAddress, setEditingAddress] = useState<Address | null>(null);
    const [addressToDelete, setAddressToDelete] = useState<string | null>(null);
    const [savingAddress, setSavingAddress] = useState(false);
    const [isOrderSummaryOpen, setIsOrderSummaryOpen] = useState(true);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodId | null>(null);
    const [tatInfo, setTatInfo] = useState<{ deliveryDate?: string } | null>(null);
    const [shipmentState, setShipmentState] = useState<{ serviceable: boolean; deliveryCharge: number | null; reason?: string }>({
        serviceable: true,
        deliveryCharge: null,
    });
    const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
    const [processingOrder, setProcessingOrder] = useState(false);
    const [orderError, setOrderError] = useState<string | null>(null);
    const [prevAddresses, setPrevAddresses] = useState(addresses);
    const lastCallRef = useRef<{ cartHash: string | null; pincode: string | null }>({ cartHash: null, pincode: null });

    const shippingCost = hasDeliveryApp || hasManualShipping ? (shipmentState.deliveryCharge ?? cart?.shipping ?? 0) : (cart?.shipping ?? 0);
    // COD needs a logistics app that collects the cash, then follows the store's
    // setting (on/off, minimum order value); a store that never saved it keeps the
    // old rule: COD only when no online gateway is active.
    const hasPaymentGateway = activeGateways.length > 0;
    const orderTotal = (cart?.subtotal || 0) + (cart?.tax || 0) + shippingCost - (cart?.discount || 0);
    const showCod = codAvailability(cod, hasPaymentGateway, orderTotal, shipmentProvider).offered;
    // COD is the only way to pay: chosen automatically, no method picker needed.
    const codOnly = showCod && !hasPaymentGateway;
    // Nothing else to pay with (no gateway, no COD): "Order now" places the order
    // unpaid and the store arranges payment. Never shown alongside either.
    const orderNow = !hasPaymentGateway && !showCod;
    const notServiceable = (hasDeliveryApp || hasManualShipping) && !shipmentState.serviceable;

    useEffect(() => {
        if (codOnly) setSelectedPaymentMethod("cod");
        else if (!showCod) setSelectedPaymentMethod((m) => (m === "cod" ? null : m));
    }, [codOnly, showCod]);

    // One adapter instance per active gateway - each hook internally no-ops
    // until its own SDK is actually needed (useRazorpayAdapter polls for the
    // globally-injected checkout.js only if mounted; useStripeAdapter only
    // calls loadStripe() when given a publishableKey). Neither's readiness
    // depends on the other.
    const razorpayAdapter = useRazorpayAdapter({ storeId, storeName: shopName });
    const stripeAdapter = useStripeAdapter({ storeId, publishableKey: activeGateways.includes("stripe") ? stripePublishableKey : undefined });

    const adaptersByGateway: Record<string, ReturnType<typeof useRazorpayAdapter>> = {
        razorpay: razorpayAdapter,
        stripe: stripeAdapter,
    };
    const activeAdapters = activeGateways.map((key) => adaptersByGateway[key]).filter((a): a is NonNullable<typeof a> => !!a);
    const gatewayMethods: PaymentMethodOption[] = activeAdapters.filter((a) => a.isReady).flatMap((a) => a.availableMethods);
    // COD isn't owned by any gateway adapter - kept as a standalone entry,
    // same as before multi-gateway support, shown only when no gateway is active.
    const codMethod: PaymentMethodOption = { id: "cod", gatewayKey: "manual", title: "Cash on delivery", subtitle: "Pay with cash" };
    const availableMethods: PaymentMethodOption[] = showCod ? [...gatewayMethods, codMethod] : gatewayMethods;
    const isPaymentLoading = activeAdapters.some((a) => a.isLoading);
    const methodToGateway = new Map(availableMethods.map((m) => [m.id, m.gatewayKey]));

    useEffect(() => {
        if (isAuthenticated && storeId) dispatch(fetchAddresses({ storeId }));
    }, [dispatch, isAuthenticated, storeId]);

    if (addresses !== prevAddresses) {
        setPrevAddresses(addresses);
        if (addresses.length === 0) {
            setSelectedAddress(null);
        } else if (!selectedAddress || !addresses.some((a) => addressKey(a) === addressKey(selectedAddress))) {
            const preferred = addresses.find((a) => a.isDefault) || addresses[0];
            setSelectedAddress(preferred);
        }
    }

    const fetchManualShippingRate = async () => {
        if (!cart?.items.length) return;
        const cartHash = getCartHash(cart.items);
        if (lastCallRef.current.cartHash === cartHash && lastCallRef.current.pincode === "manual") return;
        lastCallRef.current = { cartHash, pincode: "manual" };
        setIsCalculatingShipping(true);
        try {
            const rate = await calculateShippingRate(storeId, "", cart.items, "manual");
            if (rate) setShipmentState({ serviceable: rate.serviceable, deliveryCharge: rate.deliveryCharge, reason: rate.reason });
        } finally {
            setIsCalculatingShipping(false);
        }
    };

    const fetchShippingAndTAT = async () => {
        if (!selectedAddress || !cart?.items.length) return;
        const pincode = selectedAddress.postalCode;
        const cartHash = getCartHash(cart.items);
        if (lastCallRef.current.cartHash === cartHash && lastCallRef.current.pincode === pincode) return;

        if (!/^[1-9][0-9]{5}$/.test(String(pincode).trim())) {
            setShipmentState({ serviceable: false, deliveryCharge: null, reason: "invalid_pincode" });
            return;
        }
        lastCallRef.current = { cartHash, pincode };
        setIsCalculatingShipping(true);
        try {
            const [tatRes, rateRes] = await Promise.all([getExpectedTAT(storeId, pincode), calculateShippingRate(storeId, pincode, cart.items)]);
            if (tatRes.success) setTatInfo(tatRes);
            if (rateRes) setShipmentState({ serviceable: rateRes.serviceable, deliveryCharge: rateRes.deliveryCharge, reason: rateRes.reason });
            else setShipmentState({ serviceable: false, deliveryCharge: null, reason: "rate_api_failed" });
        } finally {
            setIsCalculatingShipping(false);
        }
    };

    useEffect(() => {
        if (hasDeliveryApp && selectedAddress && cart?.items.length) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            fetchShippingAndTAT();
        } else if (hasManualShipping && cart?.items.length) {
            fetchManualShippingRate();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasDeliveryApp, hasManualShipping, selectedAddress?.postalCode, cart?.items]);

    const handleCreateOrder = async (paymentMethod: string, gateway?: string, gatewayRef?: Record<string, unknown>) => {
        if (!cart || !selectedAddress) return;
        setOrderError(null);
        setProcessingOrder(true);
        try {
            const order = await dispatch(
                createOrder({
                    storeId,
                    orderData: {
                        items: cart.items,
                        shippingAddress: selectedAddress,
                        billingAddress: selectedAddress,
                        paymentMethod,
                        customerNotes: "",
                        subtotal: cart.subtotal,
                        tax: cart.tax,
                        shipping: shippingCost,
                        total: (cart.subtotal || 0) + (cart.tax || 0) + shippingCost - (cart.discount || 0),
                        estimatedDelivery: tatInfo?.deliveryDate || null,
                        ...(gateway && gatewayRef ? { gateway, gatewayRef } : {}),
                    },
                })
            ).unwrap();
            await dispatch(clearCart({ storeId }));
            router.push(`/orders/${order.orderNumber}`);
        } catch (error) {
            setOrderError(typeof error === "string" ? error : "Order creation failed. Please contact support.");
        } finally {
            setProcessingOrder(false);
        }
    };

    // An error message when a cart item is out of stock, otherwise null.
    const checkCartStock = async (): Promise<string | null> => {
        if (!cart) return null;
        try {
            const freshStock = await fetchStockForCartItems(storeId, cart.items);
            const hasIssue = cart.items.some((item) => {
                const key = item.variantId ? `${item.productId}:${item.variantId}` : item.productId;
                const available = freshStock[key];
                if (available === null || available === undefined) return false;
                return item.quantity > available;
            });
            if (hasIssue) return "Some items have insufficient stock. Please update your cart.";
        } catch {
            // Backend is source of truth if the pre-check fails
        }
        return null;
    };

    const handlePlaceOrder = async (method: PaymentMethodId | null = selectedPaymentMethod) => {
        if (!cart?.items.length || !selectedAddress) return;
        setOrderError(null);

        const stockError = await checkCartStock();
        if (stockError) {
            setOrderError(stockError);
            return;
        }

        if (orderNow) {
            await handleCreateOrder("manual");
            return;
        }
        if (codOnly || method === "cod") {
            // "cod", not "manual": the backend books the courier with the COD
            // amount only for paymentMethod "cod".
            await handleCreateOrder("cod");
            return;
        }

        if (!user || !method) return;
        const totalAmount = (cart.subtotal || 0) + (cart.tax || 0) + shippingCost - (cart.discount || 0);
        if (totalAmount <= 0) return;

        const gatewayKey = methodToGateway.get(method);
        const adapter = gatewayKey ? adaptersByGateway[gatewayKey] : undefined;
        if (!gatewayKey || !adapter) {
            setOrderError("This payment method is not available right now.");
            return;
        }

        try {
            if (!selectedAddress) {
                setOrderError("Choose a shipping address before paying.");
                return;
            }
            const { gatewayRef } = await adapter.open({
                amount: Math.round(totalAmount * 100),
                shippingAddress: selectedAddress as unknown as Record<string, unknown>,
                billingAddress: selectedAddress as unknown as Record<string, unknown>,
                userDetails: { name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Customer", email: user.email || "", phone: user.phone || "" },
                methodId: method,
            });
            await handleCreateOrder(gatewayKey, gatewayKey, gatewayRef);
        } catch (error) {
            setOrderError(error instanceof Error ? error.message : "Payment failed. Please try again.");
        }
    };

    const handleUpdateQuantity = (item: CartItem, quantity: number) => {
        dispatch(updateCartItem({ storeId, itemId: item._id, variantId: item.variantId, quantity }));
    };

    const handleRemove = (item: CartItem) => {
        dispatch(removeFromCart({ storeId, itemId: item._id, variantId: item.variantId }));
        // Removing the last item would otherwise leave the user staring at
        // checkout's own "cart is empty" state - go back to wherever they
        // came from instead.
        if (cart?.items.length === 1) {
            router.back();
        }
    };

    const handleSaveAddress = async (payload: Omit<Address, "_id" | "addressId">) => {
        setSavingAddress(true);
        try {
            if (editingAddress) {
                const updated = await dispatch(
                    updateAddress({ storeId, addressId: editingAddress.addressId, address: payload })
                ).unwrap();
                setSelectedAddress(updated);
            } else {
                const created = await dispatch(addAddress({ storeId, address: payload })).unwrap();
                setSelectedAddress(created);
            }
            setEditingAddress(null);
            setView("checkout");
        } finally {
            setSavingAddress(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!addressToDelete) return;
        await dispatch(deleteAddress({ storeId, addressId: addressToDelete }));
        if (selectedAddress && addressKey(selectedAddress) === addressToDelete) {
            const remaining = addresses.filter((a) => addressKey(a) !== addressToDelete);
            setSelectedAddress(remaining[0] || null);
        }
        setAddressToDelete(null);
    };

    const renderPanel = (panel: ReactNode, isModal: boolean) => {
        if (isModal) {
            return (
                <div className="hidden md:flex fixed inset-0 z-[100] items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-[500px] flex flex-col max-h-[90vh] shadow-2xl overflow-hidden relative">
                        {panel}
                    </div>
                </div>
            );
        }
        return (
            <div className="md:hidden min-h-[100dvh] h-[100dvh] bg-gray-100 flex justify-center font-sans">
                <div className="w-full max-w-md bg-white flex flex-col relative mx-auto">{panel}</div>
            </div>
        );
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-[100dvh] bg-gray-100 flex items-center justify-center font-sans px-4">
                <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm">
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Sign in to checkout</h1>
                    <p className="text-sm text-gray-500 mb-6">Please sign in to review your order and complete your purchase.</p>
                    <button
                        type="button"
                        onClick={() => setIsAuthModalOpen(true)}
                        className="w-full py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-900 transition-all"
                    >
                        Sign In
                    </button>
                    <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} storeId={storeId} shopName={shopName} />
                </div>
            </div>
        );
    }

    if (!cart || cart.items.length === 0) {
        return (
            <div className="min-h-[100dvh] bg-gray-100 flex flex-col font-sans">
                <div className="w-full max-w-md mx-auto bg-white min-h-[100dvh] md:min-h-0 md:mt-8 md:rounded-2xl md:border md:border-gray-200 overflow-hidden">
                    <CheckoutHeader title="Checkout" />
                    <div className="p-8 text-center">
                        <p className="text-xl text-gray-600 mb-4">Your cart is empty</p>
                        <Link href="/products" className="inline-block px-6 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800">
                            Continue Shopping
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const total = (cart.subtotal || 0) + (cart.tax || 0) + shippingCost - (cart.discount || 0);
    const shippingDisplay = hasDeliveryApp || hasManualShipping ? shipmentState.deliveryCharge : shippingCost;
    const showExpress =
        activeGateways.includes("stripe") &&
        hasExpressMethods(stripeExpress) &&
        !!currency &&
        !!user &&
        !!selectedAddress &&
        !notServiceable &&
        !orderNow &&
        total > 0;
    const ctaDisabled = !selectedAddress || notServiceable || isCalculatingShipping || processingOrder || isPaymentLoading;
    const desktopPlaceDisabled = ctaDisabled || (!codOnly && !orderNow && !selectedPaymentMethod);

    const checkoutMain = (
        <div className={`${view !== "checkout" ? "hidden md:flex" : "flex"} min-h-[100dvh] h-[100dvh] md:h-auto bg-gray-100 justify-center font-sans md:py-8 md:px-4`}>
            <div className="w-full max-w-md md:max-w-4xl lg:max-w-5xl flex md:gap-6 lg:gap-8 relative overflow-hidden md:overflow-visible mx-auto">
                <div className="w-full bg-white md:rounded-2xl h-full md:h-auto md:min-h-[600px] relative flex flex-col shadow-2xl md:shadow-sm md:border border-gray-200 overflow-hidden md:flex-1">
                    <CheckoutHeader title="Checkout" />

                    <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 sm:py-6 flex flex-col gap-5 sm:gap-8 pb-4 sm:pb-6">
                        <div className="md:hidden">
                            <CartItemsCard
                                items={cart.items}
                                collapsible
                                isOpen={isOrderSummaryOpen}
                                onToggle={() => setIsOrderSummaryOpen((open) => !open)}
                                onUpdateQuantity={handleUpdateQuantity}
                                onRemove={handleRemove}
                            />
                        </div>
                        <CartItemsCard
                            items={cart.items}
                            className="hidden md:flex"
                            onUpdateQuantity={handleUpdateQuantity}
                            onRemove={handleRemove}
                        />

                        <DeliveryAddressCard
                            addresses={addresses}
                            selected={selectedAddress}
                            onChange={() => setView("select-address")}
                            onAdd={() => {
                                setEditingAddress(null);
                                setView("add-address");
                            }}
                            notServiceable={notServiceable}
                            tatInfo={tatInfo?.deliveryDate}
                        />

                        {orderNow ? (
                            <section className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4 sm:p-5 flex flex-col gap-2 md:mt-5">
                                <h2 className="text-[16px] sm:text-lg font-bold text-gray-800 tracking-tight">Payment</h2>
                                <p className="text-gray-500 text-[13px] sm:text-sm font-medium">{ORDER_NOW_NOTE}</p>
                            </section>
                        ) : (
                            <>
                                {showExpress && stripeExpress && currency && selectedAddress && (
                                    <StripeExpressCheckout
                                        stripe={stripeAdapter.stripe}
                                        storeId={storeId}
                                        currency={currency}
                                        totalMinor={Math.round(total * 100)}
                                        config={stripeExpress}
                                        shippingAddress={selectedAddress as unknown as Record<string, unknown>}
                                        billingAddress={selectedAddress as unknown as Record<string, unknown>}
                                        disabled={isCalculatingShipping || processingOrder}
                                        beforePay={checkCartStock}
                                        onPaid={(gatewayRef) => handleCreateOrder("stripe", "stripe", gatewayRef)}
                                        onError={setOrderError}
                                    />
                                )}
                                <PaymentMethodList
                                    total={total}
                                    methods={availableMethods}
                                    selected={codOnly ? (selectedPaymentMethod ?? "cod") : selectedPaymentMethod}
                                    onSelect={setSelectedPaymentMethod}
                                    variant="desktop"
                                />
                            </>
                        )}

                        {orderError && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{orderError}</div>}
                    </div>

                    <CheckoutCta
                        label={addresses.length === 0 ? "Add address" : orderNow ? "Order now" : "Proceed to pay"}
                        disabled={addresses.length === 0 ? false : ctaDisabled}
                        loading={processingOrder || isPaymentLoading}
                        onClick={() => {
                            if (addresses.length === 0) {
                                setEditingAddress(null);
                                setView("add-address");
                                return;
                            }
                            if (orderNow) {
                                handlePlaceOrder(null);
                                return;
                            }
                            if (codOnly) {
                                setSelectedPaymentMethod("cod");
                                setView("payment-methods");
                                return;
                            }
                            setView("payment-methods");
                        }}
                    />
                </div>

                <div className="hidden md:block w-[320px] lg:w-[400px] shrink-0">
                    <div className="sticky top-8 flex flex-col gap-4">
                        <PaymentSummaryCard
                            subtotal={cart.subtotal}
                            tax={cart.tax}
                            taxLabel={cart.taxLabel}
                            shipping={shippingDisplay}
                            shippingCalculating={isCalculatingShipping}
                            total={total}
                        />
                        <CheckoutCta
                            boxed
                            label={orderNow ? "Order now" : "Place order"}
                            disabled={desktopPlaceDisabled}
                            loading={processingOrder || isPaymentLoading}
                            onClick={() => {
                                if (addresses.length === 0) {
                                    setEditingAddress(null);
                                    setView("add-address");
                                    return;
                                }
                                handlePlaceOrder(codOnly ? selectedPaymentMethod ?? "cod" : selectedPaymentMethod);
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );

    const addressPanel = (
        <AddAddressPanel
            initial={editingAddress}
            saving={savingAddress}
            onBack={() => setView(editingAddress ? "select-address" : "checkout")}
            onSave={handleSaveAddress}
        />
    );

    const selectPanel = (
        <SelectAddressPanel
            addresses={addresses}
            selectedId={selectedAddress ? addressKey(selectedAddress) : null}
            onSelect={(address) => {
                setSelectedAddress(address);
                setView("checkout");
            }}
            onEdit={(address) => {
                setEditingAddress(address);
                setView("add-address");
            }}
            onDelete={(address) => setAddressToDelete(address.addressId)}
            onAdd={() => {
                setEditingAddress(null);
                setView("add-address");
            }}
            onBack={() => setView("checkout")}
            addressToDelete={addressToDelete}
            onConfirmDelete={handleConfirmDelete}
            onCancelDelete={() => setAddressToDelete(null)}
        />
    );

    const paymentPanel = (
        <>
            <CheckoutHeader title="Payment methods" onBack={() => setView("checkout")} />
            <PaymentMethodList
                total={total}
                methods={availableMethods}
                selected={selectedPaymentMethod}
                onSelect={async (method) => {
                    setSelectedPaymentMethod(method);
                    await handlePlaceOrder(method);
                }}
                variant="mobile"
            />
            {orderError && <div className="px-4 pb-4"><div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{orderError}</div></div>}
        </>
    );

    return (
        <>
            {checkoutMain}
            {view === "add-address" && renderPanel(addressPanel, false)}
            {view === "select-address" && renderPanel(selectPanel, false)}
            {view === "payment-methods" && renderPanel(paymentPanel, false)}
            {view === "add-address" && renderPanel(addressPanel, true)}
            {view === "select-address" && renderPanel(selectPanel, true)}
        </>
    );
}
