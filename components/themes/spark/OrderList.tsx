"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
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
    if (status === "delivered") return "bg-green-100 text-green-800";
    if (status === "cancelled") return "bg-red-100 text-red-800";
    if (status === "refunded") return "bg-purple-100 text-purple-800";
    if (status === "shipped" || status === "in_transit") return "bg-blue-100 text-blue-800";
    return "bg-gray-100 text-gray-800";
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
                <div className="animate-spin h-8 w-8 border-4 border-black border-t-transparent rounded-full" />
            </div>
        );
    }

    if (orders.length === 0) {
        return (
            <div>
                <h2 className="text-2xl font-bold mb-6">Order History</h2>
                <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-gray-300 rounded-2xl bg-gray-50/50">
                    <p className="text-gray-600 mb-6 font-medium">No orders yet.</p>
                    <Link href="/products" className="bg-black text-white px-8 py-3 rounded-full font-medium hover:opacity-90 transition-opacity">
                        Start Shopping
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div>
            <h2 className="text-2xl font-bold mb-6">Order History</h2>
            <div className="space-y-6">
                {orders.map((order) => {
                    const preview = order.items[0];
                    const extraCount = Math.max(0, order.items.length - 1);
                    return (
                        <div key={order.orderId} className="group border border-gray-200 hover:border-black transition-colors rounded-xl overflow-hidden bg-white">
                            <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 bg-gray-50/50 gap-3 sm:gap-0">
                                <div className="flex flex-wrap gap-x-8 gap-y-3 items-center text-sm w-full sm:w-auto">
                                    <div>
                                        <div className="text-gray-400 text-[10px] md:text-xs font-bold tracking-wider uppercase mb-1">Order Placed</div>
                                        <div className="font-medium text-xs md:text-sm">
                                            {new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-gray-400 text-[10px] md:text-xs font-bold tracking-wider uppercase mb-1">Total</div>
                                        <div className="font-medium text-xs md:text-sm">{currencyPrefix(order.currency || currency)}{Number(order.total).toLocaleString(currencyLocale(order.currency || currency))}</div>
                                    </div>
                                    <div>
                                        <div className="text-gray-400 text-[10px] md:text-xs font-bold tracking-wider uppercase mb-1">Order #</div>
                                        <div className="font-medium text-gray-600 text-xs md:text-sm">{order.orderNumber}</div>
                                    </div>
                                </div>
                                <div className="flex justify-start sm:justify-end shrink-0">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider ${statusBadgeClass(order.status)}`}>
                                        {formatStatus(order.status)}
                                    </span>
                                </div>
                            </div>
                            <div className="px-5 py-5 flex items-center justify-between gap-4">
                                <div className="flex gap-4 items-center overflow-hidden min-w-0">
                                    <div className="w-16 h-20 bg-gray-100 rounded-md border border-gray-200 overflow-hidden shrink-0">
                                        {preview?.image ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={preview.image} alt={preview.name} className="w-full h-full object-cover" />
                                        ) : null}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-sm md:text-base mb-1 truncate">{preview?.name || "Order items"}</h3>
                                        <p className="text-gray-500 text-xs md:text-sm truncate">
                                            {preview?.options && Object.keys(preview.options).length > 0
                                                ? `${Object.entries(preview.options)
                                                      .map(([k, v]) => `${k}: ${v}`)
                                                      .join(" | ")} | Qty: ${preview.quantity}`
                                                : `Qty: ${preview?.quantity ?? 0}`}
                                            {extraCount > 0 ? ` · +${extraCount} more` : ""}
                                        </p>
                                    </div>
                                </div>
                                <Link
                                    href={`/orders/${order.orderNumber}`}
                                    className="shrink-0 flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full border border-gray-200 bg-white text-gray-600 group-hover:bg-black group-hover:border-black group-hover:text-white transition-all"
                                    aria-label="View order"
                                >
                                    <ChevronRight size={16} className="translate-x-[1px]" />
                                </Link>
                            </div>
                        </div>
                    );
                })}
            </div>

            {ordersPagination && ordersPagination.pages > 1 && (
                <div className="flex justify-center gap-2 pt-8">
                    <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="px-4 py-2 text-xs font-semibold rounded-lg border border-gray-200 disabled:opacity-40"
                    >
                        Previous
                    </button>
                    <span className="px-4 py-2 text-xs text-gray-500">
                        Page {ordersPagination.page} of {ordersPagination.pages}
                    </span>
                    <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(ordersPagination.pages, p + 1))}
                        disabled={page >= ordersPagination.pages}
                        className="px-4 py-2 text-xs font-semibold rounded-lg border border-gray-200 disabled:opacity-40"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
