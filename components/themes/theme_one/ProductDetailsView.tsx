"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ProductGallery from "./ProductGallery";
import AuthModal from "@/components/shared/AuthModal";
import { calculateProductTax } from "@/utils/taxCalculator";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { addToCart, addToGuestCart, addToWishlist, fetchCart, fetchGuestCart, removeFromWishlist } from "@/redux/slices/userSlice";
import type { ProductDetail, ProductVariant, StorefrontProduct, TaxSettings, VariantOptions } from "@/types/storefront";
import { productHref } from "@/lib/product-url";
import { galleryImages } from "@/lib/variant-selection";
import { canBuy, productContinueSelling, variantContinueSelling } from "@/lib/stock";

interface ProductDetailsViewProps {
    product: ProductDetail;
    variants: ProductVariant[];
    variantOptions: VariantOptions | null;
    relatedProducts: StorefrontProduct[];
    globalTax?: TaxSettings;
    shopName?: string;
    storeId?: string;
}

export default function ProductDetailsView({
    product,
    variants,
    variantOptions,
    relatedProducts,
    globalTax,
    shopName,
    storeId,
}: ProductDetailsViewProps) {
    const dispatch = useAppDispatch();
    const { isAuthenticated, wishlist } = useAppSelector((state) => state.user);
    const isWishlisted = wishlist.includes(product.productId);
    const hasVariants = product.hasVariants;
    const options = variantOptions?.options ?? [];

    const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
        const init: Record<string, string> = {};
        if (hasVariants) {
            options.forEach((opt) => {
                if (opt.values.length > 0) init[opt.name] = opt.values[0];
            });
        }
        return init;
    });
    // Until the shopper picks an option, the gallery shows the product's own images (galleryImages).
    const [variantChosen, setVariantChosen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [cartMessage, setCartMessage] = useState<string | null>(null);

    const selectedVariant = useMemo(() => {
        if (!hasVariants || variants.length === 0 || Object.keys(selectedOptions).length === 0) return null;

        let v = variants.find((variant) => Object.entries(selectedOptions).every(([k, val]) => variant.options[k] === val));
        if (!v) {
            const optionNames = Object.keys(selectedOptions);
            if (optionNames.length === 1 && options.length === 1) {
                const idx = options[0].values.indexOf(selectedOptions[optionNames[0]]);
                if (idx >= 0 && idx < variants.length) v = variants[idx];
            }
        }
        return v ?? null;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedOptions, variants, hasVariants]);

    const displayData = useMemo(() => {
        if (hasVariants && selectedVariant) {
            return {
                price: selectedVariant.price,
                compareAtPrice: selectedVariant.compareAtPrice,
                taxApplied: product.price.taxApplied,
                taxRate: product.price.taxRate,
                effectiveTaxRate: selectedVariant.effectiveTaxRate ?? product.price.effectiveTaxRate,
                images: galleryImages(product.images, selectedVariant.image, variantChosen),
                available: canBuy({ available: selectedVariant.inventory?.available, trackQuantity: selectedVariant.inventory?.trackQuantity, continueSelling: variantContinueSelling(selectedVariant, product) }),
            };
        }
        return {
            price: product.price.price,
            compareAtPrice: product.price.compareAtPrice,
            taxApplied: product.price.taxApplied,
            taxRate: product.price.taxRate,
            effectiveTaxRate: product.price.effectiveTaxRate,
            images: product.images ?? [],
            available: canBuy({ available: product.inventory?.available, trackQuantity: product.inventory?.trackQuantity, continueSelling: productContinueSelling(product) }),
        };
    }, [hasVariants, selectedVariant, product, variantChosen]);

    // Clear the stale "cart coming soon" message when the selected variant
    // changes — adjusted during render rather than an effect (same reasoning
    // as ProductGallery's selectedImage reset).
    const [prevVariant, setPrevVariant] = useState(selectedVariant);
    if (selectedVariant !== prevVariant) {
        setPrevVariant(selectedVariant);
        setCartMessage(null);
    }

    const handleOptionChange = (name: string, value: string) => {
        setVariantChosen(true);
        setSelectedOptions((prev) => ({ ...prev, [name]: value }));
    };

    const handleWishlistToggle = () => {
        if (!isAuthenticated) {
            setIsAuthModalOpen(true);
            return;
        }
        if (!storeId) return;

        if (isWishlisted) {
            dispatch(removeFromWishlist({ storeId, productId: product.productId }));
        } else {
            dispatch(addToWishlist({ storeId, productId: product.productId }));
        }
    };

    const handleAddToCart = async () => {
        if (!storeId || !displayData.available) return;

        const variantId = hasVariants && selectedVariant ? selectedVariant.variantId : undefined;

        if (isAuthenticated) {
            await dispatch(addToCart({ storeId, productId: product.productId, variantId, quantity: 1 }));
            dispatch(fetchCart({ storeId }));
        } else {
            await dispatch(addToGuestCart({ storeId, productId: product.productId, variantId, quantity: 1 }));
            dispatch(fetchGuestCart({ storeId }));
        }
        setCartMessage("Added to cart");
    };

    const { displayPrice } = calculateProductTax(displayData.price, globalTax, {
        applied: displayData.taxApplied,
        rate: displayData.taxRate, effectiveRate: displayData.effectiveTaxRate,
    });
    const { displayPrice: compareDisplayPrice } = calculateProductTax(displayData.compareAtPrice, globalTax, {
        applied: displayData.taxApplied,
        rate: displayData.taxRate, effectiveRate: displayData.effectiveTaxRate,
    });

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row gap-8">
                <ProductGallery images={displayData.images} productName={product.name} />

                <div className="md:w-1/2 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                        <h1 className="text-xl font-semibold text-gray-900">{product.name}</h1>

                        <button
                            onClick={handleWishlistToggle}
                            className="flex-shrink-0 p-1.5 rounded-full border border-gray-200 hover:bg-gray-50 transition"
                            aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                        >
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill={isWishlisted ? "#e53e3e" : "none"}
                                stroke={isWishlisted ? "#e53e3e" : "#666"}
                                strokeWidth="2"
                            >
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                            </svg>
                        </button>
                    </div>

                    {product.display?.vendor && <p className="text-xs text-gray-500">Vendor: {product.display.vendor}</p>}

                    <div className="flex items-center gap-2">
                        <span className="text-xl font-semibold text-gray-900 flex items-baseline gap-2">Rs. {displayPrice}</span>
                        {displayData.compareAtPrice > displayData.price && (
                            <span className="text-sm text-gray-400 line-through">Rs. {compareDisplayPrice}</span>
                        )}
                        {displayData.compareAtPrice > displayData.price && (
                            <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">
                                {Math.round((1 - displayData.price / displayData.compareAtPrice) * 100)}% off
                            </span>
                        )}
                    </div>

                    {hasVariants && options.length > 0 && (
                        <div className="flex flex-col gap-3">
                            {options.map((option) => (
                                <div key={option.name}>
                                    <p className="text-sm font-medium text-gray-700 mb-1.5">
                                        {option.name}: <span className="font-semibold">{selectedOptions[option.name]}</span>
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {option.values.map((value) => (
                                            <button
                                                key={value}
                                                onClick={() => handleOptionChange(option.name, value)}
                                                className={`px-2.5 py-1 border rounded text-sm transition ${
                                                    selectedOptions[option.name] === value
                                                        ? "border-gray-900 bg-gray-900 text-white"
                                                        : "border-gray-300 text-gray-700 hover:border-gray-500"
                                                }`}
                                            >
                                                {value}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!displayData.available && <p className="text-xs font-semibold text-red-500">Out of Stock</p>}

                    <button
                        onClick={handleAddToCart}
                        disabled={!displayData.available}
                        className={`w-full py-2.5 px-5 rounded font-semibold text-xs tracking-wide transition ${
                            displayData.available ? "bg-gray-900 text-white hover:bg-gray-700" : "bg-gray-200 text-gray-400 cursor-not-allowed"
                        }`}
                    >
                        {displayData.available ? "ADD TO CART" : "OUT OF STOCK"}
                    </button>
                    {cartMessage && <p className="text-xs text-gray-500">{cartMessage}</p>}

                    {product.description && product.description.replace(/<[^>]*>/g, "").trim() && (
                        <div>
                            <h3 className="text-sm text-gray-900 mb-1.5">Description</h3>
                            <div className="text-xs text-gray-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: product.description }} />
                        </div>
                    )}

                    {product.display?.tags && product.display.tags.length > 0 && (
                        <div>
                            <h3 className="font-semibold text-gray-900 mb-2">Tags</h3>
                            <div className="flex flex-wrap gap-2">
                                {product.display.tags.map((tag, i) => (
                                    <span key={i} className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {relatedProducts.length > 0 && (
                <div className="mt-16">
                    <h2 className="text-xl font-bold text-gray-900 mb-6">You might also like</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {relatedProducts.slice(0, 4).map((related) => (
                            <Link
                                href={productHref(related)}
                                key={related.productId}
                                className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition block"
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={related.images?.[0] || related.image || "/placeholder-product.png"}
                                    alt={related.name}
                                    className="w-full aspect-square object-cover"
                                />
                                <div className="p-3">
                                    <p className="text-sm font-medium text-gray-900 truncate">{related.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        {related.compareAtPrice > related.price && (
                                            <span className="text-xs text-gray-400 line-through">Rs. {related.compareAtPrice.toFixed(2)}</span>
                                        )}
                                        <span className="text-sm font-semibold text-gray-900">Rs. {related.price.toFixed(2)}</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} storeId={storeId} shopName={shopName} platformName="Fype" />
        </div>
    );
}
