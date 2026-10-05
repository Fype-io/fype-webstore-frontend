"use client";

import { useState } from "react";
import Link from "next/link";
import WishlistButton from "@/components/themes/theme_one/WishlistButton";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { addToCart, addToGuestCart, fetchCart, fetchGuestCart } from "@/redux/slices/userSlice";
import { calculateProductTax } from "@/utils/taxCalculator";
import type { StorefrontProduct, TaxSettings } from "@/types/storefront";
import { useSparkCart } from "./SparkCartContext";
import { useStoreCurrency } from "@/components/shared/StoreCurrency";

const DEFAULT_PRODUCT_IMAGE =
    "https://i0.wp.com/mikeyarce.com/wp-content/uploads/2021/09/woocommerce-placeholder.png?ssl=1";

// Matches the reference's own "New" window convention (a fixed recency
// cutoff, not a merchant-configurable setting) — 30 days is the common
// e-commerce default.
const NEW_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

interface SparkProductCardProps {
    product: StorefrontProduct;
    globalTax?: TaxSettings;
    shopName?: string;
    storeId?: string;
    // Shop/Collection Page settings — default true so every other existing
    // caller (Featured Collection, Collection List, etc.) is unaffected.
    showName?: boolean;
    showPrice?: boolean;
    showBadges?: boolean;
    // True while the editor iframe is open (real or previewed product) —
    // Quick Add must never fire a real cart mutation during live-editing,
    // same convention as FeaturedCollection.tsx's FeaturedProductCard.
    disableQuickAdd?: boolean;
    // Off by default — matches the reference's Shop.tsx card exactly (no
    // wishlist affordance at all). WishlistView.tsx opts back in: it's the
    // wishlist page itself, and the heart is the only way to remove an item
    // from it, so hiding it there would be a real functional regression, not
    // just a style difference.
    showWishlistButton?: boolean;
}

// "use client" (Quick Add needs cart dispatch + local adding/added state).
// Quick Add (hover bar desktop / floating "+" mobile) ports
// FeaturedCollection.tsx's FeaturedProductCard pattern, matching the
// reference's Shop.tsx onAddToCart affordance this card was missing.
export default function ProductCard({
    product,
    globalTax,
    shopName,
    storeId,
    showName = true,
    showPrice = true,
    showBadges = true,
    disableQuickAdd = false,
    showWishlistButton = false,
}: SparkProductCardProps) {
    const { prefix } = useStoreCurrency();
    const dispatch = useAppDispatch();
    const { isAuthenticated } = useAppSelector((state) => state.user);
    const { openCart } = useSparkCart();
    const [adding, setAdding] = useState(false);
    const [added, setAdded] = useState(false);
    // Lazy initializer — Date.now() is impure, so it's evaluated once at
    // mount (not on every render) rather than called directly in the render
    // body. product.createdAt is stable for the card's lifetime anyway.
    const [isNew] = useState(
        () => !!product.createdAt && Date.now() - new Date(product.createdAt).getTime() < NEW_WINDOW_MS
    );

    const productImage = product.image || product.images?.[0] || DEFAULT_PRODUCT_IMAGE;
    const price = Number(product.price) || 0;
    const maxPrice = Number(product.maxPrice) || 0;
    const compareAtPrice = Number(product.compareAtPrice) || 0;
    // Rendered whenever the product structurally supports it (variant
    // products need a picker, not instant add — no Quick Add UI for those
    // at all); disableQuickAdd only makes it visible-but-inert (editor
    // preview), it doesn't hide the affordance entirely.
    const canQuickAdd = !product.hasVariants && !!storeId;

    const { displayPrice } = calculateProductTax(price, globalTax, { applied: product.taxApplied, rate: product.taxRate });
    const { displayPrice: maxDisplayPrice } = calculateProductTax(maxPrice, globalTax, { applied: product.taxApplied, rate: product.taxRate });
    const { displayPrice: compareDisplayPrice } = calculateProductTax(compareAtPrice, globalTax, {
        applied: product.taxApplied,
        rate: product.taxRate,
    });

    const handleQuickAdd = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (adding || disableQuickAdd || !storeId) return;
        setAdding(true);
        try {
            if (isAuthenticated) {
                await dispatch(addToCart({ storeId, productId: product.productId, quantity: 1 })).unwrap();
                dispatch(fetchCart({ storeId }));
            } else {
                await dispatch(addToGuestCart({ storeId, productId: product.productId, quantity: 1 })).unwrap();
                dispatch(fetchGuestCart({ storeId }));
            }
            openCart();
            setAdded(true);
            setTimeout(() => setAdded(false), 1500);
        } catch {
            // keep the card in place; cart error surfaces via redux
        } finally {
            setAdding(false);
        }
    };

    return (
        <div className="group relative">
            {showWishlistButton && <WishlistButton productId={product.productId} storeId={storeId} shopName={shopName} />}

            <Link href={`/products/${product.productId}`} className="block">
                <div className="aspect-square bg-gray-50 border border-gray-100 rounded-xl overflow-hidden mb-5 relative isolate">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={productImage}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    />
                    {showBadges && isNew && (
                        <span className="absolute top-4 left-4 bg-black text-white text-[10px] uppercase font-bold px-2 py-1 rounded-sm z-10 tracking-wider">
                            New
                        </span>
                    )}

                    {canQuickAdd && (
                        <>
                            <div className="hidden md:block absolute inset-x-4 bottom-4 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 z-10">
                                <button
                                    onClick={handleQuickAdd}
                                    className="w-full bg-white/95 backdrop-blur-sm text-black font-medium py-3 rounded shadow-sm hover:bg-white hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                    disabled={adding || disableQuickAdd}
                                >
                                    {added ? "Added" : adding ? "Adding…" : "Quick Add"}
                                </button>
                            </div>
                            <button
                                onClick={handleQuickAdd}
                                disabled={adding || disableQuickAdd}
                                className="md:hidden absolute bottom-2 right-2 w-10 h-10 bg-[#111] rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-transform z-20 disabled:opacity-60 disabled:cursor-not-allowed"
                                aria-label="Quick add to cart"
                            >
                                {added ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 6 9 17l-5-5" />
                                    </svg>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M5 12h14" />
                                        <path d="M12 5v14" />
                                    </svg>
                                )}
                            </button>
                        </>
                    )}
                </div>
                <div>
                    {showName && (
                        <h3 className="font-medium text-gray-900 group-hover:text-gray-500 transition-colors truncate">{product.name}</h3>
                    )}
                    {showPrice && (
                    <div className="flex items-center gap-2 mt-1.5">
                        {product.hasDiscount && <p className="text-gray-400 text-sm line-through">{prefix}{compareDisplayPrice}</p>}
                        <p className="text-gray-500">
                            {product.hasVariants && price !== maxPrice ? `${prefix}${displayPrice} – ${prefix}${maxDisplayPrice}` : `${prefix}${displayPrice}`}
                        </p>
                    </div>
                    )}
                </div>
            </Link>
        </div>
    );
}
