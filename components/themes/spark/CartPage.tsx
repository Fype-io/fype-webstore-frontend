"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CartPageProps } from "@/components/themes/registry";
import SparkHeaderShell from "./SparkHeaderShell";
import { buildSparkNavItems, sparkDefaultConfig } from "./sparkConfig";
import AuthModal from "@/components/shared/AuthModal";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { updateCartItem, removeFromCart, updateGuestCartItem, removeFromGuestCart, addToWishlist, type CartItem } from "@/redux/slices/userSlice";
import { useStoreCurrency } from "@/components/shared/StoreCurrency";

// Same real cart redux contract as theme_one's CartView (guest-vs-
// authenticated update/remove, move-to-wishlist) — restyled to Spark's
// cleaner aesthetic. No Spark Footer yet — same deferral as HomePage.tsx.
export default function CartPage({ shop, navPages, bestSellerProducts }: CartPageProps) {
    const { prefix } = useStoreCurrency();
    const router = useRouter();
    const dispatch = useAppDispatch();
    const { cart, isAuthenticated } = useAppSelector((state) => state.user);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    const navItems = buildSparkNavItems(navPages);
    const config = {
        ...sparkDefaultConfig,
        sections: {
            ...sparkDefaultConfig.sections,
            announcement_bar: {
                ...sparkDefaultConfig.sections.announcement_bar,
                settings: { ...sparkDefaultConfig.sections.announcement_bar.settings, show: false },
            },
            header: {
                ...sparkDefaultConfig.sections.header,
                settings: { ...sparkDefaultConfig.sections.header.settings, logo_text: shop.shopName },
            },
        },
    };

    const handleQuantityChange = (item: CartItem, newQuantity: number) => {
        if (newQuantity < 1) return;
        const payload = { storeId: shop.shopId, itemId: item.productId, variantId: item.variantId, quantity: newQuantity };
        if (isAuthenticated) dispatch(updateCartItem(payload));
        else dispatch(updateGuestCartItem(payload));
    };

    const handleRemove = (item: CartItem) => {
        const payload = { storeId: shop.shopId, itemId: item.productId, variantId: item.variantId };
        if (isAuthenticated) dispatch(removeFromCart(payload));
        else dispatch(removeFromGuestCart(payload));
    };

    const handleMoveToWishlist = (item: CartItem) => {
        if (!isAuthenticated) {
            setIsAuthModalOpen(true);
            return;
        }
        dispatch(addToWishlist({ storeId: shop.shopId, productId: item.productId }));
        handleRemove(item);
    };

    const isEmpty = !cart || cart.items.length === 0;
    const grandTotal = cart ? (cart.subtotal || 0) + (cart.tax || 0) - (cart.discount || 0) : 0;

    return (
        <div className="bg-white text-black min-h-screen">
            <SparkHeaderShell
                config={config}
                navItems={navItems}
                shop={shop}
            />

            <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-10">Your Cart {cart ? `(${cart.itemCount})` : ""}</h1>

                {isEmpty ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-400">
                            <span className="material-symbols-outlined text-3xl">shopping_bag</span>
                        </div>
                        <p className="text-gray-500">Your cart is currently empty.</p>
                        <Link href="/products" className="text-black font-medium border-b border-black pb-1">
                            Continue Shopping
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                        <div className="lg:col-span-8 space-y-8">
                            {cart!.items.map((item) => (
                                <div key={item._id ?? item.productId} className="flex gap-5 pb-8 border-b border-gray-100 last:border-0">
                                    <div className="w-24 aspect-square bg-gray-50 rounded-lg overflow-hidden border border-gray-100 shrink-0">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={item.image || "/placeholder-product.png"} alt={item.name} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 flex flex-col justify-between py-1">
                                        <div>
                                            <div className="flex justify-between items-start gap-4">
                                                <h3 className="font-medium text-gray-900 leading-tight">{item.name}</h3>
                                                <button onClick={() => handleRemove(item)} className="text-gray-400 hover:text-black transition-colors shrink-0">
                                                    <span className="material-symbols-outlined text-xl">close</span>
                                                </button>
                                            </div>
                                            {item.options && (
                                                <p className="text-sm text-gray-500 mt-1">
                                                    {Object.entries(item.options)
                                                        .map(([key, val]) => `${key}: ${val}`)
                                                        .join(" | ")}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between mt-4">
                                            <div className="flex items-center border border-gray-200 rounded">
                                                <button onClick={() => handleQuantityChange(item, item.quantity - 1)} className="p-2 text-gray-500 hover:bg-gray-50 transition-colors">
                                                    <span className="material-symbols-outlined text-base">remove</span>
                                                </button>
                                                <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                                                <button onClick={() => handleQuantityChange(item, item.quantity + 1)} className="p-2 text-gray-500 hover:bg-gray-50 transition-colors">
                                                    <span className="material-symbols-outlined text-base">add</span>
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => handleMoveToWishlist(item)}
                                                    className="text-xs text-gray-500 underline underline-offset-4 hover:text-black transition-colors"
                                                >
                                                    Move to Wishlist
                                                </button>
                                                <span className="font-medium text-gray-900">
                                                    {prefix}{(Number(item.price) * item.quantity).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="lg:col-span-4">
                            <div className="bg-gray-50 rounded-xl p-6 space-y-4 sticky top-24">
                                <h2 className="font-bold text-lg border-b border-gray-200 pb-4">Order Summary</h2>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between text-gray-600">
                                        <span>Subtotal</span>
                                        <span>{prefix}{Number(cart!.subtotal).toFixed(2)}</span>
                                    </div>
                                    {cart!.tax > 0 && (
                                        <div className="flex justify-between text-gray-600">
                                            <span>{cart!.taxLabel || "Estimated Tax"}</span>
                                            <span>{prefix}{Number(cart!.tax).toFixed(2)}</span>
                                        </div>
                                    )}
                                    <p className="text-xs text-gray-400">Shipping calculated at checkout</p>
                                </div>
                                <div className="flex justify-between font-bold text-lg pt-4 border-t border-gray-200">
                                    <span>Total</span>
                                    <span>{prefix}{grandTotal.toFixed(2)}</span>
                                </div>
                                <button
                                    onClick={() => router.push("/checkout")}
                                    className="w-full py-4 bg-black text-white rounded-xl font-medium hover:bg-gray-900 transition-colors shadow-lg active:scale-[0.98]"
                                >
                                    Proceed to Checkout
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {bestSellerProducts.length > 0 && (
                    <div className="mt-24">
                        <h2 className="text-xl font-bold mb-8 text-center">You might also like</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {bestSellerProducts.map((product) => (
                                <Link href={`/products/${product.productId}`} key={product.productId} className="group block">
                                    <div className="aspect-square bg-gray-50 border border-gray-100 rounded-xl overflow-hidden mb-3">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={product.image || "/placeholder-product.png"}
                                            alt={product.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    </div>
                                    <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                                    <p className="text-sm text-gray-500 mt-1">{prefix}{product.price}</p>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} storeId={shop.shopId} shopName={shop.shopName} platformName="Fype" />
        </div>
    );
}
