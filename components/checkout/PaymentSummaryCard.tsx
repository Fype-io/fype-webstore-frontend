"use client";

import { Banknote } from "lucide-react";
import { useStoreCurrency } from "@/components/shared/StoreCurrency";

interface PaymentSummaryCardProps {
    subtotal: number;
    tax: number;
    taxLabel?: string;
    shipping: number | null;
    shippingCalculating?: boolean;
    total: number;
}

export default function PaymentSummaryCard({
    subtotal,
    tax,
    taxLabel,
    shipping,
    shippingCalculating,
    total,
}: PaymentSummaryCardProps) {
    const { format } = useStoreCurrency();
    return (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4 sm:p-5 flex flex-col gap-4 sm:gap-6">
            <div className="flex items-center gap-2">
                <Banknote className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" size={20} />
                <h2 className="text-[16px] sm:text-lg font-bold text-gray-800 tracking-tight">Payment summary</h2>
            </div>
            <div className="flex flex-col gap-3 mt-1 text-[13px] sm:text-[14px]">
                <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-semibold">Subtotal</span>
                    <span className="text-gray-800 font-bold">{format(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-semibold">{taxLabel || "Tax"}</span>
                    <span className="text-gray-800 font-bold">{format(tax)}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-semibold">Shipping</span>
                    <span className="text-gray-400 font-medium">
                        {shippingCalculating ? (
                            "Calculating..."
                        ) : shipping === null ? (
                            "To be calculated"
                        ) : shipping === 0 ? (
                            "FREE"
                        ) : (
                            format(shipping)
                        )}
                    </span>
                </div>
                <div className="h-[1px] bg-gray-100 my-1" />
                <div className="flex justify-between items-center pt-0.5">
                    <span className="text-gray-800 font-bold text-[15px] sm:text-[16px]">Total</span>
                    <span className="text-gray-900 font-bold text-[17px] sm:text-[18px]">{format(total)}</span>
                </div>
            </div>
        </section>
    );
}
