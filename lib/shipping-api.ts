import { getApiErrorMessage, postApi } from "./client-api";
import type { ApiResponse } from "@/types/api";
import type { CartItem } from "@/redux/slices/userSlice";

export interface CalculateShippingRateResponse {
    serviceable: boolean;
    deliveryCharge: number | null;
    /** Tax on the delivery charge (0 unless the store charges tax on shipping); absent from an older API. */
    shippingTax?: number;
    estimatedDays: string | null;
    reason?: string;
    source: "cache" | "api";
}

export async function checkPincodeServiceability(
    storeId: string,
    pincode: string
): Promise<{ serviceable: boolean; city?: string; state?: string }> {
    try {
        const response = await postApi<ApiResponse<{ serviceable: boolean; pincode: string }>>(`/commerce/${storeId}/orders/check-pincode`, {
            pincode,
        });

        if (response.data.success && response.data.data?.serviceable) {
            try {
                const postalResponse = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
                const postalData = (await postalResponse.json()) as Array<{
                    Status: string;
                    PostOffice?: Array<{ District: string; State: string }>;
                }>;

                if (postalData[0]?.Status === "Success" && postalData[0].PostOffice?.[0]) {
                    const postOffice = postalData[0].PostOffice[0];
                    return { serviceable: true, city: postOffice.District, state: postOffice.State };
                }
            } catch {
                // Postal lookup is best-effort auto-fill only — serviceability itself already succeeded above
            }

            return { serviceable: true };
        }

        return { serviceable: false };
    } catch {
        return { serviceable: false };
    }
}

/** Where a city-based courier (Jeebly) delivers: the address's city, state (emirate) and country. */
export interface ShippingDestination {
    city?: string;
    state?: string;
    country?: string;
}

export async function calculateShippingRate(
    storeId: string,
    destinationPincode: string,
    items: CartItem[],
    provider?: string,
    destination?: ShippingDestination
): Promise<CalculateShippingRateResponse | null> {
    try {
        const itemsPayload = items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
        }));

        const response = await postApi<CalculateShippingRateResponse>(
            `/commerce/${storeId}/orders/calculate-rate`,
            {
                destinationPincode,
                items: itemsPayload,
                ...(provider ? { provider } : {}),
                ...(destination ? { destination } : {}),
            },
            { withCredentials: true }
        );

        if (response.data && typeof response.data.serviceable !== "undefined") {
            return response.data;
        }

        return null;
    } catch (error: unknown) {
        console.error("[Shipping] Rate calculation failed:", getApiErrorMessage(error, "unknown error"));
        return {
            serviceable: false,
            deliveryCharge: null,
            estimatedDays: null,
            reason: "rate_api_failed",
            source: "api",
        };
    }
}

export async function getExpectedTAT(
    storeId: string,
    destinationPincode: string
): Promise<{ success: boolean; tatDays?: number; deliveryDate?: string; mode?: string; error?: string }> {
    try {
        const response = await postApi<
            ApiResponse<{ success: boolean; tatDays?: number; deliveryDate?: string; mode?: string; error?: string }>
        >(`/commerce/${storeId}/orders/expected-tat`, { destinationPincode });

        if (response.data.success && response.data.data) {
            return response.data.data;
        }

        return { success: false, error: response.data.message || "Failed to fetch TAT" };
    } catch (error: unknown) {
        return { success: false, error: getApiErrorMessage(error, "TAT fetch failed") };
    }
}
