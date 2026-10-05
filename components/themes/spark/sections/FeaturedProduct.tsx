"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getApi } from "@/lib/client-api";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { addToCart, addToGuestCart, fetchCart, fetchGuestCart } from "@/redux/slices/userSlice";
import { calculateProductTax } from "@/utils/taxCalculator";
import type { SparkFeaturedProductSettings } from "../sparkConfig";
import type { ProductDetail, ProductVariant, TaxSettings } from "@/types/storefront";
import { useSparkCart } from "../SparkCartContext";
import { useStoreCurrency } from "@/components/shared/StoreCurrency";

type FeaturedProductDetail = ProductDetail & { variants?: ProductVariant[] };

interface FeaturedProductProps {
    settings: SparkFeaturedProductSettings;
    storeId: string;
    globalTax?: TaxSettings;
    // SSR-fetched by HomePage.tsx for the product_id the page was rendered
    // with — real customers see this immediately. Only re-fetched (below)
    // when a merchant changes the product live in the editor.
    initialProduct?: FeaturedProductDetail | null;
    // Gates the placeholder fallback below — real customers must never see
    // dummy content, only a merchant actively customizing the theme.
    isEditorPreview?: boolean;
}

const PLACEHOLDER_IMAGE =
    "https://i0.wp.com/mikeyarce.com/wp-content/uploads/2021/09/woocommerce-placeholder.png?ssl=1";

// Obviously-fake stand-in so a merchant customizing before picking a real
// product still sees a populated section to design against — same
// convention as Featured Collection's placeholderProducts. Never rendered
// outside isEditorPreview.
function placeholderProduct(): FeaturedProductDetail {
    return {
        productId: "placeholder-1",
        name: "Product 1",
        description: "<p>Placeholder product — pick a real product in the editor to replace this.</p>",
        images: [PLACEHOLDER_IMAGE],
        hasVariants: false,
        continueSellWhenOutOfStock: true,
        skuCode: "",
        barCode: "",
        price: { price: 0, compareAtPrice: 0, taxApplied: false },
        display: {},
        inventory: { available: 0, continueSelling: true },
    };
}

// Real single-product spotlight — matches the reference's
// FeaturedProduct.tsx layout (image + content side by side, image_position
// swaps sides) but with real product data (description/price/stock) instead
// of the reference's 5 hardcoded mock products keyed off a slug string, and
// a real quantity stepper + Add to Cart (the reference's +/- buttons and
// "Add to Cart" button are both decorative, no state/handler at all).
// Variant products skip quantity/Add to Cart — no variant picker in a
// single-product spotlight — and link to the PDP instead, same rule as
// Featured Collection's Quick Add. Share stays decorative, matching the
// reference exactly (its own Share button has no onClick either).
export default function FeaturedProduct({ settings, storeId, globalTax, initialProduct = null, isEditorPreview = false }: FeaturedProductProps) {
    const { prefix } = useStoreCurrency();
    const dispatch = useAppDispatch();
    const { isAuthenticated } = useAppSelector((state) => state.user);
    const { openCart } = useSparkCart();
    const [product, setProduct] = useState<FeaturedProductDetail | null>(initialProduct);
    const [quantity, setQuantity] = useState(1);
    const [adding, setAdding] = useState(false);
    const [added, setAdded] = useState(false);
    const ssrKey = useRef(settings.product_id).current;

    useEffect(() => {
        // If the editor switched back to the original SSR product id, restore
        // the SSR-provided `initialProduct` instead of skipping update; the
        // previous implementation returned early which left the `product`
        // state pointing at whatever was last fetched (commonly the other
        // product), causing the canvas to not reflect the reverted selection.
        if (settings.product_id === ssrKey) {
            setQuantity(1);
            setProduct(initialProduct ?? null);
            return;
        }
        setQuantity(1);
        if (!settings.product_id) {
            setProduct(null);
            return;
        }
        let cancelled = false;
        getApi<{ data: { data: { product: FeaturedProductDetail } } }>(`/commerce/${storeId}/product/${settings.product_id}`)
            .then((res) => {
                if (!cancelled) setProduct(res.data?.data?.data?.product ?? null);
            })
            .catch(() => {
                if (!cancelled) setProduct(null);
            });
        return () => {
            cancelled = true;
        };
    }, [settings.product_id, storeId, initialProduct, ssrKey]);

    const isPlaceholder = !product && isEditorPreview;
    const displayProduct = product ?? (isPlaceholder ? placeholderProduct() : null);
    const [copied, setCopied] = useState(false);

    if (!displayProduct) return null;

    const image = displayProduct.images?.[0] || PLACEHOLDER_IMAGE;
    const variants = displayProduct.variants ?? [];
    const prices = variants.map((v) => v.price ?? 0);
    const minPrice = displayProduct.hasVariants && prices.length ? Math.min(...prices) : displayProduct.price.price;
    const compareAtPrice = displayProduct.hasVariants ? 0 : displayProduct.price.compareAtPrice;
    const { displayPrice } = calculateProductTax(minPrice, globalTax, { applied: displayProduct.price.taxApplied, rate: displayProduct.price.taxRate });
    const { displayPrice: compareDisplayPrice } = calculateProductTax(compareAtPrice, globalTax, {
        applied: displayProduct.price.taxApplied,
        rate: displayProduct.price.taxRate,
    });

    const available = displayProduct.inventory?.available ?? 0;
    const inStock = available > 0 || displayProduct.continueSellWhenOutOfStock || !!displayProduct.inventory?.continueSelling;

    // Show the quick-cart UI (quantity + primary button) even in editor
    // preview so merchants can see layout; guard the actual add-to-cart
    // action when `isEditorPreview` is true so no real cart requests fire.
    const showQuickCart = settings.show_add_to_cart && !isPlaceholder && !displayProduct.hasVariants;
    const productHref = `/products/${displayProduct.productId}`;

    const handleShareClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const url = `${window.location.origin}${productHref}`;
            console.log('[FeaturedProduct] attempting share/copy for url:', url);
            // Native share first
            if ((navigator as any).share) {
                try {
                    await (navigator as any).share({ title: displayProduct.name || 'Product', text: displayProduct.description?.replace(/<[^>]*>/g, '') || displayProduct.name || '', url });
                    return;
                } catch (err) {
                    console.warn('native share failed, falling back to copy', err);
                }
            }

            let didCopy = false;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                try {
                    await navigator.clipboard.writeText(url);
                    didCopy = true;
                } catch (err) {
                    console.warn('navigator.clipboard failed', err);
                }
            }

            if (!didCopy) {
                try {
                    const ta = document.createElement('textarea');
                    ta.value = url;
                    ta.setAttribute('readonly', '');
                    ta.style.position = 'fixed';
                    ta.style.left = '-9999px';
                    document.body.appendChild(ta);
                    ta.select();
                    ta.setSelectionRange(0, ta.value.length);
                    const ok = document.execCommand('copy');
                    document.body.removeChild(ta);
                    didCopy = !!ok;
                } catch (err) {
                    console.warn('execCommand fallback failed', err);
                }
            }

            if (!didCopy) {
                try {
                    // eslint-disable-next-line no-alert
                    window.prompt('Copy this link', url);
                } catch (err) {
                    console.warn('prompt fallback failed', err);
                }
            } else {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        } catch (err) {
            console.error('Failed to copy/share link', err);
        }
    };

    const handleAddToCart = async () => {
        if (adding) return;
        setAdding(true);
        try {
            if (isAuthenticated) {
                await dispatch(addToCart({ storeId, productId: displayProduct.productId, quantity })).unwrap();
                dispatch(fetchCart({ storeId }));
            } else {
                await dispatch(addToGuestCart({ storeId, productId: displayProduct.productId, quantity })).unwrap();
                dispatch(fetchGuestCart({ storeId }));
            }
            openCart();
            setAdded(true);
            setTimeout(() => setAdded(false), 1500);
        } catch {
            // cart error surfaces via redux
        } finally {
            setAdding(false);
        }
    };

    const ImageBlock = (
        <div className="w-full lg:w-1/2">
            <Link
                href={productHref}
                className="block w-full aspect-square bg-gray-50 rounded-2xl lg:rounded-3xl overflow-hidden relative isolate group shadow-sm border border-gray-100"
                aria-disabled={isPlaceholder}
                onClick={(e) => {
                    if (isPlaceholder) e.preventDefault();
                }}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt={displayProduct.name} className="w-full h-full object-cover transition-transform duration-1000 ease-out lg:group-hover:scale-105" />
            </Link>
        </div>
    );

    const ContentBlock = (
        <div className="flex flex-col w-full lg:w-1/2 pt-6 lg:pt-10">
            {isPlaceholder && (
                <div className="mb-4 text-xs text-gray-400 border border-dashed border-gray-300 rounded px-3 py-1.5 inline-block self-start">
                    Preview content — pick a product to replace this
                </div>
            )}
            {settings.section_heading && <h2 className="text-sm font-bold tracking-widest uppercase text-gray-500 mb-2">{settings.section_heading}</h2>}
            <h3 className="font-medium tracking-tight text-gray-900 mb-3 md:mb-4 text-4xl lg:text-5xl">{displayProduct.name}</h3>

            {settings.show_price && (
                <div className="flex items-center gap-4 mt-1 mb-8">
                    {displayProduct.hasVariants && <span className="text-sm text-gray-400">From</span>}
                    <p className="text-xl md:text-2xl font-light text-gray-500">
                        {compareAtPrice > 0 && <span className="line-through text-gray-400 mr-2">{prefix}{compareDisplayPrice}</span>}{prefix}{displayPrice}
                    </p>
                    <span
                        className={`px-3 py-1 text-[10px] uppercase font-bold tracking-widest rounded-sm ${inStock ? "bg-black text-white" : "bg-gray-200 text-gray-500"}`}
                    >
                        {inStock ? "In Stock" : "Out of Stock"}
                    </span>
                </div>
            )}

            {settings.show_description && displayProduct.description && displayProduct.description.replace(/<[^>]*>/g, "").trim() && (
                <div className="text-gray-600 mb-8 leading-relaxed" dangerouslySetInnerHTML={{ __html: displayProduct.description }} />
            )}

            {settings.show_add_to_cart && (
                <>
                    {showQuickCart ? (
                        <>
                            <div className="mb-10 lg:mb-12">
                                <label className="block text-xs font-normal text-gray-700 mb-2">Quantity</label>
                                <div className="flex items-center border border-gray-400 w-[140px] h-12 bg-transparent justify-between px-2 rounded-full">
                                    <button
                                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                                        className="w-10 h-10 flex items-center justify-center text-gray-800 hover:bg-gray-100 rounded-full transition-colors"
                                        aria-label="Decrease quantity"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                            <path d="M5 12h14" />
                                        </svg>
                                    </button>
                                    <span className="flex-1 flex items-center justify-center text-sm font-medium text-gray-900 border-none bg-transparent">{quantity}</span>
                                    <button
                                        onClick={() => setQuantity((q) => q + 1)}
                                        className="w-10 h-10 flex items-center justify-center text-gray-800 hover:bg-gray-100 rounded-full transition-colors"
                                        aria-label="Increase quantity"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                            <path d="M12 5v14M5 12h14" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={(e) => {
                                    if (isEditorPreview) return;
                                    handleAddToCart();
                                }}
                                disabled={isEditorPreview || adding || !inStock}
                                aria-disabled={isEditorPreview || !inStock}
                                className="w-full bg-black text-white py-4 px-8 rounded-full font-medium hover:bg-gray-800 transition-colors text-base mb-12 disabled:opacity-50"
                            >
                                {!inStock ? "Out of Stock" : isEditorPreview ? "Add to Cart" : added ? "Added" : adding ? "Adding…" : "Add to Cart"}
                            </button>
                        </>
                    ) : (
                        <Link
                            href={productHref}
                            className="w-full text-center bg-black text-white py-4 px-8 rounded-full font-medium hover:bg-gray-800 transition-colors text-base mb-12"
                            aria-disabled={isPlaceholder}
                            onClick={(e) => {
                                if (isPlaceholder) e.preventDefault();
                            }}
                        >
                            {displayProduct.hasVariants
                                ? "Select Options"
                                : settings.show_add_to_cart
                                ? "Add to Cart"
                                : "View Product"
                            }
                        </Link>
                    )}
                </>
            )}

            <div className="flex items-center justify-between text-sm text-gray-500 w-full font-light pt-0 border-none">
                <button onClick={handleShareClick} className="flex items-center gap-2 hover:text-black transition-colors group" aria-label="Share product">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-y-[1px] transition-transform">
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
                    </svg>
                    <span>{copied ? 'Copied' : 'Share'}</span>
                </button>
                <Link
                    href={productHref}
                    className="flex items-center gap-2 hover:text-black transition-colors group"
                    aria-disabled={isPlaceholder}
                    onClick={(e) => {
                        if (isPlaceholder) e.preventDefault();
                    }}
                >
                    <span className="group-hover:underline underline-offset-4 decoration-1">View full details</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 transition-transform">
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                    </svg>
                </Link>
            </div>
        </div>
    );

    return (
        <section
            className="border-y border-gray-100"
            style={{
                backgroundColor: settings.background_color,
                paddingTop: `${settings.padding_top}px`,
                paddingBottom: `${settings.padding_bottom}px`,
            }}
        >
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex flex-col lg:flex-row gap-6 lg:gap-24 items-start">
                    {settings.image_position === "Right" ? (
                        <>
                            {ContentBlock}
                            {ImageBlock}
                        </>
                    ) : (
                        <>
                            {ImageBlock}
                            {ContentBlock}
                        </>
                    )}
                </div>
            </div>
        </section>
    );
}
