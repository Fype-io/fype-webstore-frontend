"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getApi } from "@/lib/client-api";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { fetchWishlist, removeFromWishlist, addToCart } from "@/redux/slices/userSlice";
import type { StorefrontProduct } from "@/types/storefront";
import { useStoreCurrency } from "@/components/shared/StoreCurrency";

const DEFAULT_PRODUCT_IMAGE =
    "https://i0.wp.com/mikeyarce.com/wp-content/uploads/2021/09/woocommerce-placeholder.png?ssl=1";

interface WishlistViewProps {
    storeId?: string;
}

export default function WishlistView({ storeId }: WishlistViewProps) {
    const { prefix, locale } = useStoreCurrency();
    const router = useRouter();
    const dispatch = useAppDispatch();
    const { wishlist, wishlistLoading, isAuthenticated } = useAppSelector((state) => state.user);

    const [products, setProducts] = useState<StorefrontProduct[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (storeId && isAuthenticated) dispatch(fetchWishlist({ storeId }));
    }, [dispatch, storeId, isAuthenticated]);

    useEffect(() => {
        // Nothing to fetch — render checks wishlist.length directly for the
        // empty case below, so no state reset needed here.
        if (!storeId || wishlist.length === 0) return;

        let cancelled = false;
        // Standard "flag loading before starting an async fetch" pattern —
        // genuinely tied to the network call that follows, not derivable from
        // render-time state the way the other effects in this codebase are.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true);
        getApi<{ data: { products: StorefrontProduct[] } }>(`/commerce/${storeId}/storefront/products?limit=100`)
            .then((res) => {
                if (cancelled) return;
                const all = res.data.data.products ?? [];
                setProducts(all.filter((p) => wishlist.includes(p.productId)));
            })
            .catch(() => {
                if (!cancelled) setProducts([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [storeId, wishlist]);

    const handleRemove = (productId: string) => {
        if (storeId) dispatch(removeFromWishlist({ storeId, productId }));
    };

    const handleMoveToBag = (product: StorefrontProduct) => {
        if (!storeId) return;
        if (product.hasVariants) {
            router.push(`/products/${product.productId}`);
            return;
        }
        dispatch(addToCart({ storeId, productId: product.productId, quantity: 1 }));
        handleRemove(product.productId);
    };

    if (loading || wishlistLoading) {
        return (
            <div className="text-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
                <p className="mt-4 text-gray-500 font-semibold">Loading your wishlist...</p>
            </div>
        );
    }

    if (products.length === 0) {
        return (
            <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                    <span className="material-symbols-outlined text-4xl text-gray-200">favorite</span>
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Your wishlist is empty</h2>
                <p className="text-gray-500 mb-8 max-w-sm mx-auto text-lg">Save items you love to your wishlist and they&apos;ll show up here.</p>
                <Link href="/products" className="inline-block px-8 py-3 bg-black text-white rounded-xl text-base font-semibold hover:bg-gray-800 transition shadow-lg shadow-black/10">
                    Continue Shopping
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {products.map((item) => (
                <div key={item.productId} className="flex gap-6 pb-8 border-b border-gray-100 last:border-0 relative">
                    <Link href={`/products/${item.productId}`} className="w-24 h-32 sm:w-32 sm:h-40 bg-gray-50 flex-shrink-0 rounded-2xl overflow-hidden border border-gray-100 block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={item.image || item.images?.[0] || DEFAULT_PRODUCT_IMAGE}
                            alt={item.name}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                        />
                    </Link>

                    <div className="flex-grow flex flex-col py-1">
                        <div className="flex justify-between items-start">
                            <div>
                                <Link href={`/products/${item.productId}`} className="text-sm sm:text-base font-semibold text-gray-900 uppercase tracking-tight hover:text-black transition-colors">
                                    {item.name}
                                </Link>
                            </div>
                            <button onClick={() => handleRemove(item.productId)} className="text-gray-400 hover:text-red-500 transition-colors p-2 -mr-2">
                                <span className="material-symbols-outlined text-xl">close</span>
                            </button>
                        </div>

                        <div className="mt-auto flex justify-between items-end">
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg font-bold text-gray-900">{prefix}{Number(item.price).toLocaleString(locale)}</span>
                                    {item.compareAtPrice > item.price && (
                                        <span className="text-sm text-gray-400 line-through">{prefix}{Number(item.compareAtPrice).toLocaleString(locale)}</span>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleMoveToBag(item)}
                                    className="text-[10px] text-black font-bold uppercase tracking-widest border-b-2 border-black hover:text-gray-600 hover:border-gray-300 transition-all pb-0.5"
                                >
                                    {item.hasVariants ? "Select Options" : "Move to Bag"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
