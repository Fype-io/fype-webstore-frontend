"use client";

import { useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { fetchTrackingDetails, clearTrackingError } from "@/redux/slices/userSlice";
import { orderStatusLabel, trackingProgress, TRACKING_STEPS, type OrderStatusTone } from "@/lib/order-status";

const END_CARD_COLOR: Record<OrderStatusTone, string> = {
    danger: "bg-red-50 border-red-100 text-red-700",
    refund: "bg-orange-50 border-orange-100 text-orange-700",
    warning: "bg-yellow-50 border-yellow-100 text-yellow-700",
    neutral: "bg-gray-50 border-gray-200 text-gray-700",
    success: "bg-green-50 border-green-100 text-green-700",
    info: "bg-blue-50 border-blue-100 text-blue-700",
};

/**
 * What the popup shows under "Current Status". With no AWB (manual orders, or not
 * dispatched yet) it tracks by the order number, which already carries the store's
 * prefix (#1000) - adding another "#" showed "##1000".
 */
export function trackingReference(trackingNumber: string, isOrderNumber: boolean): { text: string; label: string } {
    return isOrderNumber ? { text: trackingNumber, label: "Order Number" } : { text: `#${trackingNumber}`, label: "AWB Number" };
}

interface OrderTrackingProps {
    storeId: string;
    trackingNumber: string;
    /** True when trackingNumber is the order number (no AWB yet), not an AWB. */
    isOrderNumber?: boolean;
    provider?: string;
    orderStatus?: string;
    onClose: () => void;
}

export default function OrderTracking({ storeId, trackingNumber, isOrderNumber = false, provider, orderStatus, onClose }: OrderTrackingProps) {
    const dispatch = useAppDispatch();
    const { trackingData, trackingLoading, trackingError } = useAppSelector((state) => state.user);

    useEffect(() => {
        document.body.style.overflow = "hidden";
        if (trackingNumber && storeId) {
            dispatch(fetchTrackingDetails({ storeId, awbNumber: trackingNumber, provider: provider?.toLowerCase() || "dtdc" }));
        }
        return () => {
            document.body.style.overflow = "unset";
            dispatch(clearTrackingError());
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, storeId, trackingNumber]);

    const combinedEvents = useMemo(() => {
        if (!trackingData) return [];
        return [...(trackingData.events || [])].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [trackingData]);

    const reference = trackingReference(trackingNumber, isOrderNumber);
    const { endCard, currentStep: currentIdx, deliveryFailed } = trackingProgress(orderStatus);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-sm font-semibold tracking-tight text-gray-900">Track Order</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <span className="material-symbols-outlined text-gray-400">close</span>
                    </button>
                </div>
                <div className="p-8">
                    {!trackingLoading && trackingData && (
                        <div className="mb-8 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 uppercase tracking-tight">{orderStatusLabel(trackingData.status) || "Processing"}</h2>
                                <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mt-1">Current Status</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-mono font-medium text-gray-900">{reference.text}</p>
                                <p className="text-xs text-gray-400 font-medium uppercase tracking-widest mt-1">{reference.label}</p>
                            </div>
                        </div>
                    )}

                    {trackingLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <div className="animate-spin h-8 w-8 border-4 border-black border-t-transparent rounded-full"></div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Fetching updates...</p>
                        </div>
                    ) : trackingError ? (
                        <div className="p-6 bg-red-50 rounded-xl border border-red-100 text-center">
                            <span className="material-symbols-outlined text-3xl text-red-500 mb-3">package_2</span>
                            <p className="text-sm font-semibold text-red-800">{trackingError}</p>
                            <p className="text-xs text-red-600/60 mt-1 uppercase font-medium tracking-tight">Please try again later</p>
                        </div>
                    ) : combinedEvents.length > 0 ? (
                        <div className="space-y-8 relative max-h-[60vh] overflow-y-auto pr-2">
                            <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-100" />
                            {combinedEvents.map((event, idx) => (
                                <div key={idx} className="flex gap-6 relative">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 ${idx === 0 ? "bg-black shadow-lg" : "bg-gray-100"}`}>
                                        <span className={`material-symbols-outlined text-base ${idx === 0 ? "text-white" : "text-gray-400"}`}>package_2</span>
                                    </div>
                                    <div>
                                        <h4 className={`text-sm font-semibold tracking-tight ${idx === 0 ? "text-gray-900" : "text-gray-400"}`}>{event.status}</h4>
                                        <p className="text-[11px] text-gray-400 mt-1 font-medium">
                                            {new Date(event.timestamp).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                            {event.location && ` • ${event.location}`}
                                        </p>
                                        {event.description && event.description !== event.status && <p className="text-[10px] text-gray-400 mt-1 italic leading-relaxed">{event.description}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-8">
                            {endCard ? (
                                <div data-testid="tracking-end-card" className={`rounded-2xl border p-6 text-center ${END_CARD_COLOR[endCard.tone]}`}>
                                    <p className="text-sm font-semibold uppercase tracking-widest">{endCard.label}</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {TRACKING_STEPS.map((step, idx) => {
                                        const isActive = idx === currentIdx;
                                        const isDone = currentIdx > -1 && idx < currentIdx;
                                        const failed = isActive && deliveryFailed;
                                        return (
                                            <div key={step.key} className="flex items-center gap-4" data-step={step.key} data-active={isActive || undefined}>
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${failed ? "bg-red-600" : isActive ? "bg-black" : isDone ? "bg-gray-300" : "bg-gray-100"}`}>
                                                    <span className={`material-symbols-outlined text-base ${isActive || isDone ? "text-white" : "text-gray-300"}`}>package_2</span>
                                                </div>
                                                <div>
                                                    <span className={`text-sm font-semibold ${isActive ? "text-gray-900" : isDone ? "text-gray-400" : "text-gray-200"}`}>{step.label}</span>
                                                    {failed && (
                                                        <p className="text-[11px] font-medium text-red-600 mt-0.5">Delivery attempt failed – the courier will try again</p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    <button onClick={onClose} className="w-full mt-10 py-4 bg-black text-white text-xs font-semibold tracking-wide rounded-xl hover:bg-gray-900 transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
