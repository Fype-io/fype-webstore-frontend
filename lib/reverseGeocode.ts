import { getApi } from "@/lib/client-api";
import { getCurrentStoreId } from "@/lib/client-store-context";

// "Use current location": the address at the shopper's position, from the backend
// (GET /commerce/:storeId/geo/reverse), which holds the Google key and falls back to
// OpenStreetMap. The browser never calls Google or OpenStreetMap itself.

export interface ReverseGeocodeResult {
    country: string;
    state: string;
    city: string;
    pincode: string;
    area: string;
    house: string;
    latitude: number;
    longitude: number;
}

/** Null when there's no store yet or nothing is known at that point; throws when the request fails. */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
    const storeId = getCurrentStoreId();
    if (!storeId) return null;
    const response = await getApi<{ data?: { location?: ReverseGeocodeResult | null } }>(`/commerce/${storeId}/geo/reverse`, {
        params: { lat, lng },
    });
    return response.data?.data?.location ?? null;
}
