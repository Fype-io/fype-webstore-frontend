import { getApi } from "./client-api";
import { orderSegment } from "./order-url";
import type { ApiResponse } from "@/types/api";
import type { TrackingDetails, TrackingEvent } from "@/redux/slices/userSlice";

interface TrackOrderResponse {
    order: {
        orderId: string;
        orderNumber: string;
        status: string;
        trackingNumber: string;
        carrier: string;
        estimatedDelivery: string;
        provider: string;
        trackingEvents?: Array<{ action: string; location?: string; timestamp?: string; remarks?: string }>;
    };
    tracking: {
        currentLocation?: string;
        events?: TrackingEvent[];
        ShipmentData?: Array<{
            Shipment?: {
                Status?: { StatusLocation?: string };
                Scans?: Array<{
                    ScanDetail: {
                        Scan: string;
                        ScannedLocation?: string;
                        ScanDateTime?: string;
                        StatusDateTime?: string;
                        Instructions?: string;
                    };
                }>;
            };
        }>;
    } | null;
}

export async function trackShipment(storeId: string, orderId: string, provider?: string): Promise<TrackingDetails | null> {
    try {
        const response = await getApi<ApiResponse<TrackOrderResponse>>(
            `/commerce/${storeId}/orders/${orderSegment(orderId)}/track${provider ? `?provider=${encodeURIComponent(provider)}` : ""}`,
            { withCredentials: true }
        );

        if (!response.data.success || !response.data.data) return null;

        const { order, tracking } = response.data.data;
        if (!order) return null;

        let events: TrackingEvent[] = [];

        if (order.trackingEvents && Array.isArray(order.trackingEvents)) {
            // Manual provider: status change events from order history
            events = order.trackingEvents.map((e) => ({
                status: e.action,
                location: e.location,
                timestamp: e.timestamp || new Date().toISOString(),
                description: e.remarks,
            }));
        } else if (tracking?.ShipmentData && Array.isArray(tracking.ShipmentData)) {
            // Delhivery structure
            const shipment = tracking.ShipmentData[0]?.Shipment;
            if (shipment?.Scans && Array.isArray(shipment.Scans)) {
                events = shipment.Scans.map((scan) => ({
                    status: scan.ScanDetail.Scan,
                    location: scan.ScanDetail.ScannedLocation,
                    timestamp: scan.ScanDetail.ScanDateTime || scan.ScanDetail.StatusDateTime || new Date().toISOString(),
                    description: scan.ScanDetail.Instructions,
                }));
            }
        } else if (tracking?.events && Array.isArray(tracking.events)) {
            // Standard/DTDC structure (fallback)
            events = tracking.events;
        }

        return {
            awbNumber: order.trackingNumber,
            status: order.status,
            currentLocation: tracking?.currentLocation || tracking?.ShipmentData?.[0]?.Shipment?.Status?.StatusLocation,
            estimatedDelivery: order.estimatedDelivery?.toString(),
            events,
        };
    } catch (error) {
        console.error("Failed to track shipment:", error);
        throw error;
    }
}
