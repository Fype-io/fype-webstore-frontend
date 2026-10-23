import { describe, it, expect, vi, beforeEach } from "vitest";
import { getApi } from "@/lib/client-api";
import { setCurrentStoreId } from "@/lib/client-store-context";
import { reverseGeocode } from "../reverseGeocode";

vi.mock("@/lib/client-api", () => ({ getApi: vi.fn() }));

const DUBAI = {
    country: "AE", state: "Dubai", city: "Dubai", pincode: "", area: "Al Barsha 1",
    house: "Marina Tower", latitude: 25.1, longitude: 55.2,
};

beforeEach(() => {
    vi.mocked(getApi).mockReset();
    setCurrentStoreId("STORE-1");
});

describe("reverseGeocode", () => {
    it("asks the backend for the store, and returns its location", async () => {
        vi.mocked(getApi).mockResolvedValue({ data: { success: true, data: { location: DUBAI } } } as never);

        expect(await reverseGeocode(25.1, 55.2)).toEqual(DUBAI);
        expect(getApi).toHaveBeenCalledWith("/commerce/STORE-1/geo/reverse", { params: { lat: 25.1, lng: 55.2 } });
    });

    it("is null when the backend knows nothing there", async () => {
        vi.mocked(getApi).mockResolvedValue({ data: { success: true, data: { location: null } } } as never);

        expect(await reverseGeocode(0, 0)).toBeNull();
    });

    it("is null without a store, and makes no request", async () => {
        setCurrentStoreId(null);

        expect(await reverseGeocode(25.1, 55.2)).toBeNull();
        expect(getApi).not.toHaveBeenCalled();
    });

    it("never calls Google or OpenStreetMap from the browser", async () => {
        const fetchSpy = vi.fn();
        vi.stubGlobal("fetch", fetchSpy);
        vi.mocked(getApi).mockResolvedValue({ data: { data: { location: DUBAI } } } as never);

        await reverseGeocode(25.1, 55.2);

        expect(fetchSpy).not.toHaveBeenCalled();
        vi.unstubAllGlobals();
    });

    it("passes a failed request on (the panel shows its error)", async () => {
        vi.mocked(getApi).mockRejectedValue(new Error("Request failed with status code 429"));

        await expect(reverseGeocode(25.1, 55.2)).rejects.toThrow("429");
    });
});
