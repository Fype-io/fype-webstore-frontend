"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { fetchOrders } from "@/redux/slices/userSlice";
import { useStoreCurrency } from "@/components/shared/StoreCurrency";
import { currencyLocale, currencyPrefix } from "@/lib/currency";

interface OrderListProps {
    storeId: string;
}

const formatStatus = (raw: string) => {
    const clean = raw === "booked" ? "pending" : raw;
    return clean
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
};

const statusBadgeClass = (status: string) => {
    if (status === "delivered") return "bg-green-100 text-green-700";
    if (status === "cancelled") return "bg-red-100 text-red-700";
    if (status === "refunded") return "bg-purple-100 text-purple-700";
    if (status === "shipped" || status === "in_transit") return "bg-blue-100 text-blue-700";
    return "bg-orange-100 text-orange-700";
};

export default function OrderList({ storeId }: OrderListProps) {
    const { currency } = useStoreCurrency();
    const dispatch = useAppDispatch();
    const { orders, ordersLoading, ordersPagination } = useAppSelector((state) => state.user);
    const [page, setPage] = useState(1);

    useEffect(() => {
        if (storeId) dispatch(fetchOrders({ storeId, page }));
         
    }, [dispatch, storeId, page]);

    if (ordersLoading && orders.length === 0) {
        return (
            <div className="flex justify-center items-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-black border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (orders.length === 0) {
        return (
            <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                <span className="material-symbols-outlined text-6xl text-gray-300 mb-4">shopping_bag</span>
                <p className="text-gray-600 mb-4 font-semibold">No orders found</p>
                <Link href="/products" className="px-8 py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition inline-block">
                    Start Shopping
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {orders.map((order) => {
                const shipments = order.shipments && order.shipments.length > 0 ? order.shipments : [];
                const isMultiShipment = shipments.length > 1;

                return (
                    <div key={order.orderId} className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all">
                        <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <h3 className="text-lg font-semibold tracking-tight text-gray-900">Order {order.orderNumber}</h3>
                                    {isMultiShipment && (
                                        <span className="px-2 py-0.5 bg-gray-100 text-black text-[10px] font-semibold rounded tracking-wider border border-gray-200">
                                            {shipments.length} Shipments
                                        </span>
                                    )}
                                    <span className={`px-3 py-1 rounded-full text-[11px] font-semibold ${statusBadgeClass(order.status)}`}>
                                        {formatStatus(order.status)}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-400 font-medium tracking-wide mt-1">
                                    Placed on {new Date(order.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                                </p>
                            </div>
                            <div className="text-left sm:text-right">
                                <p className="text-xl font-semibold text-black">{currencyPrefix(order.currency || currency)}{order.total.toLocaleString(currencyLocale(order.currency || currency))}</p>
                            </div>
                        </div>

                        {(order.status === "cancelled" || order.status === "refunded") && (
                            <div
                                className={`mx-6 mt-4 p-4 border rounded-xl flex items-start gap-4 ${
                                    order.paymentStatus === "refunded" || order.paymentStatus === "partially_refunded" ? "bg-orange-50 border-orange-100" : "bg-gray-50 border-gray-100"
                                }`}
                            >
                                <span className="material-symbols-outlined text-xl text-orange-600">info</span>
                                <div>
                                    <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-700">
                                        {order.paymentStatus === "refunded" ? "Refund Processed" : order.paymentStatus === "partially_refunded" ? "Partial Refund Processed" : "Order Cancelled"}
                                    </h4>
                                    {order.cancellationReason && <p className="text-[10px] mt-2 italic font-medium text-gray-400">Reason: {order.cancellationReason}</p>}
                                </div>
                            </div>
                        )}

                        <div className="p-6">
                            <div className="space-y-4">
                                {order.items.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="relative w-16 h-16 bg-gray-50 rounded-lg border border-gray-100 overflow-hidden flex-shrink-0">
                                                {item.image ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-gray-200">image</span>
                                                    </div>
                                                )}
                                                <div className="absolute top-0 left-0 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-br-lg">{item.quantity}x</div>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-semibold text-gray-900 line-clamp-1">{item.name}</h4>
                                                {item.options && Object.entries(item.options).length > 0 && (
                                                    <p className="text-[11px] text-gray-400 font-medium tracking-tight mt-1">
                                                        {Object.entries(item.options).map(([k, v]) => `${k}: ${v}`).join(" | ")}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <span className="text-sm font-semibold text-gray-900">{currencyPrefix(order.currency || currency)}{(item.subtotal ?? item.price * item.quantity).toLocaleString(currencyLocale(order.currency || currency))}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-8 pt-6 border-t border-gray-50">
                                <Link
                                    href={`/orders/${order.orderNumber}`}
                                    className="inline-flex items-center gap-2 px-8 py-3 bg-black text-white text-[10px] font-semibold tracking-[0.05em] rounded-lg hover:bg-gray-800 transition-all"
                                >
                                    <span className="material-symbols-outlined text-base">local_shipping</span>
                                    View details
                                </Link>
                            </div>
                        </div>
                    </div>
                );
            })}

            {ordersPagination && ordersPagination.pages > 1 && (
                <div className="flex justify-center gap-2 pt-4">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="px-4 py-2 text-xs font-semibold rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                        Previous
                    </button>
                    <span className="px-4 py-2 text-xs text-gray-500">
                        Page {ordersPagination.page} of {ordersPagination.pages}
                    </span>
                    <button
                        onClick={() => setPage((p) => Math.min(ordersPagination.pages, p + 1))}
                        disabled={page >= ordersPagination.pages}
                        className="px-4 py-2 text-xs font-semibold rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
