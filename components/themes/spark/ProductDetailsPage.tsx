"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Heart, Minus, Plus, RefreshCw, Shield, Truck } from "lucide-react";
import type { ProductDetailsPageProps } from "@/components/themes/registry";
import Footer from "./sections/Footer";
import ProductGallery from "./ProductGallery";
import { buildSparkNavItems, mergeSparkConfig, sparkDefaultConfig, type SparkConfigOverride } from "./sparkConfig";
import { SPARK_BLOCK_CLICKED, SPARK_DRAFT_READY, SPARK_DRAFT_UPDATE, SPARK_SECTION_CLICKED, SPARK_SET_ACTIVE_BLOCK, SPARK_SET_ACTIVE_SECTION, type SparkActiveBlock } from "./SparkHome";
import AuthModal from "@/components/shared/AuthModal";
import { calculateProductTax } from "@/utils/taxCalculator";
import { resolveCustomLink } from "@/utils/resolveCustomLink";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { addToCart, addToGuestCart, addToWishlist, fetchCart, fetchGuestCart, removeFromWishlist } from "@/redux/slices/userSlice";
import SparkHeaderShell from "./SparkHeaderShell";
import { sparkLayoutStyle } from "./sparkLayout";
import { useSparkCart } from "./SparkCartContext";
import type { SparkProductHighlight } from "./sparkConfig";
import { useStoreCurrency } from "@/components/shared/StoreCurrency";
import { isEditorMessage, isEditorPreview as isEditorPreviewFrame, postToEditor } from "@/lib/editor-preview";

const NEW_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const HIGHLIGHT_ICONS = [Truck, RefreshCw, Shield];

function ProductHighlights({ highlights, compact }: { highlights: SparkProductHighlight[]; compact?: boolean }) {
    const filled = highlights.filter((h) => h.title.trim());
    if (filled.length === 0) return null;
    return (
        <div className={`grid grid-cols-1 gap-4 border-t border-gray-100 ${compact ? "pt-6" : "pt-8"}`}>
            {filled.map((h, i) => {
                const Icon = HIGHLIGHT_ICONS[i % HIGHLIGHT_ICONS.length];
                return (
                    <div key={`${h.title}-${i}`} className="flex flex-col gap-1">
                        <div className="flex items-center gap-3 text-sm font-semibold text-gray-900">
                            <Icon size={18} strokeWidth={1.5} /> {h.title}
                        </div>
                        {h.text.trim() ? <p className="text-sm text-gray-500 pl-7">{h.text}</p> : null}
                    </div>
                );
            })}
        </div>
    );
}

// Same real data/redux contract as theme_one's ProductDetailsView (variant
// resolution, guest-vs-authenticated cart dispatch, wishlist toggle) —
// restyled to match the Spark design reference (generic option buttons
// standing in for its hardcoded "size" selector, quantity stepper, gallery
// with thumbnails).
//
// Unlike Shop/Collections/Collection Page, no separate Server/Client split
// wrapper exists here — this component was already "use client" (variant
// selection, cart dispatch), so the live-editing postMessage listener is
// embedded directly instead of adding a redundant wrapper layer.
export default function ProductDetailsPage({ shop, navPages, allPages, product, variants, variantOptions, relatedProducts, themeConfig }: ProductDetailsPageProps) {
    const { prefix } = useStoreCurrency();
    const dispatch = useAppDispatch();
    const { isAuthenticated, wishlist } = useAppSelector((state) => state.user);
    const { openCart } = useSparkCart();

    const [liveConfig, setLiveConfig] = useState(() => mergeSparkConfig(sparkDefaultConfig, themeConfig));
    const [isEditorPreview, setIsEditorPreview] = useState(false);
    const [isSelected, setIsSelected] = useState(false);
    const [activeBlock, setActiveBlock] = useState<SparkActiveBlock | null>(null);
    const [hoveringLayout, setHoveringLayout] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined" || window.parent === window) return;
        if (!isEditorPreviewFrame()) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsEditorPreview(true);

        function handleMessage(event: MessageEvent) {
            if (!isEditorMessage(event) || !event.data) return;
            if (event.data.type === SPARK_DRAFT_UPDATE) {
                setLiveConfig((current) => mergeSparkConfig(current, event.data.config as SparkConfigOverride));
            } else if (event.data.type === SPARK_SET_ACTIVE_SECTION) {
                setIsSelected(event.data.section === "page_settings:product");
            } else if (event.data.type === SPARK_SET_ACTIVE_BLOCK) {
                setActiveBlock((event.data.block as SparkActiveBlock | null) ?? null);
            }
        }

        window.addEventListener("message", handleMessage);
        postToEditor({ type: SPARK_DRAFT_READY, config: liveConfig });
        return () => window.removeEventListener("message", handleMessage);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const settings = liveConfig.page_settings.product;
    // Header/Footer are global across every Spark page, not Home-only — see
    // SparkShop.tsx's identical comment for the full rationale.
    const { footer } = liveConfig.sections;
    const { logo: logoSettings, social_media: socialMedia } = liveConfig.theme_settings;

    const selectLayout = () => {
        postToEditor({ type: SPARK_SECTION_CLICKED, section: "page_settings:product" });
    };
    const selectHeader = () => {
        postToEditor({ type: SPARK_SECTION_CLICKED, section: "header" });
    };
    const selectFooter = () => {
        postToEditor({ type: SPARK_SECTION_CLICKED, section: "footer" });
    };
    const selectFooterBlock = (kind: "text" | "menu", id: string) => {
        const block = { sectionId: "footer", kind, id };
        setActiveBlock(block);
        postToEditor({ type: SPARK_BLOCK_CLICKED, block });
    };
    const selectAnnouncementBlock = (id: string) => {
        const block = { sectionId: "header", kind: "announcement", id };
        setActiveBlock(block);
        postToEditor({ type: SPARK_BLOCK_CLICKED, block });
    };

    const isWishlisted = !!product && wishlist.includes(product.productId);
    const hasVariants = product?.hasVariants ?? false;
    const options = variantOptions?.options ?? [];
    const globalTax = shop.settings?.tax;

    // All hooks must run unconditionally (before the `!product` early return
    // below) — guarded internally with optional chaining instead.
    const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
        const init: Record<string, string> = {};
        if (hasVariants) {
            options.forEach((opt) => {
                if (opt.values.length > 0) init[opt.name] = opt.values[0];
            });
        }
        return init;
    });
    const [quantity, setQuantity] = useState(1);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [cartMessage, setCartMessage] = useState<string | null>(null);
    const [optionError, setOptionError] = useState(false);

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
        if (!product) return { price: 0, compareAtPrice: 0, taxApplied: false, taxRate: undefined, images: [] as string[], available: false };

        const continueSelling = product.inventory?.continueSelling ?? product.continueSellWhenOutOfStock ?? false;
        if (hasVariants && selectedVariant) {
            const variantImages = selectedVariant.image?.filter((img) => img && img.trim() !== "") ?? [];
            return {
                price: selectedVariant.price,
                compareAtPrice: selectedVariant.compareAtPrice,
                taxApplied: product.price.taxApplied,
                taxRate: product.price.taxRate,
                images: variantImages.length > 0 ? variantImages : product.images ?? [],
                available: (selectedVariant.inventory?.available ?? 0) > 0 || continueSelling,
            };
        }
        return {
            price: product.price.price,
            compareAtPrice: product.price.compareAtPrice,
            taxApplied: product.price.taxApplied,
            taxRate: product.price.taxRate,
            images: product.images ?? [],
            available: (product.inventory?.available ?? 0) > 0 || continueSelling,
        };
    }, [hasVariants, selectedVariant, product]);

    const [prevVariant, setPrevVariant] = useState(selectedVariant);
    if (selectedVariant !== prevVariant) {
        setPrevVariant(selectedVariant);
        setCartMessage(null);
    }

    const navigation = buildSparkNavItems(navPages);

    if (!product) {
        return (
            <div className="spark-page-layout bg-white text-black min-h-screen" style={sparkLayoutStyle(liveConfig.theme_settings.layout)}>
                <SparkHeaderShell
                    config={liveConfig}
                    navItems={navigation}
                    shop={shop}
                    isEditorPreview={isEditorPreview}
                    activeBlockId={activeBlock?.sectionId === "header" ? activeBlock.id : null}
                    onAnnouncementClick={selectAnnouncementBlock}
                    onHeaderClick={selectHeader}
                />
                <div className="flex justify-center items-center min-h-[50vh] text-black/60">Product not found</div>
                {!footer.hidden && (
                    <div className="spark-layout-section" id="spark-section-footer" onClick={isEditorPreview ? selectFooter : undefined}>
                        <Footer
                            settings={footer.settings}
                            blocks={footer.blocks.filter((b) => !b.hidden)}
                            navItems={navigation}
                            socialMedia={socialMedia}
                            footerLogoUrl={logoSettings.footer_logo_url}
                            footerLogoWidth={logoSettings.footer_logo_width}
                            isEditorPreview={isEditorPreview}
                            activeBlockId={activeBlock?.sectionId === "footer" ? activeBlock.id : null}
                            onBlockClick={selectFooterBlock}
                        />
                    </div>
                )}
            </div>
        );
    }

    const handleOptionChange = (name: string, value: string) => {
        setSelectedOptions((prev) => ({ ...prev, [name]: value }));
        setOptionError(false);
    };

    const handleWishlistToggle = () => {
        // Real cart/wishlist mutations must never fire while the editor
        // iframe is open, matching the same disableQuickAdd/disableAddToCart
        // convention every other product-card call site already uses — the
        // button stays visible (not hidden), just inert.
        if (isEditorPreview) return;
        if (!isAuthenticated) {
            setIsAuthModalOpen(true);
            return;
        }
        if (isWishlisted) dispatch(removeFromWishlist({ storeId: shop.shopId, productId: product.productId }));
        else dispatch(addToWishlist({ storeId: shop.shopId, productId: product.productId }));
    };

    const handleAddToCart = async () => {
        if (!displayData.available || isEditorPreview || !product) return;
        if (hasVariants && !selectedVariant) {
            setOptionError(true);
            return;
        }
        const variantId = hasVariants && selectedVariant ? selectedVariant.variantId : undefined;

        try {
            if (isAuthenticated) {
                await dispatch(addToCart({ storeId: shop.shopId, productId: product.productId, variantId, quantity })).unwrap();
                dispatch(fetchCart({ storeId: shop.shopId }));
            } else {
                await dispatch(addToGuestCart({ storeId: shop.shopId, productId: product.productId, variantId, quantity })).unwrap();
                dispatch(fetchGuestCart({ storeId: shop.shopId }));
            }
            openCart();
            setCartMessage("Added to cart");
        } catch {
            setCartMessage("Could not add to cart");
        }
    };

    const { displayPrice } = calculateProductTax(displayData.price, globalTax, { applied: displayData.taxApplied, rate: displayData.taxRate });
    const { displayPrice: compareDisplayPrice } = calculateProductTax(displayData.compareAtPrice, globalTax, {
        applied: displayData.taxApplied,
        rate: displayData.taxRate,
    });

    const hasDescription = Boolean(product.description && product.description.replace(/<[^>]*>/g, "").trim());
    const highlights = settings.highlights ?? [];
    const showHighlights = highlights.some((h) => h.title.trim());
    const showDescBlock = settings.show_description && hasDescription;
    const showBelowTitle = settings.description_position === "Below Product Title" && (showDescBlock || showHighlights);
    const showBelowCart = settings.description_position !== "Below Product Title" && (showDescBlock || showHighlights);
    const isNew = !!product.createdAt && Date.now() - new Date(product.createdAt).getTime() < NEW_WINDOW_MS;
    const showWishlist = settings.show_wishlist !== false;

    // Determine custom link target: an internal page (same-tab nav) or a
    // validated external URL (new-tab nav) — see resolveCustomLink.
    const pagesToSearch = allPages || navPages;
    const resolvedCustomLink = resolveCustomLink(settings.custom_link_page_id, settings.custom_link_url, pagesToSearch);

    const customLinkClassName = "text-sm text-gray-500 underline underline-offset-4 hover:text-black";
    const customLink =
        settings.custom_link_label && resolvedCustomLink ? (
            resolvedCustomLink.external ? (
                <a href={resolvedCustomLink.href} target="_blank" rel="noopener noreferrer" className={customLinkClassName}>
                    {settings.custom_link_label}
                </a>
            ) : (
                <Link href={resolvedCustomLink.href} className={customLinkClassName}>
                    {settings.custom_link_label}
                </Link>
            )
        ) : null;

    return (
        <div className="spark-page-layout bg-white text-black min-h-screen pb-20 overflow-x-clip" style={sparkLayoutStyle(liveConfig.theme_settings.layout)}>
            <SparkHeaderShell
                config={liveConfig}
                navItems={navigation}
                shop={shop}
                isEditorPreview={isEditorPreview}
                activeBlockId={activeBlock?.sectionId === "header" ? activeBlock.id : null}
                onAnnouncementClick={selectAnnouncementBlock}
                onHeaderClick={selectHeader}
            />

            <div
                className="relative spark-layout-section"
                onClick={isEditorPreview ? selectLayout : undefined}
                onMouseOver={isEditorPreview ? () => setHoveringLayout(true) : undefined}
                onMouseLeave={isEditorPreview ? () => setHoveringLayout(false) : undefined}
            >
                {isEditorPreview && (isSelected || hoveringLayout) && (
                    <div className="absolute inset-0 pointer-events-none z-60 border-2 border-blue-500 transition-colors">
                        {isSelected && (
                            <div className="absolute top-0 left-0 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 flex items-center gap-1 z-65">
                                <span className="material-symbols-outlined text-xs">widgets</span> Product Page Layout
                            </div>
                        )}
                        {hoveringLayout && (
                            <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px] flex flex-col items-center justify-center transition-opacity">
                                <div className="bg-white px-6 py-4 rounded-xl shadow-xl border border-gray-100 flex flex-col items-center pointer-events-auto">
                                    <span className="material-symbols-outlined text-2xl text-gray-400 mb-2">widgets</span>
                                    <h3 className="font-semibold text-lg text-gray-900 leading-tight">Product Page Layout</h3>
                                    <p className="text-sm text-gray-500 text-center max-w-xs mt-1">Click to edit Product Page layout settings.</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

            {settings.show_breadcrumb && (
                <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center text-sm text-gray-500 min-w-0">
                    <Link href="/products" className="hover:text-black transition-colors shrink-0">
                        Shop
                    </Link>
                    <ChevronRight size={14} className="mx-2 shrink-0" />
                    <span className="text-black truncate min-w-0">{product.name}</span>
                </div>
            )}

            <div
                className="w-full mx-auto px-4 sm:px-6 py-8 md:py-12 flex flex-col md:flex-row gap-8 md:gap-16 min-w-0"
                style={{ maxWidth: "var(--spark-page-width)" }}
            >
                <ProductGallery images={displayData.images} productName={product.name} imageLayout={settings.image_layout} isNew={isNew} />

                <div className="w-full md:w-1/2 min-w-0 flex flex-col pt-0 md:pt-4">
                    <div className="mb-8">
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 mb-4 break-words">{product.name}</h1>
                        <p className="text-2xl text-gray-500 font-medium break-words">
                            {prefix}{displayPrice}
                            {displayData.compareAtPrice > displayData.price && (
                                <span className="text-lg text-gray-400 line-through ml-2">{prefix}{compareDisplayPrice}</span>
                            )}
                        </p>

                        {showBelowTitle && (
                            <div className="mt-6 space-y-6">
                                {showDescBlock && (
                                    <div className="prose prose-sm max-w-none overflow-hidden break-words text-gray-500">
                                        <div dangerouslySetInnerHTML={{ __html: product.description }} />
                                    </div>
                                )}
                                <ProductHighlights highlights={highlights} compact />
                            </div>
                        )}
                    </div>

                    <div className="space-y-8 mb-10">
                        {hasVariants && options.length > 0 && (
                            <div className="space-y-6">
                                {options.map((option, optionIndex) => (
                                    <div key={option.name}>
                                        <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center mb-3 min-w-0">
                                            <span className="text-sm font-semibold uppercase tracking-wider text-gray-900 flex items-center gap-2 min-w-0">
                                                <span className="truncate">{option.name}</span>
                                                {optionError && optionIndex === 0 && (
                                                    <span className="text-xs font-medium text-red-500 lowercase tracking-normal shrink-0">(please choose an option)</span>
                                                )}
                                            </span>
                                            {optionIndex === 0 ? <span className="shrink-0">{customLink}</span> : null}
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-3">
                                            {option.values.map((value) => (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    onClick={() => handleOptionChange(option.name, value)}
                                                    className={`h-12 px-1.5 sm:px-2 min-w-0 border flex items-center justify-center text-xs sm:text-sm text-center leading-tight break-words transition-all rounded spark-font-body ${
                                                        selectedOptions[option.name] === value
                                                            ? "border-black bg-black text-white font-medium"
                                                            : optionError
                                                              ? "border-red-300 text-gray-700 hover:border-black"
                                                              : "border-gray-200 text-gray-700 hover:border-black"
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

                        {!hasVariants && customLink ? <div className="flex justify-end">{customLink}</div> : null}

                        <div>
                            <span className="text-sm font-semibold uppercase tracking-wider text-gray-900 block mb-3">Quantity</span>
                            <div className="flex items-center border border-gray-200 rounded w-32 h-12">
                                <button
                                    type="button"
                                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                                    className="flex-1 flex items-center justify-center hover:bg-gray-50 transition-colors h-full text-gray-500"
                                >
                                    <Minus size={16} />
                                </button>
                                <div className="flex-1 flex items-center justify-center font-medium h-full border-x border-gray-200">{quantity}</div>
                                <button
                                    type="button"
                                    onClick={() => setQuantity((q) => q + 1)}
                                    className="flex-1 flex items-center justify-center hover:bg-gray-50 transition-colors h-full text-gray-500"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {!displayData.available && <p className="text-xs font-semibold text-red-500 mb-4">Out of stock</p>}

                    <div className="flex items-stretch sm:items-center gap-2 sm:gap-3 mb-8">
                        <button
                            type="button"
                            onClick={handleAddToCart}
                            disabled={!displayData.available || isEditorPreview}
                            className={`flex-1 min-w-0 py-4 px-3 text-sm sm:text-base rounded-xl font-medium tracking-wide transition-colors shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed spark-font-body ${
                                displayData.available ? "bg-black text-white hover:bg-gray-900" : "bg-gray-200 text-gray-400 cursor-not-allowed"
                            }`}
                        >
                            {displayData.available ? "Add to Cart" : "Out of Stock"}
                        </button>
                        {showWishlist && (
                            <button
                                type="button"
                                onClick={handleWishlistToggle}
                                disabled={isEditorPreview}
                                className={`w-14 h-14 shrink-0 rounded-xl border flex items-center justify-center transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
                                    isWishlisted
                                        ? "border-red-200 bg-red-50/70 text-red-500 hover:bg-red-100/70"
                                        : "border-gray-200 bg-white text-gray-700 hover:border-black hover:text-black shadow-sm"
                                }`}
                                aria-label={isWishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
                                title={isWishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
                            >
                                <Heart size={22} className={`transition-transform duration-200 ${isWishlisted ? "scale-110 fill-current text-red-500" : ""}`} />
                            </button>
                        )}
                    </div>
                    {cartMessage && <p className="text-sm text-gray-500 mb-6">{cartMessage}</p>}

                    {showBelowCart && (
                        <div className="space-y-8 mb-8">
                            {showDescBlock && (
                                <div className="prose prose-sm max-w-none overflow-hidden break-words text-gray-500">
                                    <div dangerouslySetInnerHTML={{ __html: product.description }} />
                                </div>
                            )}
                            <ProductHighlights highlights={highlights} />
                        </div>
                    )}

                    {product.display?.tags && product.display.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {product.display.tags.map((tag, i) => (
                                <span key={i} className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {relatedProducts.length > 0 && (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-8">
                    <h2 className="text-xl font-bold mb-6">You might also like</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
                        {relatedProducts.slice(0, 4).map((related) => (
                            <Link href={`/products/${related.productId}`} key={related.productId} className="group block">
                                <div className="aspect-square bg-gray-50 border border-gray-100 rounded-xl overflow-hidden mb-3">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={related.images?.[0] || related.image || "/placeholder-product.png"}
                                        alt={related.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                </div>
                                <p className="text-sm font-medium text-gray-900 truncate">{related.name}</p>
                                <p className="text-sm text-gray-500 mt-1">{prefix}{related.price}</p>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
            </div>

            {!footer.hidden && (
                <div className="spark-layout-section" id="spark-section-footer" onClick={isEditorPreview ? selectFooter : undefined}>
                    <Footer
                        settings={footer.settings}
                        blocks={footer.blocks.filter((b) => !b.hidden)}
                        navItems={navigation}
                        socialMedia={socialMedia}
                        footerLogoUrl={logoSettings.footer_logo_url}
                        footerLogoWidth={logoSettings.footer_logo_width}
                        isEditorPreview={isEditorPreview}
                        activeBlockId={activeBlock?.sectionId === "footer" ? activeBlock.id : null}
                        onBlockClick={selectFooterBlock}
                    />
                </div>
            )}

            <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} storeId={shop.shopId} shopName={shop.shopName} platformName="Fype" />
        </div>
    );
}
