import { getApi } from "@/lib/client-api";
import { getCurrentStoreId } from "@/lib/client-store-context";

// City / area suggestions for the address form, from the backend (GET
// /commerce/:storeId/geo/suggest, Google Places with the server's key).
// available false (no key on the server, Google failing, or no store yet) means
// the field takes free text.

export interface PlaceSuggestion {
    name: string;
    /** Where it is ("Kochi, Kerala, India"). */
    secondary: string;
    placeId: string;
}

export interface PlaceSuggestResult {
    available: boolean;
    suggestions: PlaceSuggestion[];
}

export interface PlaceSuggestQuery {
    kind: "city" | "area";
    /** ISO country code ("IN"). */
    country: string;
    /** The state's ISO code ("KL"). */
    state?: string;
    /** For an area: the city it's in. */
    city?: string;
    /** What was typed; empty asks only whether suggestions are on. */
    q?: string;
}

const UNAVAILABLE: PlaceSuggestResult = { available: false, suggestions: [] };

/** Throws when the request fails. */
export async function suggestPlaces(query: PlaceSuggestQuery): Promise<PlaceSuggestResult> {
    const storeId = getCurrentStoreId();
    if (!storeId || !query.country) return UNAVAILABLE;
    const params: Record<string, string> = { kind: query.kind, country: query.country };
    if (query.state) params.state = query.state;
    if (query.city) params.city = query.city;
    if (query.q) params.q = query.q;
    const response = await getApi<{ data?: Partial<PlaceSuggestResult> }>(`/commerce/${storeId}/geo/suggest`, { params });
    const data = response.data?.data;
    if (!data) return UNAVAILABLE;
    return { available: data.available === true, suggestions: Array.isArray(data.suggestions) ? data.suggestions : [] };
}
