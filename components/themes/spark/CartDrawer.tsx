"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, X } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
    removeFromCart,
    removeFromGuestCart,
    updateCartItem,
    updateGuestCartItem,
    type CartItem,
} from "@/redux/slices/userSlice";
import { cartTotalCount } from "./SparkCartContext";
import { useStoreCurrency } from "@/components/shared/StoreCurrency";

interface CartDrawerProps {
    storeId: string;
    isOpen: boolean;
    onClose: () => void;
}

export default function CartDrawer({ storeId, isOpen, onClose }: CartDrawerProps) {
    const { prefix, locale } = useStoreCurrency();
    const dispatch = useAppDispatch();
    const { cart, isAuthenticated } = useAppSelector((state) => state.user);

    // Match SparkTheme: with the cart overlay open the page behind cannot
    // scroll — only the drawer list can. overflow:hidden on html/body is not
    // enough for wheel/touch that hit the dimmed backdrop.
    useEffect(() => {
        if (!isOpen) return;

        const html = document.documentElement;
        const body = document.body;
        const prevHtmlOverflow = html.style.overflow;
        const prevBodyOverflow = body.style.overflow;
        html.style.overflow = "hidden";
        body.style.overflow = "hidden";

        const allowInsideDrawer = (target: EventTarget | null) => {
            const el = target instanceof Element ? target : null;
            return !!el?.closest("#spark-cart-drawer");
        };

        const blockPageScroll = (e: Event) => {
            if (allowInsideDrawer(e.target)) return;
            e.preventDefault();
        };

        window.addEventListener("wheel", blockPageScroll, { passive: false });
        window.addEventListener("touchmove", blockPageScroll, { passive: false });

        return () => {
            html.style.overflow = prevHtmlOverflow;
            body.style.overflow = prevBodyOverflow;
            window.removeEventListener("wheel", blockPageScroll);
            window.removeEventListener("touchmove", blockPageScroll);
        };
    }, [isOpen]);

    const items = cart?.items ?? [];
    const count = cartTotalCount(cart);
    const subtotal = cart?.subtotal ?? items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

    const handleQuantity = (item: CartItem, qty: number) => {
        if (qty < 1) {
            handleRemove(item);
            return;
        }
        const payload = { storeId, itemId: item.productId, variantId: item.variantId, quantity: qty };
        if (isAuthenticated) dispatch(updateCartItem(payload));
        else dispatch(updateGuestCartItem(payload));
    };

    const handleRemove = (item: CartItem) => {
        const payload = { storeId, itemId: item.productId, variantId: item.variantId };
        if (isAuthenticated) dispatch(removeFromCart(payload));
        else dispatch(removeFromGuestCart(payload));
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-[110] overscroll-none"
                        onClick={onClose}
                    />
                    <motion.div
                        id="spark-cart-drawer"
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "tween", duration: 0.3 }}
                        className="fixed top-0 right-0 h-full w-full max-w-[450px] bg-white shadow-2xl z-[120] flex flex-col text-gray-900 overscroll-contain"
                    >
                        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100 shrink-0">
                            <h2 className="text-lg font-bold">Your Cart ({count})</h2>
                            <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors" aria-label="Close cart">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-6">
                            {items.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-400">
                                        <span className="text-2xl pt-1">🛒</span>
                                    </div>
                                    <p className="text-gray-500">Your cart is currently empty.</p>
                                    <button type="button" onClick={onClose} className="text-black font-medium border-b border-black pb-1">
                                        Continue Shopping
                                    </button>
                                </div>
                            ) : (
                                items.map((item) => (
                                    <div key={item._id ?? `${item.productId}-${item.variantId ?? ""}`} className="flex gap-3 sm:gap-4 min-w-0">
                                        <div className="w-16 sm:w-24 aspect-square bg-gray-50 rounded-lg overflow-hidden border border-gray-100 shrink-0">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={item.image || "/placeholder-product.png"} alt={item.name} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                                            <div className="min-w-0">
                                                <div className="flex justify-between items-start gap-2 mb-1 min-w-0">
                                                    <h3 className="font-medium text-gray-900 leading-tight min-w-0 break-words">{item.name}</h3>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemove(item)}
                                                        className="text-gray-400 hover:text-red-500 transition-colors"
                                                        aria-label="Remove item"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                                {item.options && (
                                                    <p className="text-gray-500 text-sm mb-4">
                                                        {Object.entries(item.options)
                                                            .map(([key, val]) => `${key}: ${val}`)
                                                            .join(" | ")}
                                                    </p>
                                                )}
                                                {!item.options && <p className="text-gray-500 text-sm mb-4">{prefix}{Number(item.price).toLocaleString(locale)}</p>}
                                            </div>
                                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                                <div className="flex items-center border border-gray-200 rounded">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleQuantity(item, item.quantity - 1)}
                                                        className="p-2 text-gray-500 hover:bg-gray-50"
                                                    >
                                                        <Minus size={14} />
                                                    </button>
                                                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleQuantity(item, item.quantity + 1)}
                                                        className="p-2 text-gray-500 hover:bg-gray-50"
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </div>
                                                <span className="font-medium text-gray-900">
                                                    {prefix}{(Number(item.price) * item.quantity).toLocaleString(locale)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {items.length > 0 && (
                            <div className="p-4 sm:p-6 border-t border-gray-100 bg-gray-50 space-y-4 shrink-0">
                                <div className="flex justify-between text-lg font-bold">
                                    <span>Subtotal</span>
                                    <span>{prefix}{Number(subtotal).toLocaleString(locale)}</span>
                                </div>
                                <p className="text-sm text-gray-500 text-center">Shipping & taxes calculated at checkout</p>
                                <Link
                                    href="/checkout"
                                    onClick={onClose}
                                    className="block w-full bg-black text-white py-4 rounded-lg font-medium hover:bg-gray-800 transition-colors shadow-sm text-center"
                                >
                                    Checkout
                                </Link>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
