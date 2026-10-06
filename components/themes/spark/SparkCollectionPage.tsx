"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "./Header";
import Footer from "./sections/Footer";
import ProductCard from "./ProductCard";
import Slideshow from "./sections/Slideshow";
import { mergeSparkConfig, type SparkConfig, type SparkConfigOverride, type SparkSlideBlock } from "./sparkConfig";
import { SPARK_BLOCK_CLICKED, SPARK_DRAFT_READY, SPARK_DRAFT_UPDATE, SPARK_SECTION_CLICKED, SPARK_SET_ACTIVE_BLOCK, SPARK_SET_ACTIVE_SECTION, type SparkActiveBlock } from "./SparkHome";
import type { CollectionSummary, ShopIdentity, StorefrontProduct, TaxSettings } from "@/types/storefront";
import SparkHeaderShell from "./SparkHeaderShell";
import { sparkLayoutStyle } from "./sparkLayout";
import { isEditorMessage, isEditorPreview as isEditorPreviewFrame, postToEditor } from "@/lib/editor-preview";

const PLACEHOLDER_IMAGE = "https://i0.wp.com/mikeyarce.com/wp-content/uploads/2021/09/woocommerce-placeholder.png?ssl=1";

const PRODUCTS_PER_ROW_CLASSES: Record<"2" | "3" | "4", string> = {
    "2": "grid-cols-2",
    "3": "grid-cols-2 md:grid-cols-3",
    "4": "grid-cols-2 md:grid-cols-4",
};

// Same isEditorPreview-gated stand-ins as FeaturedCollection.tsx's
// placeholderProducts — a merchant customizing a collection with no
// products yet (or, with isPlaceholderCollection, no collections at all)
// still sees a populated grid to design against. Never rendered outside
// isEditorPreview.
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

interface SparkCollectionPageProps {
    initialConfig: SparkConfig;
    shop: ShopIdentity;
    navItems: Array<{ label: string; href: string }>;
    collection: CollectionSummary;
    products: StorefrontProduct[];
    globalTax?: TaxSettings;
    storeId: string;
}

// Client Component — same live-editing + canvas hover/selected overlay
// pattern as SparkShop.tsx/SparkCollections.tsx (see those files' comments
// for the full rationale). Resolution order for the top banner: a Dynamic
// Banner (hero_overrides entry matched to this collection's real _id) →
// Image Banner (default_banner_images, a global fallback) → neither → no
// banner section at all, straight to the title — confirmed explicitly, a
// deliberate departure from the reference's own CollectionDetail.tsx, which
// falls back further to the collection's own thumbnail when literally
// nothing has ever been configured; we never render that "dead" default.
export default function SparkCollectionPage({
    initialConfig,
    shop,
    navItems,
    collection,
    products,
    globalTax,
    storeId,
}: SparkCollectionPageProps) {
    const [liveConfig, setLiveConfig] = useState(initialConfig);
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
                setIsSelected(event.data.section === "page_settings:collection_page");
            } else if (event.data.type === SPARK_SET_ACTIVE_BLOCK) {
                setActiveBlock((event.data.block as SparkActiveBlock | null) ?? null);
            }
        }

        window.addEventListener("message", handleMessage);
        postToEditor({ type: SPARK_DRAFT_READY, config: initialConfig });
        return () => window.removeEventListener("message", handleMessage);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const settings = liveConfig.page_settings.collection_page;

    const matchedOverride = settings.hero_overrides.find((o) => o.collection_id === collection._id);

    let heroImages: string[] = [];
    if (matchedOverride) {
        heroImages = matchedOverride.hero_images.filter((img) => Boolean(img && img.trim()));
    } else {
        heroImages = settings.default_banner_images.filter((img) => Boolean(img && img.trim()));
    }

    const heroHeading = matchedOverride?.heading || settings.banner_heading;
    const heroText = matchedOverride?.text || settings.banner_text;

    const bannerSlides: SparkSlideBlock[] = heroImages.map((img, i) => ({
        id: `collection_hero_${i}`,
        settings: {
            image_url: img,
            overlay_color: "#000000",
            overlay_opacity: 40,
            text: heroText,
            heading: heroHeading,
            button_text: "",
            button_style: "Outline",
            button_color: "#ffffff",
            button_text_color: "#000000",
            button_link: "#",
        },
    }));

    const gridClass = PRODUCTS_PER_ROW_CLASSES[settings.products_per_row];

    // No per-instance real fallback exists for Section Title (unlike Shop's
    // page_title/Collections' page_title, this is a genuinely global
    // override) — an empty Section Title falls back to the real collection's
    // own name so distinct real collections keep distinct page titles until
    // a merchant deliberately overrides it, rather than every collection
    // page silently converging on the same generic label.
    const sectionTitle = settings.section_title || collection.name;

    const displayProducts = products.length > 0 ? products : isEditorPreview ? placeholderProducts(4) : [];

    // Header/Footer are global across every Spark page, not Home-only — see
    // SparkShop.tsx's identical comment for the full rationale.
    const { footer } = liveConfig.sections;
    const { logo: logoSettings, social_media: socialMedia } = liveConfig.theme_settings;
    // const visibleAnnouncementBlocks = announcementBar.settings.show ? announcementBar.settings.blocks.filter((b) => !b.hidden) : [];

    const selectLayout = () => {
        postToEditor({ type: SPARK_SECTION_CLICKED, section: "page_settings:collection_page" });
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

    return (
        <div className="spark-page-layout bg-white text-black min-h-screen" style={sparkLayoutStyle(liveConfig.theme_settings.layout)}>
            <SparkHeaderShell
                config={liveConfig}
                navItems={navItems}
                shop={shop}
                isEditorPreview={isEditorPreview}
                activeBlockId={activeBlock?.sectionId === "header" ? activeBlock.id : null}
                onAnnouncementClick={(id) => {
                    const block = { sectionId: "header", kind: "announcement", id };
                    setActiveBlock(block);
                    postToEditor({ type: SPARK_BLOCK_CLICKED, block });
                }}
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
                                <span className="material-symbols-outlined text-xs">widgets</span> Collection Page Layout
                            </div>
                        )}
                        {hoveringLayout && (
                            <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px] flex flex-col items-center justify-center transition-opacity">
                                <div className="bg-white px-6 py-4 rounded-xl shadow-xl border border-gray-100 flex flex-col items-center pointer-events-auto">
                                    <span className="material-symbols-outlined text-2xl text-gray-400 mb-2">widgets</span>
                                    <h3 className="font-semibold text-lg text-gray-900 leading-tight">Collection Page Layout</h3>
                                    <p className="text-sm text-gray-500 text-center max-w-xs mt-1">Click to edit Collection Page layout settings.</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="py-12 md:py-20 px-6 max-w-7xl mx-auto min-h-screen">
                    <Link
                        href="/collections"
                        className="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase hover:text-gray-500 transition-colors mb-10"
                    >
                        <span className="material-symbols-outlined text-base">arrow_back</span> Back to Collections
                    </Link>

                    {bannerSlides.length > 0 && (
                        <div className="mb-16">
                            <Slideshow
                                settings={{ style: "Sleek", color: "#ffffff", padding_top: 0, padding_bottom: 0 }}
                                slides={bannerSlides}
                            />
                        </div>
                    )}

                    <div className="flex items-center justify-between mb-8">
                        {sectionTitle && <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{sectionTitle}</h2>}
                        {settings.show_product_count && <span className="text-gray-500 font-medium">{products.length} Products</span>}
                    </div>

                    {displayProducts.length > 0 ? (
                        <div className={`grid gap-x-6 gap-y-12 ${gridClass}`}>
                            {displayProducts.map((product) => (
                                <ProductCard
                                    key={product.productId}
                                    product={product}
                                    globalTax={globalTax}
                                    storeId={storeId}
                                    showName={settings.show_product_name}
                                    showPrice={settings.show_price}
                                    showBadges={settings.show_badges}
                                    disableQuickAdd={isEditorPreview}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20">
                            <p className="text-gray-500 text-lg">No products in this collection yet</p>
                        </div>
                    )}
                </div>
            </div>

            {!footer.hidden && (
                <div className="spark-layout-section" id="spark-section-footer" onClick={isEditorPreview ? selectFooter : undefined}>
                    <Footer
                        settings={footer.settings}
                        blocks={footer.blocks.filter((b) => !b.hidden)}
                        navItems={navItems}
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
