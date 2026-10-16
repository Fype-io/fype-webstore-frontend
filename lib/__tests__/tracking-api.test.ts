import { describe, it, expect, vi, beforeEach } from "vitest";
import { trackShipment } from "@/lib/tracking-api";
import { getApi } from "@/lib/client-api";

vi.mock("@/lib/client-api", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/client-api")>();
    return { ...actual, getApi: vi.fn() };
});

// A manual order has no AWB, so Track sends the order number, which starts with "#"
// by default. Unencoded, "#1000" cut the path at the fragment and hit /orders/.

const MANUAL_ORDER = { orderId: "o-1", orderNumber: "#1000", status: "pending", trackingNumber: "", carrier: "", estimatedDelivery: "", provider: "manual", trackingEvents: [] };

describe("trackShipment", () => {
    beforeEach(() => {
        vi.mocked(getApi).mockReset();
        vi.mocked(getApi).mockResolvedValue({
            data: { success: true, data: { order: MANUAL_ORDER, tracking: null } },
        } as unknown as Awaited<ReturnType<typeof getApi>>);
    });

    it("encodes a #-prefixed order number in the path", async () => {
        await trackShipment("store-1", "#1000", "manual");

        expect(getApi).toHaveBeenCalledWith("/commerce/store-1/orders/%231000/track?provider=manual", { withCredentials: true });
    });

    it("leaves an AWB number unchanged", async () => {
        await trackShipment("store-1", "7X1234567", "dtdc");

        expect(getApi).toHaveBeenCalledWith("/commerce/store-1/orders/7X1234567/track?provider=dtdc", { withCredentials: true });
    });

    it("omits the provider query when none is given", async () => {
        await trackShipment("store-1", "#1000");

        expect(getApi).toHaveBeenCalledWith("/commerce/store-1/orders/%231000/track", { withCredentials: true });
    });
});
