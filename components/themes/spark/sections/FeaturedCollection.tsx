"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getApi } from "@/lib/client-api";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { addToCart, addToGuestCart, fetchCart, fetchGuestCart } from "@/redux/slices/userSlice";
import { calculateProductTax } from "@/utils/taxCalculator";
import type { SparkFeaturedCollectionSettings } from "../sparkConfig";
import type { CollectionSummary, StorefrontProduct, TaxSettings } from "@/types/storefront";
import { useSparkCart } from "../SparkCartContext";
import { useStoreCurrency } from "@/components/shared/StoreCurrency";

interface FeaturedCollectionProps {
    settings: SparkFeaturedCollectionSettings;
    storeId: string;
    globalTax?: TaxSettings;
    // SSR-fetched by HomePage.tsx for the collection_id the page was
    // rendered with — real customers see this immediately, no client fetch
    // on first paint. Only re-fetched (below) when a merchant changes the
    // collection/count live in the editor, since draft edits never
    // round-trip through the server.
    initialProducts?: StorefrontProduct[];
    initialCollection?: CollectionSummary | null;
    // Gates the placeholder fallback below — real customers must never see
    // dummy content, only a merchant actively customizing the theme.
    isEditorPreview?: boolean;
}

const PLACEHOLDER_IMAGE =
    "https://i0.wp.com/mikeyarce.com/wp-content/uploads/2021/09/woocommerce-placeholder.png?ssl=1";

// Obviously-fake stand-ins so a merchant customizing an empty/un-configured
// section still sees a populated grid to design against (matches the
// reference's always-populated mock content), instead of empty space with
// no clue what the section will look like once real data exists. Never
// rendered outside isEditorPreview — see the two guards below.
function placeholderProducts(count: number): StorefrontProduct[] {
    return Array.from({ length: count }, (_, i) => ({
        productId: `placeholder-${i + 1}`,
        name: `Product ${i + 1}`,
        slug: `product-${i + 1}`,
        image: PLACEHOLDER_IMAGE,
        images: [PLACEHOLDER_IMAGE],
        price: 0,
        compareAtPrice: 0,
        hasDiscount: false,
        discountPercentage: 0,
        hasVariants: false,
    }));
}

interface FeaturedProductCardProps {
    product: StorefrontProduct;
    storeId: string;
    globalTax?: TaxSettings;
    // True for both the editor's fake placeholder items AND real products
    // while the editor iframe is open — Quick Add must never fire a real
    // cart mutation against a placeholder id, and (kept simple, same as
    // every other section here) live-editing doesn't need a working cart
    // either, so the whole affordance is just hidden in preview.
    disableQuickAdd: boolean;
}

// No wishlist heart and a hover "Quick Add" bar (desktop) / floating "+"
// (mobile) that adds straight to cart — matches the reference's
// FeaturedCollection.tsx card exactly (its mock onAddToCart), unlike Spark's
// shared ProductCard (wishlist heart, no quick add) used by ProductsPage.
// Real add-to-cart wiring reuses ProductDetailsPage.tsx's exact
// auth-vs-guest dispatch pattern. Variant products skip Quick Add entirely
// (no variant picker in a grid card) and just link through to the PDP like
// the rest of the card already does.
function FeaturedProductCard({ product, storeId, globalTax, disableQuickAdd }: FeaturedProductCardProps) {
    const { prefix } = useStoreCurrency();
    const dispatch = useAppDispatch();
    const { isAuthenticated } = useAppSelector((state) => state.user);
    const { openCart } = useSparkCart();
    const [adding, setAdding] = useState(false);
    const [added, setAdded] = useState(false);

    const productImage = product.image || product.images?.[0] || PLACEHOLDER_IMAGE;
    const { displayPrice } = calculateProductTax(product.price, globalTax, { applied: product.taxApplied, rate: product.taxRate });
    const { displayPrice: compareDisplayPrice } = calculateProductTax(product.compareAtPrice, globalTax, {
        applied: product.taxApplied,
        rate: product.taxRate,
    });

    const showQuickAdd = !disableQuickAdd && !product.hasVariants;

    const handleQuickAdd = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (adding) return;
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
            <Link href={`/products/${product.productId}`} className="block">
                <div className="aspect-square bg-gray-50 border border-gray-100 rounded-xl overflow-hidden mb-5 relative isolate">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={productImage}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    />
                    {product.hasDiscount && (
                        <span className="absolute top-4 left-4 bg-black text-white text-[10px] uppercase font-bold px-2 py-1 rounded-sm z-10 tracking-wider">
                            {product.discountPercentage}% off
                        </span>
                    )}

                    {showQuickAdd && (
                        <>
                            <div className="hidden md:block absolute inset-x-4 bottom-4 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 z-10">
                                <button
                                    onClick={handleQuickAdd}
                                    className="w-full bg-white/95 backdrop-blur-sm text-black font-medium py-3 rounded shadow-sm hover:bg-white hover:shadow-md transition-all disabled:opacity-60"
                                    disabled={adding}
                                >
                                    {added ? "Added" : adding ? "Adding…" : "Quick Add"}
                                </button>
                            </div>
                            <button
                                onClick={handleQuickAdd}
                                disabled={adding}
                                className="md:hidden absolute bottom-2 right-2 w-10 h-10 bg-[#111] rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-transform z-20 disabled:opacity-60"
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
                    <h3 className="font-medium text-gray-900 group-hover:text-gray-500 transition-colors truncate">{product.name}</h3>
                    <div className="flex items-center gap-2 mt-1.5">
                        {product.hasDiscount && <p className="text-gray-400 text-sm line-through">{prefix}{compareDisplayPrice}</p>}
                        <p className="text-gray-500">{prefix}{displayPrice}</p>
                    </div>
                </div>
            </Link>
        </div>
    );
}

// Real product grid — matches the reference's FeaturedCollection.tsx card
// (own inline markup, not Spark's shared ProductCard) exactly: no wishlist
// heart, hover "Quick Add" bar on desktop, floating "+" on mobile. Unlike
// Header/Image Banner/Rich Text, this section has no addable blocks (matches
// the reference's THEME_SCHEMA exactly) and no per-block canvas selection —
// the whole section is one click target, handled by SparkHome's existing
// sectionProps wrapper.
export default function FeaturedCollection({
    settings,
    storeId,
    globalTax,
    initialProducts = [],
    initialCollection = null,
    isEditorPreview = false,
}: FeaturedCollectionProps) {
    const [products, setProducts] = useState<StorefrontProduct[]>(initialProducts);
    const [collection, setCollection] = useState<CollectionSummary | null>(initialCollection);
    const ssrKey = useRef(`${settings.collection_id}:${settings.products_to_show}`).current;

    useEffect(() => {
        const key = `${settings.collection_id}:${settings.products_to_show}`;
        if (key === ssrKey) return;
        if (!settings.collection_id) {
            setProducts([]);
            setCollection(null);
            return;
        }
        let cancelled = false;
        Promise.all([
            getApi<{ data: { products: StorefrontProduct[] } }>(
                `/commerce/${storeId}/products/collections/${settings.collection_id}/storefront-products?limit=${settings.products_to_show}`
            ),
            getApi<{ data: { collection: CollectionSummary } }>(
                `/commerce/${storeId}/products/collections/${settings.collection_id}`
            ),
        ])
            .then(([productsResponse, collectionResponse]) => {
                if (!cancelled) {
                    setProducts(productsResponse.data?.data?.products ?? []);
                    setCollection(collectionResponse.data?.data?.collection ?? null);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setProducts([]);
                    setCollection(null);
                }
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings.collection_id, settings.products_to_show, storeId]);

    // No collection picked yet, or the picked one currently has no real
    // products — real customers see nothing (never dummy content); a
    // merchant actively customizing sees a placeholder grid instead, so the
    // section doesn't look broken/empty while they're setting it up. The
    // instant a real collection with real products is selected, `products`
    // (real data) takes over — this branch stops applying entirely.
    const displayProducts = products.length > 0 ? products : isEditorPreview ? placeholderProducts(settings.products_to_show) : [];
    const isPlaceholder = products.length === 0 && displayProducts.length > 0;
    const defaultCollectionLink = collection?.slug ? `/collections/${collection.slug}` : "#";
    const gotoLink = !settings.goto_link || settings.goto_link === "/products" ? defaultCollectionLink : settings.goto_link;

    if (displayProducts.length === 0) return null;

    return (
        <section
            className="relative w-full border-t border-gray-100"
            style={{
                backgroundColor: settings.background_color,
                paddingTop: `${settings.padding_top}px`,
                paddingBottom: `${settings.padding_bottom}px`,
            }}
        >
            <div className="px-6 max-w-7xl mx-auto">
                {isPlaceholder && (
                    <div className="mb-4 text-xs text-gray-400 border border-dashed border-gray-300 rounded px-3 py-1.5 inline-block">
                        Preview content — pick a collection with products to replace this
                    </div>
                )}
                <div className="flex items-end justify-between mb-12">
                    <h2 className="font-bold tracking-tight text-3xl md:text-4xl">{settings.section_heading}</h2>
                    {settings.goto_label && (
                        <a
                            href={gotoLink}
                            className="hidden md:inline-flex font-medium items-center gap-2 hover:text-gray-500 transition-colors"
                        >
                            {settings.goto_label}
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12h14" />
                                <path d="m12 5 7 7-7 7" />
                            </svg>
                        </a>
                    )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8 md:gap-y-12">
                    {displayProducts.map((product) => (
                        <FeaturedProductCard
                            key={product.productId}
                            product={product}
                            storeId={storeId}
                            globalTax={globalTax}
                            disableQuickAdd={isPlaceholder || isEditorPreview}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}
