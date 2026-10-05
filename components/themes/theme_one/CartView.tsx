"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthModal from "@/components/shared/AuthModal";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
    updateCartItem,
    removeFromCart,
    updateGuestCartItem,
    removeFromGuestCart,
    addToWishlist,
    type CartItem,
} from "@/redux/slices/userSlice";
import { useStoreCurrency } from "@/components/shared/StoreCurrency";

interface CartViewProps {
    storeId?: string;
    shopName?: string;
    taxLabel?: string;
}

// Scoped to viewing/editing the cart only — address selection, shipping
// calculation, payment, and order placement all live in the headless
// checkout (Phase 3, /checkout), not here. "Proceed to Checkout" just hands
// off; it doesn't do checkout's job.
export default function CartView({ storeId, shopName, taxLabel }: CartViewProps) {
    const { prefix } = useStoreCurrency();
    const router = useRouter();
    const dispatch = useAppDispatch();
    const { cart, isAuthenticated } = useAppSelector((state) => state.user);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    const handleQuantityChange = (item: CartItem, newQuantity: number) => {
        if (!storeId || newQuantity < 1) return;
        const payload = { storeId, itemId: item.productId, variantId: item.variantId, quantity: newQuantity };
        if (isAuthenticated) dispatch(updateCartItem(payload));
        else dispatch(updateGuestCartItem(payload));
    };

    const handleRemove = (item: CartItem) => {
        if (!storeId) return;
        const payload = { storeId, itemId: item.productId, variantId: item.variantId };
        if (isAuthenticated) dispatch(removeFromCart(payload));
        else dispatch(removeFromGuestCart(payload));
    };

    const handleMoveToWishlist = (item: CartItem) => {
        if (!storeId) return;
        if (!isAuthenticated) {
            setIsAuthModalOpen(true);
            return;
        }
        dispatch(addToWishlist({ storeId, productId: item.productId }));
        handleRemove(item);
    };

    if (!cart || cart.items.length === 0) {
        return (
            <div className="text-center py-20">
                <span className="material-symbols-outlined text-8xl text-gray-200 mb-6">shopping_bag</span>
                <h2 className="text-2xl font-bold mb-4 uppercase tracking-tight">Your cart is empty</h2>
                <p className="text-gray-500 mb-8 max-w-md mx-auto">
                    Looks like you haven&apos;t added anything to your cart yet. Start shopping to find something you love!
                </p>
                <Link
                    href="/products"
                    className="inline-block bg-black text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors"
                >
                    Continue Shopping
                </Link>
            </div>
        );
    }

    const grandTotal = (cart.subtotal || 0) + (cart.tax || 0) - (cart.discount || 0);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-8 space-y-8">
                <div className="flex items-center justify-between border-b border-gray-100 py-4">
                    <h1 className="text-xl text-black uppercase tracking-tighter">Cart ({cart.itemCount})</h1>
                </div>

                <div className="space-y-10">
                    {cart.items.map((item) => (
                        <div key={item._id ?? item.productId} className="flex gap-6 pb-8 border-b border-gray-50 last:border-0 relative">
                            <div className="w-24 h-32 sm:w-32 sm:h-40 bg-gray-50 flex-shrink-0 rounded-sm overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={item.image || "/placeholder-product.png"} alt={item.name} className="w-full h-full object-cover" />
                            </div>

                            <div className="flex-grow flex flex-col">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-sm sm:text-base font-bold text-gray-900 uppercase leading-tight max-w-[200px] sm:max-w-md">
                                            {item.name}
                                        </h3>
                                        {item.options && (
                                            <p className="text-xs text-gray-500 mt-1 uppercase font-medium">
                                                {Object.entries(item.options)
                                                    .map(([key, val]) => `${key}: ${val}`)
                                                    .join(" | ")}
                                            </p>
                                        )}
                                        <div className="mt-3 flex items-center gap-2">
                                            <span className="text-xs font-bold text-gray-600 uppercase">Qty:</span>
                                            <select
                                                value={item.quantity}
                                                onChange={(e) => handleQuantityChange(item, parseInt(e.target.value))}
                                                className="text-xs font-bold bg-transparent border-none focus:ring-0 cursor-pointer text-black hover:text-gray-600 transition-colors"
                                            >
                                                {Array.from({ length: Math.max(10, item.maxQuantity || 10) }, (_, i) => i + 1).map((n) => (
                                                    <option key={n} value={n}>
                                                        {n}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <button onClick={() => handleRemove(item)} className="text-gray-400 hover:text-black transition-colors">
                                        <span className="material-symbols-outlined text-xl">delete</span>
                                    </button>
                                </div>

                                <div className="mt-auto flex justify-between items-end pt-4">
                                    <button
                                        onClick={() => handleMoveToWishlist(item)}
                                        className="text-[10px] text-black uppercase tracking-widest border-b border-black hover:text-gray-500 hover:border-gray-300 transition-all"
                                    >
                                        Move to Wishlist
                                    </button>
                                    <div className="text-right">
                                        {item.compareAtPrice && item.compareAtPrice > item.price ? (
                                            <span className="text-xs text-gray-400 line-through mr-2">{prefix}{Number(item.compareAtPrice).toFixed(2)}</span>
                                        ) : null}
                                        <span className="text-base text-black italic">{prefix}{Number(item.price).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
                <div className="bg-white border border-gray-100 p-6 rounded-sm shadow-sm space-y-6">
                    <h2 className="text-xs font-black uppercase tracking-widest text-center border-b border-gray-50 pb-4 text-black">
                        Price Details
                    </h2>

                    <div className="space-y-3 text-xs uppercase font-bold tracking-tight">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Bag Total</span>
                            <span className="text-black">{prefix}{Number(cart.subtotal).toFixed(2)}</span>
                        </div>
                        {cart.tax > 0 && (
                            <div className="flex justify-between">
                                <span className="text-gray-500">{cart.taxLabel || taxLabel || "Estimated Tax"}</span>
                                <span className="text-black">{prefix}{Number(cart.tax).toFixed(2)}</span>
                            </div>
                        )}
                        <p className="text-[10px] text-gray-400 normal-case font-medium tracking-normal pt-1">
                            Shipping calculated at checkout
                        </p>
                        <div className="flex justify-between text-sm pt-4 border-t border-gray-100 font-black tracking-widest">
                            <span className="text-black">Total</span>
                            <span className="text-black">{prefix}{Number(grandTotal).toFixed(2)}</span>
                        </div>
                    </div>

                    <button
                        onClick={() => router.push("/checkout")}
                        className="w-full py-4 bg-black hover:bg-gray-800 text-white font-black uppercase tracking-[0.2em] transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
                    >
                        Proceed to Checkout
                    </button>
                </div>
            </div>

            <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} storeId={storeId} shopName={shopName} platformName="Fype" />
        </div>
    );
}
