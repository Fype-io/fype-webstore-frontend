"use client";

import type { CartItem } from "@/redux/slices/userSlice";
import { variantLabel } from "./checkoutUtils";
import { Minus, Plus, ShoppingCart, Trash2, ChevronUp } from "lucide-react";
import { useStoreCurrency } from "@/components/shared/StoreCurrency";

interface CartItemsCardProps {
    items: CartItem[];
    collapsible?: boolean;
    isOpen?: boolean;
    onToggle?: () => void;
    onUpdateQuantity: (item: CartItem, quantity: number) => void;
    onRemove: (item: CartItem) => void;
    className?: string;
}

export default function CartItemsCard({
    items,
    collapsible = false,
    isOpen = true,
    onToggle,
    onUpdateQuantity,
    onRemove,
    className = "",
}: CartItemsCardProps) {
    const { format } = useStoreCurrency();
    const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
    const showItems = !collapsible || isOpen;

    return (
        <section
            className={`bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4 sm:p-5 flex flex-col gap-4 sm:gap-6 ${className}`}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" size={20} />
                    <h2 className="text-[16px] sm:text-lg font-bold text-gray-800 tracking-tight">
                        {collapsible ? "Order summary" : "Cart Items"}
                    </h2>
                </div>
                <div
                    className={`flex items-center gap-1 text-gray-600 font-medium text-[13px] sm:text-sm ${collapsible ? "cursor-pointer hover:text-black transition-colors" : ""}`}
                    onClick={() => collapsible && onToggle?.()}
                >
                    {totalItems} item{totalItems !== 1 ? "s" : ""}
                    {collapsible && (
                        <ChevronUp className={`w-4 h-4 transition-transform duration-300 ${isOpen ? "" : "rotate-180"}`} size={16} />
                    )}
                </div>
            </div>

            {showItems && (
                <div className="flex flex-col gap-5 sm:gap-6">
                    {items.map((item) => {
                        const variant = variantLabel(item);
                        const mrp = item.compareAtPrice && item.compareAtPrice > item.price ? item.compareAtPrice : null;
                        return (
                            <div key={item._id} className="flex gap-3.5 sm:gap-4 items-start">
                                <div className="w-16 h-16 sm:w-24 sm:h-24 md:w-36 md:h-36 bg-gray-100 rounded-xl overflow-hidden shrink-0 border border-gray-100">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={item.image || "/placeholder-product.png"} alt={item.name} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 flex flex-col gap-1 sm:gap-1.5">
                                    <div className="flex justify-between items-start gap-2">
                                        <h3 className="text-gray-800 font-semibold text-[14px] sm:text-[15px] leading-snug">{item.name}</h3>
                                        <div className="flex flex-col items-end shrink-0">
                                            <span className="text-gray-900 font-bold text-[14px] sm:text-[15px]">{format(item.price)}</span>
                                            {mrp && (
                                                <span className="text-gray-400 text-[12px] sm:text-[13px] line-through font-medium">
                                                    {format(mrp)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {variant && <p className="text-gray-400 text-[12px] sm:text-[13px] mb-1 sm:mb-2 font-medium">{variant}</p>}
                                    <div className="flex items-center gap-2.5 sm:gap-3">
                                        <button
                                            type="button"
                                            onClick={() => onRemove(item)}
                                            className="p-1.5 sm:p-2 border border-gray-200 rounded-lg text-gray-500 hover:text-red-500 hover:border-red-200 transition-colors shadow-sm"
                                        >
                                            <Trash2 className="w-4 h-4 sm:w-[18px] sm:h-[18px]" size={18} />
                                        </button>
                                        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                            <button
                                                type="button"
                                                onClick={() => onUpdateQuantity(item, Math.max(1, item.quantity - 1))}
                                                className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-50 transition-colors"
                                            >
                                                <Minus className="w-4 h-4 sm:w-[18px] sm:h-[18px]" size={18} />
                                            </button>
                                            <span className="w-6 sm:w-7 text-center text-[13px] sm:text-[15px] font-semibold text-gray-800">
                                                {item.quantity}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => onUpdateQuantity(item, Math.min(item.maxQuantity || 99, item.quantity + 1))}
                                                className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-50 transition-colors"
                                            >
                                                <Plus className="w-4 h-4 sm:w-[18px] sm:h-[18px]" size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {items.length === 0 && <div className="text-center py-3 text-gray-500 text-[13px] sm:text-sm">Your cart is empty</div>}
                </div>
            )}
        </section>
    );
}
