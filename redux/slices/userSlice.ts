import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import {
    getApi,
    postApi,
    putApi,
    deleteApi,
    setAuthToken,
    clearGuestId,
    clearAuthToken,
    setGuestId,
    getApiErrorMessage,
    markSignedOut,
    clearSignedOutSession,
} from "@/lib/client-api";
import type { ApiResponse } from "@/types/api";
import { trackShipment } from "@/lib/tracking-api";
import { orderErrorMessage } from "@/lib/checkout-errors";

// Trimmed port of the SPA's userSlice.ts — auth + cart + guest cart + wishlist
// + addresses. Orders/tracking are still deferred to when those specific
// account pages get built.

export interface User {
    customerId: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    isPhoneVerified: boolean;
    isEmailVerified: boolean;
    requiresRegistration?: boolean;
    isNew?: boolean;
}

export interface Address {
    _id?: string;
    addressId: string;
    firstName?: string;
    lastName?: string;
    phoneNumber: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    latitude?: number;
    longitude?: number;
    isDefault: boolean;
}

export interface CartItem {
    _id: string;
    productId: string;
    variantId?: string;
    name: string;
    image: string;
    price: number;
    compareAtPrice?: number;
    taxRate?: number;
    taxApplied?: boolean;
    quantity: number;
    options?: Record<string, string>;
    maxQuantity: number;
}

export interface Cart {
    _id: string;
    cartId: string;
    items: CartItem[];
    subtotal: number;
    totalCompareAtPrice?: number;
    tax: number;
    taxLabel?: string;
    shipping: number;
    discount?: number;
    total: number;
    itemCount: number;
}

export interface OrderItem {
    productId: string;
    variantId?: string;
    name: string;
    image: string;
    price: number;
    quantity: number;
    options?: Record<string, string>;
    subtotal: number;
}

export interface Shipment {
    status: "pending" | "shipped" | "in_transit" | "delivered" | "return_in_progress" | "returned" | "cancelled";
    awbNumber?: string;
    carrier?: string;
    provider?: string;
    items: OrderItem[];
}

export interface Order {
    orderId: string;
    orderNumber: string;
    status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
    items: OrderItem[];
    subtotal: number;
    tax: number;
    shipping: number;
    discount: number;
    total: number;
    /** Currency the order was placed in (orders from before PR1 have none). */
    currency?: string | null;
    paymentStatus: "pending" | "completed" | "paid" | "unpaid" | "cod" | "failed" | "refunded" | "partially_refunded";
    /** "manual" = placed with "Order now" (the store arranges payment); absent from older APIs. */
    paymentMethod?: string;
    totalRefunded?: number;
    cancellationReason?: string;
    trackingNumber?: string;
    shipmentProvider?: string;
    estimatedDelivery?: string;
    shipments?: Shipment[];
    createdAt: string;
}

export interface Pagination {
    page: number;
    limit: number;
    total: number;
    pages: number;
}

export interface TrackingEvent {
    status: string;
    location?: string;
    timestamp: string;
    description?: string;
}

export interface TrackingDetails {
    awbNumber: string;
    status: string;
    shipmentStatus?: string;
    currentLocation?: string;
    estimatedDelivery?: string;
    events: TrackingEvent[];
}

interface UserState {
    user: User | null;
    isAuthenticated: boolean;
    authLoading: boolean;
    authChecked: boolean;
    authError: string | null;

    cart: Cart | null;
    cartLoading: boolean;
    cartError: string | null;

    orders: Order[];
    ordersPagination: Pagination | null;
    currentOrder: Order | null;
    ordersLoading: boolean;
    ordersError: string | null;

    wishlist: string[];
    wishlistLoading: boolean;
    wishlistLoaded: boolean;
    wishlistError: string | null;

    addresses: Address[];
    addressesLoading: boolean;
    addressesError: string | null;

    trackingData: TrackingDetails | null;
    trackingLoading: boolean;
    trackingError: string | null;

    authChannels: string[];
}

const initialState: UserState = {
    user: null,
    isAuthenticated: false,
    authLoading: false,
    authChecked: false,
    authError: null,

    cart: null,
    cartLoading: false,
    cartError: null,

    orders: [],
    ordersPagination: null,
    currentOrder: null,
    ordersLoading: false,
    ordersError: null,

    wishlist: [],
    wishlistLoading: false,
    wishlistLoaded: false,
    wishlistError: null,

    addresses: [],
    addressesLoading: false,
    addressesError: null,

    trackingData: null,
    trackingLoading: false,
    trackingError: null,

    authChannels: ["email"],
};

// ===== AUTH THUNKS =====

export const getPlatform = createAsyncThunk(
    "user/getPlatform",
    async ({ storeId }: { storeId: string }, { rejectWithValue }) => {
        try {
            const response = await getApi<ApiResponse<{ channels: string[] }>>(`/customer/${storeId}/authentication/channel`);
            return response.data.data.channels ?? ["email"];
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to get platform"));
        }
    }
);

export const sendOTP = createAsyncThunk(
    "user/sendOTP",
    async (
        { storeId, phoneNumber, email, channel = "whatsapp" }: {
            storeId: string;
            phoneNumber?: string;
            email?: string;
            channel?: "whatsapp" | "sms" | "email";
        },
        { rejectWithValue }
    ) => {
        try {
            const payload: Record<string, string> = { channel };
            if (email) payload.email = email;
            if (phoneNumber) payload.phoneNumber = phoneNumber;

            const response = await postApi<
                ApiResponse<{ message?: string; expiresAt?: string; attemptsLeft?: number; retryAfter?: number }>
            >(`/customer/${storeId}/login/initiate`, payload);

            if (!response.data.success) {
                return rejectWithValue(response.data.message || "Failed to send OTP");
            }

            return response.data.data;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to send OTP"));
        }
    }
);

export const verifyOTP = createAsyncThunk(
    "user/verifyOTP",
    async (
        { storeId, phoneNumber, email, otp, channel = "whatsapp" }: {
            storeId: string;
            phoneNumber?: string;
            email?: string;
            otp: string;
            channel?: "whatsapp" | "sms" | "email";
        },
        { rejectWithValue }
    ) => {
        try {
            const payload: Record<string, string> = { otp, channel };
            if (email) payload.email = email;
            if (phoneNumber) payload.phoneNumber = phoneNumber;

            const response = await postApi<
                ApiResponse<{ customer: User; isNew: boolean; requiresRegistration: boolean; token?: string }>
            >(`/customer/${storeId}/login/verify`, payload, { withCredentials: true });

            if (!response.data.success) {
                return rejectWithValue(response.data.message || "Invalid OTP");
            }

            const { customer, isNew, requiresRegistration, token } = response.data.data;

            clearSignedOutSession();
            // Cross-origin (custom domain) clients get the token in the body;
            // same-origin clients get it via httpOnly cookie (absent here, safe no-op)
            if (token) {
                setAuthToken(token);
                // Mirror the token into the storefront's own httpOnly cookie so
                // Server Components can read the same identity (see lib/server-auth.ts).
                // Best-effort: client auth already succeeded above regardless of this call.
                fetch("/api/auth/verify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token }),
                }).catch(() => {});
            }

            // Guest cart is merged into the account on login — discard local guestId
            clearGuestId();

            return { customer, isNew, requiresRegistration };
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Invalid OTP"));
        }
    }
);

export const completeRegistration = createAsyncThunk(
    "user/completeRegistration",
    async (
        {
            storeId,
            registrationData,
        }: { storeId: string; registrationData: { firstName: string; lastName: string; email: string; phone?: string } },
        { rejectWithValue }
    ) => {
        try {
            const response = await postApi<ApiResponse<{ customer: User }>>(
                `/customer/${storeId}/complete-registration`,
                registrationData,
                { withCredentials: true }
            );

            if (!response.data.success) {
                return rejectWithValue(response.data.message || "Failed to complete registration");
            }

            return response.data.data.customer;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to complete registration"));
        }
    }
);

export const resendOTP = createAsyncThunk(
    "user/resendOTP",
    async (
        {
            storeId,
            countryCode,
            phoneNumber,
            channel = "whatsapp",
        }: { storeId: string; countryCode: string; phoneNumber: string; channel?: "whatsapp" | "sms" | "email" },
        { rejectWithValue }
    ) => {
        try {
            const response = await postApi<
                ApiResponse<{ success: boolean; message?: string; expiresAt?: string; attemptsLeft?: number; retryAfter?: number }>
            >(`/customer/${storeId}/login/resend`, { countryCode, phoneNumber: `${countryCode}${phoneNumber}`, channel });

            if (!response.data.data.success) {
                return rejectWithValue(response.data.data.message || "Failed to resend OTP");
            }

            return response.data.data;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to resend OTP"));
        }
    }
);

export const logout = createAsyncThunk("user/logout", async ({ storeId }: { storeId: string }) => {
    try {
        // Must still be authenticated so the API can clear its customer_token cookie.
        await postApi(`/customer/${storeId}/logout`, {}, { withCredentials: true });
    } catch {
        // Local session is cleared below regardless.
    }
    markSignedOut();
    clearAuthToken();
    clearGuestId();
    try {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
        // Storefront cookie clear is best-effort.
    }
    return null;
});

export const fetchUserProfile = createAsyncThunk(
    "user/fetchProfile",
    async ({ storeId }: { storeId: string }, { rejectWithValue }) => {
        try {
            const response = await getApi<ApiResponse<{ customer: User }>>(`/customer/${storeId}/profile`, {
                withCredentials: true,
            });
            return response.data.data.customer;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to fetch profile"));
        }
    }
);

export const updateUserProfile = createAsyncThunk(
    "user/updateProfile",
    async ({ storeId, data }: { storeId: string; data: Partial<User> }, { rejectWithValue }) => {
        try {
            const response = await putApi<ApiResponse<{ customer: User }>>(`/customer/${storeId}/profile`, data, {
                withCredentials: true,
            });
            return response.data.data.customer;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to update profile"));
        }
    }
);

// ===== CART THUNKS =====

export const fetchCart = createAsyncThunk(
    "user/fetchCart",
    async ({ storeId }: { storeId: string }, { rejectWithValue }) => {
        try {
            const response = await getApi<ApiResponse<{ cart: Cart }>>(`/commerce/cart/${storeId}`, { withCredentials: true });
            return response.data.data.cart;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to fetch cart"));
        }
    }
);

export const addToCart = createAsyncThunk(
    "user/addToCart",
    async (
        { storeId, productId, variantId, quantity }: { storeId: string; productId: string; variantId?: string; quantity: number },
        { rejectWithValue }
    ) => {
        try {
            const response = await postApi<ApiResponse<{ cart: Cart }>>(
                `/commerce/cart/${storeId}/add`,
                { productId, variantId, quantity },
                { withCredentials: true }
            );
            return response.data.data.cart;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to add to cart"));
        }
    }
);

export const updateCartItem = createAsyncThunk(
    "user/updateCartItem",
    async (
        { storeId, itemId, variantId, quantity }: { storeId: string; itemId: string; variantId?: string; quantity: number },
        { rejectWithValue }
    ) => {
        try {
            const response = await putApi<ApiResponse<{ cart: Cart }>>(
                `/commerce/cart/${storeId}/update/${itemId}`,
                { quantity, variantId },
                { withCredentials: true }
            );
            return response.data.data.cart;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to update cart"));
        }
    }
);

export const removeFromCart = createAsyncThunk(
    "user/removeFromCart",
    async ({ storeId, itemId, variantId }: { storeId: string; itemId: string; variantId?: string }, { rejectWithValue }) => {
        try {
            const response = await deleteApi<ApiResponse<{ cart: Cart }>>(`/commerce/cart/${storeId}/remove/${itemId}`, {
                withCredentials: true,
                params: variantId ? { variantId } : undefined,
            });
            return response.data.data.cart;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to remove from cart"));
        }
    }
);

export const clearCart = createAsyncThunk(
    "user/clearCart",
    async ({ storeId }: { storeId: string }, { rejectWithValue }) => {
        try {
            await deleteApi(`/commerce/cart/${storeId}/clear`, { withCredentials: true });
            return null;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to clear cart"));
        }
    }
);

// ===== GUEST CART THUNKS =====

export const fetchGuestCart = createAsyncThunk(
    "user/fetchGuestCart",
    async ({ storeId }: { storeId: string }, { rejectWithValue }) => {
        try {
            const response = await getApi<ApiResponse<{ cart: Cart & { guestId: string } }>>(`/commerce/cart/guest/${storeId}`);
            if (response.data.data.cart.guestId) setGuestId(response.data.data.cart.guestId);
            return response.data.data.cart;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to fetch guest cart"));
        }
    }
);

export const addToGuestCart = createAsyncThunk(
    "user/addToGuestCart",
    async (
        { storeId, productId, variantId, quantity }: { storeId: string; productId: string; variantId?: string; quantity: number },
        { rejectWithValue }
    ) => {
        try {
            const response = await postApi<ApiResponse<{ cart: Cart & { guestId: string } }>>(`/commerce/cart/guest/${storeId}/add`, {
                productId,
                variantId,
                quantity,
            });
            if (response.data.data.cart.guestId) setGuestId(response.data.data.cart.guestId);
            return response.data.data.cart;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to add to guest cart"));
        }
    }
);

export const updateGuestCartItem = createAsyncThunk(
    "user/updateGuestCartItem",
    async (
        { storeId, itemId, variantId, quantity }: { storeId: string; itemId: string; variantId?: string; quantity: number },
        { rejectWithValue }
    ) => {
        try {
            const response = await putApi<ApiResponse<{ cart: Cart & { guestId: string } }>>(
                `/commerce/cart/guest/${storeId}/update/${itemId}`,
                { quantity, variantId }
            );
            if (response.data.data.cart.guestId) setGuestId(response.data.data.cart.guestId);
            return response.data.data.cart;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to update guest cart"));
        }
    }
);

export const removeFromGuestCart = createAsyncThunk(
    "user/removeFromGuestCart",
    async ({ storeId, itemId, variantId }: { storeId: string; itemId: string; variantId?: string }, { rejectWithValue }) => {
        try {
            const response = await deleteApi<ApiResponse<{ cart: Cart & { guestId: string } }>>(
                `/commerce/cart/guest/${storeId}/remove/${itemId}`,
                { params: variantId ? { variantId } : undefined }
            );
            if (response.data.data.cart.guestId) setGuestId(response.data.data.cart.guestId);
            return response.data.data.cart;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to remove from guest cart"));
        }
    }
);

export const clearGuestCart = createAsyncThunk(
    "user/clearGuestCart",
    async ({ storeId }: { storeId: string }, { rejectWithValue }) => {
        try {
            await deleteApi(`/commerce/cart/guest/${storeId}/clear`);
            clearGuestId();
            return null;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to clear guest cart"));
        }
    }
);

// ===== WISHLIST THUNKS =====

export const fetchWishlist = createAsyncThunk(
    "user/fetchWishlist",
    async ({ storeId }: { storeId: string }, { rejectWithValue }) => {
        try {
            const response = await getApi<ApiResponse<{ productIds: string[] }>>(`/commerce/${storeId}/wishlist`, {
                withCredentials: true,
            });
            return response.data.data.productIds;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to fetch wishlist"));
        }
    }
);

export const addToWishlist = createAsyncThunk(
    "user/addToWishlist",
    async ({ storeId, productId }: { storeId: string; productId: string }, { rejectWithValue }) => {
        try {
            await postApi(`/commerce/${storeId}/wishlist/add`, { productId }, { withCredentials: true });
            return productId;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to add to wishlist"));
        }
    }
);

export const removeFromWishlist = createAsyncThunk(
    "user/removeFromWishlist",
    async ({ storeId, productId }: { storeId: string; productId: string }, { rejectWithValue }) => {
        try {
            await deleteApi(`/commerce/${storeId}/wishlist/remove/${productId}`, { withCredentials: true });
            return productId;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to remove from wishlist"));
        }
    }
);

// ===== ADDRESS THUNKS =====

export const fetchAddresses = createAsyncThunk(
    "user/fetchAddresses",
    async ({ storeId }: { storeId: string }, { rejectWithValue }) => {
        try {
            const response = await getApi<ApiResponse<{ addresses: Address[] }>>(`/customer/${storeId}/addresses`, {
                withCredentials: true,
            });
            return response.data.data.addresses;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to fetch addresses"));
        }
    }
);

export const addAddress = createAsyncThunk(
    "user/addAddress",
    async ({ storeId, address }: { storeId: string; address: Omit<Address, "_id" | "addressId"> }, { rejectWithValue }) => {
        try {
            const response = await postApi<ApiResponse<{ address: Address }>>(`/customer/${storeId}/addresses`, address, {
                withCredentials: true,
            });
            return response.data.data.address;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to add address"));
        }
    }
);

export const updateAddress = createAsyncThunk(
    "user/updateAddress",
    async (
        { storeId, addressId, address }: { storeId: string; addressId: string; address: Partial<Address> },
        { rejectWithValue }
    ) => {
        try {
            const response = await putApi<ApiResponse<{ address: Address }>>(`/customer/${storeId}/addresses/${addressId}`, address, {
                withCredentials: true,
            });
            return response.data.data.address;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to update address"));
        }
    }
);

export const deleteAddress = createAsyncThunk(
    "user/deleteAddress",
    async ({ storeId, addressId }: { storeId: string; addressId: string }, { rejectWithValue }) => {
        try {
            await deleteApi(`/customer/${storeId}/addresses/${addressId}`, { withCredentials: true });
            return addressId;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to delete address"));
        }
    }
);

// ===== ORDER THUNKS =====

// Generalized from the old hardcoded razorpay_order_id/payment_id/signature
// fields to the generic gateway/gatewayRef shape crmApp's OrderController.createOrder
// now accepts additively (see order.controller.ts's new `gateway && gatewayRef`
// branch) - matches CheckoutGatewayAdapter.open()'s GatewayOpenResult.gatewayRef
// shape exactly. The old razorpay_* fields are no longer sent by this frontend;
// the backend's old inline-HMAC path is preserved purely for any other/older caller.
interface CreateOrderRequest {
    items: CartItem[];
    shippingAddress: Address;
    billingAddress?: Address;
    paymentMethod: string; // 'manual' | 'cod' | a registered gateway key (e.g. 'razorpay' | 'stripe')
    gateway?: string;
    gatewayRef?: Record<string, unknown>;
    customerNotes?: string;
    subtotal?: number;
    tax?: number;
    shipping?: number;
    total?: number;
    estimatedDelivery?: string | null;
}

export const createOrder = createAsyncThunk(
    "user/createOrder",
    async ({ storeId, orderData }: { storeId: string; orderData: CreateOrderRequest }, { rejectWithValue }) => {
        try {
            const response = await postApi<ApiResponse<{ order: Order }>>(`/commerce/${storeId}/orders`, orderData, {
                withCredentials: true,
            });

            if (!response.data.success) {
                return rejectWithValue(response.data.message || "Failed to create order");
            }

            return response.data.data.order;
        } catch (error: unknown) {
            // Payment-option errors (COD needs a logistics app, "Order now" not
            // available) say to refresh - see lib/checkout-errors.ts.
            return rejectWithValue(orderErrorMessage(error, "Failed to create order"));
        }
    }
);

export const fetchOrders = createAsyncThunk(
    "user/fetchOrders",
    async ({ storeId, page = 1, limit = 10 }: { storeId: string; page?: number; limit?: number }, { rejectWithValue }) => {
        try {
            const response = await getApi<ApiResponse<{ orders: Order[]; pagination: Pagination }>>(
                `/commerce/${storeId}/orders?page=${page}&limit=${limit}`,
                { withCredentials: true }
            );
            return response.data.data;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to fetch orders"));
        }
    }
);

export const fetchOrderById = createAsyncThunk(
    "user/fetchOrderById",
    async ({ storeId, orderId }: { storeId: string; orderId: string }, { rejectWithValue }) => {
        try {
            const response = await getApi<ApiResponse<{ order: Order }>>(`/commerce/${storeId}/orders/${orderId}`, {
                withCredentials: true,
            });
            return response.data.data.order;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to fetch order"));
        }
    }
);

export const cancelOrder = createAsyncThunk(
    "user/cancelOrder",
    async ({ storeId, orderId, reason }: { storeId: string; orderId: string; reason: string }, { rejectWithValue }) => {
        try {
            const response = await postApi<ApiResponse<{ order: Order }>>(
                `/commerce/${storeId}/orders/${orderId}/cancel`,
                { reason },
                { withCredentials: true }
            );
            return response.data.data.order;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to cancel order"));
        }
    }
);

// ===== TRACKING THUNK =====

export const fetchTrackingDetails = createAsyncThunk(
    "user/fetchTrackingDetails",
    async ({ storeId, awbNumber, provider = "dtdc" }: { storeId: string; awbNumber: string; provider?: string }, { rejectWithValue }) => {
        try {
            const trackingDetails = await trackShipment(storeId, awbNumber, provider);
            return trackingDetails;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to fetch tracking details"));
        }
    }
);

// ===== SLICE =====

const userSlice = createSlice({
    name: "user",
    initialState,
    reducers: {
        clearAuthError: (state) => {
            state.authError = null;
        },
        clearCartError: (state) => {
            state.cartError = null;
        },
        clearOrdersError: (state) => {
            state.ordersError = null;
        },
        clearTrackingError: (state) => {
            state.trackingError = null;
        },
        setUser: (state, action: PayloadAction<User | null>) => {
            state.user = action.payload;
            state.isAuthenticated = !!action.payload;
        },
        markAuthChecked: (state) => {
            state.authChecked = true;
            state.authLoading = false;
        },
    },
    extraReducers: (builder) => {
        // Get Platform
        builder
            .addCase(getPlatform.pending, (state) => {
                state.authLoading = true;
                state.authError = null;
            })
            .addCase(getPlatform.fulfilled, (state, action) => {
                state.authLoading = false;
                state.authChannels = action.payload;
            })
            .addCase(getPlatform.rejected, (state, action) => {
                state.authLoading = false;
                state.authError = action.payload as string;
            });

        // Send OTP
        builder
            .addCase(sendOTP.pending, (state) => {
                state.authLoading = true;
                state.authError = null;
            })
            .addCase(sendOTP.fulfilled, (state) => {
                state.authLoading = false;
            })
            .addCase(sendOTP.rejected, (state, action) => {
                state.authLoading = false;
                state.authError = action.payload as string;
            });

        // Resend OTP
        builder
            .addCase(resendOTP.pending, (state) => {
                state.authLoading = true;
                state.authError = null;
            })
            .addCase(resendOTP.fulfilled, (state) => {
                state.authLoading = false;
            })
            .addCase(resendOTP.rejected, (state, action) => {
                state.authLoading = false;
                state.authError = action.payload as string;
            });

        // Verify OTP
        builder
            .addCase(verifyOTP.pending, (state) => {
                state.authLoading = true;
                state.authError = null;
            })
            .addCase(verifyOTP.fulfilled, (state, action) => {
                state.authLoading = false;
                state.authChecked = true;
                state.user = {
                    ...action.payload.customer,
                    requiresRegistration: action.payload.requiresRegistration,
                    isNew: action.payload.isNew,
                };
                state.isAuthenticated = true;
            })
            .addCase(verifyOTP.rejected, (state, action) => {
                state.authLoading = false;
                state.authError = action.payload as string;
            });

        // Complete Registration
        builder
            .addCase(completeRegistration.pending, (state) => {
                state.authLoading = true;
                state.authError = null;
            })
            .addCase(completeRegistration.fulfilled, (state, action) => {
                state.authLoading = false;
                state.user = action.payload;
                if (state.user) {
                    state.user.requiresRegistration = false;
                    state.user.isNew = false;
                }
            })
            .addCase(completeRegistration.rejected, (state, action) => {
                state.authLoading = false;
                state.authError = action.payload as string;
            });

        // Logout
        const clearSession = (state: UserState) => {
            state.user = null;
            state.isAuthenticated = false;
            state.authLoading = false;
            state.authChecked = true;
            state.cart = null;
            state.wishlist = [];
            state.wishlistLoaded = false;
            state.addresses = [];
            state.orders = [];
        };
        builder.addCase(logout.pending, clearSession);
        builder.addCase(logout.fulfilled, clearSession);
        builder.addCase(logout.rejected, clearSession);

        // Fetch Profile
        builder
            .addCase(fetchUserProfile.pending, (state) => {
                state.authLoading = true;
            })
            .addCase(fetchUserProfile.fulfilled, (state, action) => {
                state.authLoading = false;
                state.authChecked = true;
                state.user = action.payload;
                state.isAuthenticated = true;
            })
            .addCase(fetchUserProfile.rejected, (state) => {
                state.authLoading = false;
                state.authChecked = true;
                state.isAuthenticated = false;
                state.user = null;
            });

        // Update Profile
        builder
            .addCase(updateUserProfile.pending, (state) => {
                state.authLoading = true;
            })
            .addCase(updateUserProfile.fulfilled, (state, action) => {
                state.authLoading = false;
                state.user = action.payload;
            })
            .addCase(updateUserProfile.rejected, (state, action) => {
                state.authLoading = false;
                state.authError = action.payload as string;
            });

        // Cart
        builder
            .addCase(fetchCart.pending, (state) => {
                state.cartLoading = true;
                state.cartError = null;
            })
            .addCase(fetchCart.fulfilled, (state, action) => {
                state.cartLoading = false;
                state.cart = action.payload;
            })
            .addCase(fetchCart.rejected, (state, action) => {
                state.cartLoading = false;
                state.cartError = action.payload as string;
            });

        builder
            .addCase(addToCart.pending, (state) => {
                state.cartLoading = true;
            })
            .addCase(addToCart.fulfilled, (state, action) => {
                state.cartLoading = false;
                state.cart = action.payload;
            })
            .addCase(addToCart.rejected, (state, action) => {
                state.cartLoading = false;
                state.cartError = action.payload as string;
            });

        builder
            .addCase(updateCartItem.fulfilled, (state, action) => {
                state.cart = action.payload;
            })
            .addCase(updateCartItem.rejected, (state, action) => {
                state.cartError = action.payload as string;
            });

        builder
            .addCase(removeFromCart.fulfilled, (state, action) => {
                state.cart = action.payload;
            })
            .addCase(removeFromCart.rejected, (state, action) => {
                state.cartError = action.payload as string;
            });

        builder.addCase(clearCart.fulfilled, (state) => {
            state.cart = null;
        });

        // Guest Cart
        builder
            .addCase(fetchGuestCart.pending, (state) => {
                state.cartLoading = true;
                state.cartError = null;
            })
            .addCase(fetchGuestCart.fulfilled, (state, action) => {
                state.cartLoading = false;
                state.cart = action.payload;
            })
            .addCase(fetchGuestCart.rejected, (state, action) => {
                state.cartLoading = false;
                state.cartError = action.payload as string;
            });

        builder
            .addCase(addToGuestCart.pending, (state) => {
                state.cartLoading = true;
            })
            .addCase(addToGuestCart.fulfilled, (state, action) => {
                state.cartLoading = false;
                state.cart = action.payload;
            })
            .addCase(addToGuestCart.rejected, (state, action) => {
                state.cartLoading = false;
                state.cartError = action.payload as string;
            });

        builder
            .addCase(updateGuestCartItem.fulfilled, (state, action) => {
                state.cart = action.payload;
            })
            .addCase(updateGuestCartItem.rejected, (state, action) => {
                state.cartError = action.payload as string;
            });

        builder
            .addCase(removeFromGuestCart.fulfilled, (state, action) => {
                state.cart = action.payload;
            })
            .addCase(removeFromGuestCart.rejected, (state, action) => {
                state.cartError = action.payload as string;
            });

        builder.addCase(clearGuestCart.fulfilled, (state) => {
            state.cart = null;
        });

        // Wishlist
        builder
            .addCase(fetchWishlist.pending, (state) => {
                state.wishlistLoading = true;
            })
            .addCase(fetchWishlist.fulfilled, (state, action) => {
                state.wishlistLoading = false;
                state.wishlist = action.payload;
                state.wishlistLoaded = true;
            })
            .addCase(fetchWishlist.rejected, (state, action) => {
                state.wishlistLoading = false;
                state.wishlistError = action.payload as string;
                state.wishlistLoaded = true;
            });

        builder.addCase(addToWishlist.fulfilled, (state, action) => {
            if (!state.wishlist.includes(action.payload)) state.wishlist.push(action.payload);
        });

        builder.addCase(removeFromWishlist.fulfilled, (state, action) => {
            state.wishlist = state.wishlist.filter((id) => id !== action.payload);
        });

        // Addresses
        builder
            .addCase(fetchAddresses.pending, (state) => {
                state.addressesLoading = true;
                state.addressesError = null;
            })
            .addCase(fetchAddresses.fulfilled, (state, action) => {
                state.addressesLoading = false;
                state.addresses = action.payload;
            })
            .addCase(fetchAddresses.rejected, (state, action) => {
                state.addressesLoading = false;
                state.addressesError = action.payload as string;
            });

        builder.addCase(addAddress.fulfilled, (state, action) => {
            state.addresses.push(action.payload);
        });

        builder.addCase(updateAddress.fulfilled, (state, action) => {
            const index = state.addresses.findIndex(
                (a) => (action.payload._id && a._id === action.payload._id) || (action.payload.addressId && a.addressId === action.payload.addressId)
            );
            if (index !== -1) state.addresses[index] = action.payload;
        });

        builder.addCase(deleteAddress.fulfilled, (state, action) => {
            state.addresses = state.addresses.filter((a) => a.addressId !== action.payload);
        });

        // Orders
        builder.addCase(createOrder.fulfilled, (state, action) => {
            state.currentOrder = action.payload;
        });

        builder
            .addCase(fetchOrders.pending, (state) => {
                state.ordersLoading = true;
                state.ordersError = null;
            })
            .addCase(fetchOrders.fulfilled, (state, action) => {
                state.ordersLoading = false;
                state.orders = action.payload.orders;
                state.ordersPagination = action.payload.pagination;
            })
            .addCase(fetchOrders.rejected, (state, action) => {
                state.ordersLoading = false;
                state.ordersError = action.payload as string;
            });

        builder
            .addCase(fetchOrderById.pending, (state) => {
                state.ordersLoading = true;
            })
            .addCase(fetchOrderById.fulfilled, (state, action) => {
                state.ordersLoading = false;
                state.currentOrder = action.payload;
            })
            .addCase(fetchOrderById.rejected, (state, action) => {
                state.ordersLoading = false;
                state.ordersError = action.payload as string;
            });

        builder.addCase(cancelOrder.fulfilled, (state, action) => {
            state.currentOrder = action.payload;
            const index = state.orders.findIndex((o) => o.orderId === action.payload.orderId);
            if (index !== -1) state.orders[index] = action.payload;
        });

        // Tracking
        builder
            .addCase(fetchTrackingDetails.pending, (state) => {
                state.trackingLoading = true;
                state.trackingError = null;
            })
            .addCase(fetchTrackingDetails.fulfilled, (state, action) => {
                state.trackingLoading = false;
                state.trackingData = action.payload;
            })
            .addCase(fetchTrackingDetails.rejected, (state, action) => {
                state.trackingLoading = false;
                state.trackingError = action.payload as string;
            });
    },
});

export const { clearAuthError, clearCartError, clearOrdersError, clearTrackingError, setUser, markAuthChecked } = userSlice.actions;
export default userSlice.reducer;
