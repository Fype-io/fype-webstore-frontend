"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "./Header";
import Footer from "./sections/Footer";
import { mergeSparkConfig, type SparkConfig, type SparkConfigOverride } from "./sparkConfig";
import { SPARK_BLOCK_CLICKED, SPARK_DRAFT_READY, SPARK_DRAFT_UPDATE, SPARK_SECTION_CLICKED, SPARK_SET_ACTIVE_BLOCK, SPARK_SET_ACTIVE_SECTION, type SparkActiveBlock } from "./SparkHome";
import type { CollectionSummary, ShopIdentity } from "@/types/storefront";
import SparkHeaderShell from "./SparkHeaderShell";
import { sparkLayoutStyle } from "./sparkLayout";
import { li } from "motion/react-client";
import { isEditorMessage, isEditorPreview as isEditorPreviewFrame, postToEditor } from "@/lib/editor-preview";

const PLACEHOLDER_IMAGE = "https://i0.wp.com/mikeyarce.com/wp-content/uploads/2021/09/woocommerce-placeholder.png?ssl=1";

const COLLECTIONS_PER_ROW_CLASSES: Record<"2" | "3", string> = {
    "2": "grid-cols-1 md:grid-cols-2",
    "3": "grid-cols-1 md:grid-cols-3",
};

interface SparkCollectionsProps {
    initialConfig: SparkConfig;
    shop: ShopIdentity;
    navItems: Array<{ label: string; href: string }>;
    collections: CollectionSummary[];
}

// Client Component — same live-editing + canvas hover/selected overlay
// pattern as SparkShop.tsx (see that file's comments for the full
// rationale): SPARK_DRAFT_UPDATE keeps page_settings.collections live,
// SPARK_SET_ACTIVE_SECTION (already broadcast by the parent on every
// activeItemId change, not Home-scoped) drives the persistent
// selected-state border + label, and clicking anywhere in the content area
// posts SPARK_SECTION_CLICKED with the 'page_settings:collections' sentinel
// to open the sidebar's "Layout" row.
export default function SparkCollections({ initialConfig, shop, navItems, collections }: SparkCollectionsProps) {
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
                setIsSelected(event.data.section === "page_settings:collections");
            } else if (event.data.type === SPARK_SET_ACTIVE_BLOCK) {
                setActiveBlock((event.data.block as SparkActiveBlock | null) ?? null);
            }
        }

        window.addEventListener("message", handleMessage);
        postToEditor({ type: SPARK_DRAFT_READY, config: initialConfig });
        return () => window.removeEventListener("message", handleMessage);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const settings = liveConfig.page_settings.collections;
    const gridClass = COLLECTIONS_PER_ROW_CLASSES[settings.collections_per_row];

    // Header/Footer are global across every Spark page, not Home-only — see
    // SparkShop.tsx's identical comment for the full rationale.
    const { footer } = liveConfig.sections;
    const { logo: logoSettings, social_media: socialMedia } = liveConfig.theme_settings;
    // const visibleAnnouncementBlocks = announcementBar.settings.show ? announcementBar.settings.blocks.filter((b) => !b.hidden) : [];

    const selectLayout = () => {
        postToEditor({ type: SPARK_SECTION_CLICKED, section: "page_settings:collections" });
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
                            <span className="material-symbols-outlined text-xs">widgets</span> Collections Layout
                        </div>
                    )}
                    {hoveringLayout && (
                        <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px] flex flex-col items-center justify-center transition-opacity">
                            <div className="bg-white px-6 py-4 rounded-xl shadow-xl border border-gray-100 flex flex-col items-center pointer-events-auto">
                                <span className="material-symbols-outlined text-2xl text-gray-400 mb-2">widgets</span>
                                <h3 className="font-semibold text-lg text-gray-900 leading-tight">Collections Layout</h3>
                                <p className="text-sm text-gray-500 text-center max-w-xs mt-1">Click to edit Collections layout settings.</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
            <div className="py-12 md:py-16 px-6 max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">{settings.page_title}</h1>
                    <p className="text-gray-500 text-lg max-w-xl mx-auto">{settings.subtitle}</p>
                </div>

                {collections.length > 0 ? (
                    <div className={`grid gap-8 ${gridClass}`}>
                        {collections.map((collection) => (
                            <Link key={collection._id} href={`/collections/${collection.slug}`} className="group cursor-pointer block">
                                <div className="aspect-[4/3] bg-gray-50 rounded-2xl overflow-hidden mb-6 relative border border-gray-100 shadow-sm isolate">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={collection.thumbnailUrl || PLACEHOLDER_IMAGE}
                                        alt={collection.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                    />
                                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />
                                </div>
                                {settings.show_collection_name && (
                                    <div className="flex items-center justify-between px-2">
                                        <h2 className="text-2xl font-bold text-gray-900 group-hover:text-gray-500 transition-colors">
                                            {collection.name}
                                        </h2>
                                        {/* Inline SVG, not lucide-react (not a dependency here) — same
                                            substitution CollectionList.tsx already made for ArrowRight. */}
                                        <svg
                                            width="24"
                                            height="24"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="text-gray-400 group-hover:text-black group-hover:translate-x-1 transition-all"
                                        >
                                            <path d="M5 12h14" />
                                            <path d="m12 5 7 7-7 7" />
                                        </svg>
                                    </div>
                                )}
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20">
                        <p className="text-gray-500 text-lg">No collections yet</p>
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
