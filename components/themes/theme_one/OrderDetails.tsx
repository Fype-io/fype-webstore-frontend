"use client";

import { useState } from "react";
import Link from "next/link";
import type { Order } from "@/redux/slices/userSlice";
import OrderTracking from "./OrderTracking";
import { useStoreCurrency } from "@/components/shared/StoreCurrency";
import { currencyLocale, currencyPrefix } from "@/lib/currency";
import { ORDER_NOW_NOTE } from "@/components/checkout/checkoutUtils";

interface OrderDetailProps {
    order: Order;
    storeId: string;
}

export default function OrderDetail({ order, storeId }: OrderDetailProps) {
    const { currency } = useStoreCurrency();
    // The order's own currency (saved since checkout became server-priced), else the store's.
    const prefix = currencyPrefix(order.currency || currency);
    const locale = currencyLocale(order.currency || currency);
    const [trackingInfo, setTrackingInfo] = useState<{ number: string; carrier?: string; orderStatus?: string } | null>(null);

    const allShipments =
        order.shipments && order.shipments.length > 0
            ? order.shipments
            : [{ status: order.status, awbNumber: order.trackingNumber || undefined, provider: order.shipmentProvider, carrier: order.shipmentProvider, items: order.items }];

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-4 mb-4">
                <Link href="/orders" className="p-2 hover:bg-gray-100 rounded-full transition-colors" aria-label="Back to orders">
                    <span className="material-symbols-outlined text-gray-900">chevron_left</span>
                </Link>
                <h2 className="text-3xl font-bold tracking-tight text-gray-900">Order {order.orderNumber}</h2>
            </div>

            {/* Placed with "Order now" (no gateway, no COD): not paid, and not cash on delivery. */}
            {order.paymentMethod === "manual" && order.paymentStatus === "unpaid" && (
                <div role="status" className="p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm text-gray-700">
                    {ORDER_NOW_NOTE}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden">
                        <div className="px-8 py-6 border-b border-gray-50">
                            <h3 className="text-sm font-semibold tracking-tight text-gray-900">
                                Order Items <span className="text-gray-400 text-xs font-medium lowercase tracking-normal ml-2">({allShipments.length} {allShipments.length === 1 ? "shipment" : "shipments"})</span>
                            </h3>
                        </div>

                        <div className="p-8 space-y-12">
                            {allShipments.map((shipment, sIdx) => (
                                <div key={sIdx} className="space-y-6">
                                    {shipment.awbNumber && (
                                        <div className="flex items-center gap-4">
                                            <div className="h-px flex-grow bg-gray-100" />
                                            <span className="text-[10px] font-mono font-medium text-gray-400 bg-white px-4 py-1.5 rounded-full border border-gray-100 shadow-sm">
                                                AWB #{shipment.awbNumber}
                                            </span>
                                            <div className="h-px flex-grow bg-gray-100" />
                                        </div>
                                    )}

                                    <div className="space-y-8">
                                        {(shipment.items || []).map((item, iIdx) => (
                                            <div key={iIdx} className="flex items-center justify-between">
                                                <div className="flex items-center gap-6">
                                                    <div className="w-20 h-20 bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden shrink-0">
                                                        {item.image ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <span className="material-symbols-outlined text-gray-200">package_2</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-semibold tracking-tight text-gray-900">{item.name}</h4>
                                                        <p className="text-xs text-gray-500 font-medium mt-2">Quantity: {item.quantity}</p>
                                                    </div>
                                                </div>
                                                <span className="text-sm font-semibold text-gray-900">{prefix}{item.price.toLocaleString(locale)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            <div className="pt-10 border-t border-gray-100 space-y-5">
                                <div className="flex justify-between text-xs font-medium tracking-tight text-gray-500">
                                    <span>Subtotal</span>
                                    <span>{prefix}{(order.subtotal ?? order.total - (order.tax || 0) - (order.shipping || 0)).toLocaleString(locale)}</span>
                                </div>
                                {order.tax > 0 && (
                                    <div className="flex justify-between text-xs font-medium tracking-tight text-gray-500">
                                        <span>Tax</span>
                                        <span>{prefix}{order.tax.toLocaleString(locale)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-xs font-medium tracking-tight text-gray-500">
                                    <span>Shipping</span>
                                    {order.shipping > 0 ? <span>{prefix}{order.shipping.toLocaleString(locale)}</span> : <span className="text-green-600 font-semibold">Free</span>}
                                </div>
                                {order.discount > 0 && (
                                    <div className="flex justify-between text-xs font-medium tracking-tight text-gray-500">
                                        <span>Discount</span>
                                        <span className="text-red-500">-{prefix}{order.discount.toLocaleString(locale)}</span>
                                    </div>
                                )}
                                <div className="pt-8 mt-2 border-t border-gray-100 flex justify-between items-center text-gray-900">
                                    <span className="text-base font-medium tracking-tight">Total Amount</span>
                                    <span className="text-3xl font-bold tracking-tight">{prefix}{order.total.toLocaleString(locale)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden">
                        <div className="px-8 py-6 border-b border-gray-50">
                            <h3 className="text-sm font-semibold tracking-tight text-gray-900">Track Shipment</h3>
                        </div>
                        <div className="p-8 space-y-6">
                            {allShipments.map((shipment, idx) => (
                                <div key={idx} className="p-6 bg-gray-50/50 rounded-2xl border border-gray-100 space-y-5">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2.5 bg-white rounded-xl border border-gray-100 shadow-sm">
                                            <span className="material-symbols-outlined text-gray-900">local_shipping</span>
                                        </div>
                                        <div>
                                            <p className="text-xs font-mono font-medium text-gray-600 block">{shipment.awbNumber ? `AWB #${shipment.awbNumber}` : "Not yet dispatched"}</p>
                                            <p className="text-[10px] font-medium text-gray-400 mt-1 uppercase tracking-wider">
                                                {shipment.items?.length || order.items.length} {(shipment.items?.length || order.items.length) === 1 ? "Item" : "Items"}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setTrackingInfo({ number: shipment.awbNumber || order.orderNumber, carrier: shipment.provider || shipment.carrier, orderStatus: shipment.status || order.status })}
                                        className="w-full py-4 bg-black text-white text-xs font-medium tracking-wide rounded-xl hover:bg-gray-800 transition-all"
                                    >
                                        Track shipment
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {trackingInfo && (
                <OrderTracking storeId={storeId} trackingNumber={trackingInfo.number} provider={trackingInfo.carrier} orderStatus={trackingInfo.orderStatus} onClose={() => setTrackingInfo(null)} />
            )}
        </div>
    );
}
