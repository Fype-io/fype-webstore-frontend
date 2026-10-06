"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import Header from "./Header";
import Footer from "./sections/Footer";
import ProductCard from "./ProductCard";
import ProductFilters from "./ProductFilters";
import { mergeSparkConfig, type SparkConfig, type SparkConfigOverride } from "./sparkConfig";
import { SPARK_BLOCK_CLICKED, SPARK_DRAFT_READY, SPARK_DRAFT_UPDATE, SPARK_SECTION_CLICKED, SPARK_SET_ACTIVE_BLOCK, SPARK_SET_ACTIVE_SECTION, type SparkActiveBlock } from "./SparkHome";
import type { PaginationMeta, ShopIdentity, StorefrontProduct } from "@/types/storefront";
import SparkHeaderShell from "./SparkHeaderShell";
import { sparkLayoutStyle } from "./sparkLayout";
import { isEditorMessage, isEditorPreview as isEditorPreviewFrame, postToEditor } from "@/lib/editor-preview";

const PRODUCTS_PER_ROW_CLASSES: Record<"2" | "3" | "4", string> = {
    "2": "grid-cols-2",
    "3": "grid-cols-2 md:grid-cols-3",
    "4": "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
};

interface SparkShopProps {
    initialConfig: SparkConfig;
    shop: ShopIdentity;
    navItems: Array<{ label: string; href: string }>;
    products: StorefrontProduct[];
    pagination?: PaginationMeta | null;
    searchParams: {
        category?: string;
        minPrice?: string;
        maxPrice?: string;
        sortBy?: string;
        search?: string;
        page?: string;
    };
}

// Client Component so it can hold live-editing state and listen for
// postMessage draft updates, same pattern/gating as SparkHome.tsx (only
// activates inside an iframe with a verified preview token — real customer traffic
// never registers the listener). The parent already broadcasts
// SPARK_SET_ACTIVE_SECTION on every activeItemId change regardless of which
// page is loaded (SparkCustomizeTheme.tsx's sync effect isn't Home-scoped),
// so listening for it here — keyed on the 'page_settings:shop' sentinel —
// is enough to show a persistent selected-state outline once the sidebar's
// "Shop Layout" row (or the canvas click below) opens the panel, matching
// the reference's isSelected treatment (a blue border + top-left label that
// stays up, separate from the hover-only "Click to edit" card).
export default function SparkShop({ initialConfig, shop, navItems, products, pagination, searchParams }: SparkShopProps) {
    const [liveConfig, setLiveConfig] = useState(initialConfig);
    // Gates Quick Add — same "no real cart mutation while a merchant is just
    // designing" convention as FeaturedCollection.tsx's FeaturedProductCard.
    const [isEditorPreview, setIsEditorPreview] = useState(false);
    const [isSelected, setIsSelected] = useState(false);
    const [activeBlock, setActiveBlock] = useState<SparkActiveBlock | null>(null);

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
                setIsSelected(event.data.section === "page_settings:shop");
            } else if (event.data.type === SPARK_SET_ACTIVE_BLOCK) {
                setActiveBlock((event.data.block as SparkActiveBlock | null) ?? null);
            }
        }

        window.addEventListener("message", handleMessage);
        postToEditor({ type: SPARK_DRAFT_READY, config: initialConfig });
        return () => window.removeEventListener("message", handleMessage);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Tracks hover explicitly (rather than pure CSS group-hover) so the
    // "Shop Layout" edit prompt shows on hover anywhere in the content area
    // — including directly over a product card, matching the reference
    // exactly (its own mock cards get the same treatment; Quick Add and the
    // edit prompt are allowed to show at once there too).
    const [hoveringLayout, setHoveringLayout] = useState(false);

    const settings = liveConfig.page_settings.shop;
    // Header/Footer are global across every Spark page, not Home-only — same
    // liveConfig.sections.header/footer + theme_settings.social_media/logo
    // resolution as SparkHome.tsx, just without Home's per-block click-to-
    // select editing wiring (Header/Footer aren't independently editable
    // outside Home; Shop only has its own single "Shop Layout" panel).
    const { footer } = liveConfig.sections;
    const { logo: logoSettings, social_media: socialMedia } = liveConfig.theme_settings;
    // const visibleAnnouncementBlocks = announcementBar.settings.show ? announcementBar.settings.blocks.filter((b) => !b.hidden) : [];
    const globalTax = shop.settings?.tax;
    const page = searchParams.page ? Number(searchParams.page) : 1;
    const gridClass = PRODUCTS_PER_ROW_CLASSES[settings.products_per_row];

    const buildPageHref = (targetPage: number) => {
        const qs = new URLSearchParams();
        if (searchParams.category) qs.set("category", searchParams.category);
        if (searchParams.minPrice) qs.set("minPrice", searchParams.minPrice);
        if (searchParams.maxPrice) qs.set("maxPrice", searchParams.maxPrice);
        if (searchParams.sortBy) qs.set("sortBy", searchParams.sortBy);
        if (searchParams.search) qs.set("search", searchParams.search);
        qs.set("page", String(targetPage));
        return `/products?${qs.toString()}`;
    };

    // Bubbles up from anywhere in the content area (including real clicks on
    // filters/products — harmless, just an extra sync alongside whatever
    // that click already does locally) so hovering/clicking the canvas opens
    // the same "Shop Layout" panel the sidebar row does. Matches the
    // reference's own Shop/Collections/Product "layout preview" region
    // exactly (ThemeCustomizePage.tsx's hover card + "Click to edit ...
    // layout settings" prompt), adapted for a real (not mock) rendered page.
    const selectShopLayout = () => {
        postToEditor({ type: SPARK_SECTION_CLICKED, section: "page_settings:shop" });
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
                onClick={isEditorPreview ? selectShopLayout : undefined}
                onMouseOver={isEditorPreview ? () => setHoveringLayout(true) : undefined}
                onMouseLeave={isEditorPreview ? () => setHoveringLayout(false) : undefined}
            >
            {isEditorPreview && (isSelected || hoveringLayout) && (
                <div className="absolute inset-0 pointer-events-none z-60 border-2 border-blue-500 transition-colors">
                    {isSelected && (
                        <div className="absolute top-0 left-0 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 flex items-center gap-1 z-65">
                            <span className="material-symbols-outlined text-xs">widgets</span> Shop Layout
                        </div>
                    )}
                    {hoveringLayout && (
                        <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px] flex flex-col items-center justify-center transition-opacity">
                            <div className="bg-white px-6 py-4 rounded-xl shadow-xl border border-gray-100 flex flex-col items-center pointer-events-auto">
                                <span className="material-symbols-outlined text-2xl text-gray-400 mb-2">widgets</span>
                                <h3 className="font-semibold text-lg text-gray-900 leading-tight">Shop Layout</h3>
                                <p className="text-sm text-gray-500 text-center max-w-xs mt-1">Click to edit Shop layout settings.</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
            <div className="py-12 md:py-20 px-6 max-w-7xl mx-auto min-h-screen">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-12 gap-8 border-b border-gray-100 pb-8">
                    <div className={settings.page_title_alignment === "Center" ? "w-full text-center" : ""}>
                        {settings.show_page_title && (
                            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{settings.page_title}</h1>
                        )}
                        <p className="text-gray-500 mt-2">{pagination?.totalItems ?? products.length} products</p>
                    </div>
                    <ProductFilters defaultSort={settings.default_sort} />
                </div>

                {products.length > 0 ? (
                    <>
                        <div className={`grid ${gridClass} gap-x-6 gap-y-12`}>
                            {products.map((product, i) => (
                                <motion.div
                                    key={product.productId}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05, duration: 0.5 }}
                                >
                                    <ProductCard
                                        product={product}
                                        globalTax={globalTax}
                                        storeId={shop.shopId}
                                        showName={settings.show_product_name}
                                        showPrice={settings.show_price}
                                        showBadges={settings.show_badges}
                                        disableQuickAdd={isEditorPreview}
                                    />
                                </motion.div>
                            ))}
                        </div>

                        {pagination && pagination.totalPages > 1 && (
                            <div className="flex items-center justify-center gap-4 mt-12">
                                {pagination.hasPrevPage && (
                                    <Link href={buildPageHref(page - 1)} className="px-6 py-3 border border-gray-200 rounded-lg font-medium hover:border-black transition-colors">
                                        Previous
                                    </Link>
                                )}
                                <span className="text-sm text-gray-500">
                                    Page {pagination.currentPage} of {pagination.totalPages}
                                </span>
                                {pagination.hasNextPage && (
                                    <Link href={buildPageHref(page + 1)} className="px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-900 transition-colors">
                                        Next
                                    </Link>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-20">
                        <span className="material-symbols-outlined text-6xl text-gray-200 mb-4 block">search_off</span>
                        <p className="text-gray-500 text-lg mb-2">No products found</p>
                        <p className="text-gray-400 text-sm">Try adjusting your filters or search query</p>
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
