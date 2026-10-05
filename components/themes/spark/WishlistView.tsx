"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { getApi } from "@/lib/client-api";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { addToCart, addToGuestCart, fetchCart, fetchGuestCart, fetchWishlist, removeFromWishlist } from "@/redux/slices/userSlice";
import { useSparkCart } from "./SparkCartContext";
import type { StorefrontProduct } from "@/types/storefront";
import { useStoreCurrency } from "@/components/shared/StoreCurrency";

interface WishlistViewProps {
    storeId?: string;
}

export default function WishlistView({ storeId }: WishlistViewProps) {
    const { prefix, locale } = useStoreCurrency();
    const dispatch = useAppDispatch();
    const { openCart } = useSparkCart();
    const { wishlist, wishlistLoading, isAuthenticated } = useAppSelector((state) => state.user);
    const [products, setProducts] = useState<StorefrontProduct[]>([]);
    const [loading, setLoading] = useState(false);
    const [addingId, setAddingId] = useState<string | null>(null);

    useEffect(() => {
        if (storeId && isAuthenticated) dispatch(fetchWishlist({ storeId }));
    }, [dispatch, storeId, isAuthenticated]);

    useEffect(() => {
        if (!storeId || wishlist.length === 0) {
            setProducts([]);
            return;
        }

        let cancelled = false;
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

    const handleAddToCart = async (product: StorefrontProduct) => {
        if (!storeId || product.hasVariants) return;
        setAddingId(product.productId);
        try {
            if (isAuthenticated) {
                await dispatch(addToCart({ storeId, productId: product.productId, quantity: 1 })).unwrap();
                dispatch(fetchCart({ storeId }));
            } else {
                await dispatch(addToGuestCart({ storeId, productId: product.productId, quantity: 1 })).unwrap();
                dispatch(fetchGuestCart({ storeId }));
            }
            openCart();
        } catch {
            // cart error surfaces via redux
        } finally {
            setAddingId(null);
        }
    };

    if (loading || wishlistLoading) {
        return (
            <div className="text-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black mx-auto" />
                <p className="mt-4 text-gray-500">Loading your wishlist…</p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl md:text-2xl font-bold">Wishlist ({wishlist.length})</h2>
            </div>

            {products.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-gray-300 rounded-2xl bg-gray-50/50">
                    <Heart size={48} className="mb-4 text-gray-300" />
                    <h3 className="text-xl font-bold mb-2">Your wishlist is empty</h3>
                    <p className="text-gray-500 mb-6 font-medium">Save items you love to pick them up later.</p>
                    <Link href="/products" className="bg-black text-white px-8 py-3 rounded-full font-medium hover:opacity-90 transition-opacity">
                        Start Shopping
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.map((item) => {
                        const img = item.image || item.images?.[0] || "/placeholder-product.png";
                        return (
                            <div key={item.productId} className="group border border-gray-200 hover:border-black transition-all rounded-2xl overflow-hidden bg-white flex flex-col relative">
                                <div className="aspect-square bg-gray-100 relative overflow-hidden">
                                    <Link href={`/products/${item.productId}`} className="block h-full">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={img} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    </Link>
                                    {storeId && (
                                        <button
                                            type="button"
                                            onClick={() => dispatch(removeFromWishlist({ storeId, productId: item.productId }))}
                                            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 hover:bg-white shadow-sm flex items-center justify-center text-red-500 hover:scale-110 transition-all z-10"
                                            title="Remove from wishlist"
                                        >
                                            <Heart size={16} className="fill-current text-red-500" />
                                        </button>
                                    )}
                                </div>
                                <div className="p-4 flex-1 flex flex-col justify-between">
                                    <Link href={`/products/${item.productId}`} className="mb-3">
                                        <h3 className="font-semibold text-sm text-gray-900 line-clamp-1 group-hover:text-gray-600 transition-colors">{item.name}</h3>
                                        <p className="text-sm text-gray-500 font-medium mt-1">{prefix}{Number(item.price).toLocaleString(locale)}</p>
                                    </Link>
                                    {item.hasVariants ? (
                                        <Link
                                            href={`/products/${item.productId}`}
                                            className="w-full bg-black text-white py-2.5 px-4 rounded-xl text-xs font-medium hover:bg-gray-800 transition-colors text-center spark-font-body"
                                        >
                                            Choose options
                                        </Link>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => handleAddToCart(item)}
                                            disabled={addingId === item.productId}
                                            className="w-full bg-black text-white py-2.5 px-4 rounded-xl text-xs font-medium hover:bg-gray-800 transition-colors spark-font-body disabled:opacity-60"
                                        >
                                            {addingId === item.productId ? "Adding…" : "Add to Cart"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
