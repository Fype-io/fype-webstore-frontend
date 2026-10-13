"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Header from "./Header";
import Footer from "./sections/Footer";
import { COLLECTIONS_PAGE_NAME_HOVER_DEFAULT, mergeSparkConfig, type SparkConfig, type SparkConfigOverride } from "./sparkConfig";
import { collectionsPageGrid, safeHoverColor } from "./tileLayout";
import { getApi } from "@/lib/client-api";
import { SPARK_BLOCK_CLICKED, SPARK_DRAFT_READY, SPARK_DRAFT_UPDATE, SPARK_SECTION_CLICKED, SPARK_SET_ACTIVE_BLOCK, SPARK_SET_ACTIVE_SECTION, type SparkActiveBlock } from "./SparkHome";
import type { CollectionTile, ShopIdentity } from "@/types/storefront";
import SparkHeaderShell from "./SparkHeaderShell";
import { sparkLayoutStyle } from "./sparkLayout";
import { li } from "motion/react-client";
import { isEditorMessage, isEditorPreview as isEditorPreviewFrame, postToEditor } from "@/lib/editor-preview";

const PLACEHOLDER_IMAGE = "https://i0.wp.com/mikeyarce.com/wp-content/uploads/2021/09/woocommerce-placeholder.png?ssl=1";

const TILES_PER_CHUNK = 12;

interface SparkCollectionsProps {
    initialConfig: SparkConfig;
    shop: ShopIdentity;
    navItems: Array<{ label: string; href: string }>;
    // The first chunk of tiles. For the whole Collections page, more are loaded from the API as the
    // visitor scrolls (`hasMore`); for one group's view (`heading` set) all of the group's tiles are
    // here already and are simply revealed a chunk at a time.
    collections: CollectionTile[];
    hasMore?: boolean;
    // Set by the group view, which reuses this layout with the group's own
    // title/description instead of the Collections page settings.
    heading?: string;
    subheading?: string;
}

// Client Component — same live-editing + canvas hover/selected overlay
// pattern as SparkShop.tsx (see that file's comments for the full
// rationale): SPARK_DRAFT_UPDATE keeps page_settings.collections live,
// SPARK_SET_ACTIVE_SECTION (already broadcast by the parent on every
// activeItemId change, not Home-scoped) drives the persistent
// selected-state border + label, and clicking anywhere in the content area
// posts SPARK_SECTION_CLICKED with the 'page_settings:collections' sentinel
// to open the sidebar's "Layout" row.
export default function SparkCollections({ initialConfig, shop, navItems, collections, hasMore = false, heading, subheading }: SparkCollectionsProps) {
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
    const gridClass = collectionsPageGrid(settings.collections_per_row);
    const hoverColor = safeHoverColor(settings.name_hover_color, COLLECTIONS_PAGE_NAME_HOVER_DEFAULT);

    // Infinite scroll. Group view: every tile is already here, reveal a chunk at a time. Whole
    // Collections page: fetch the next chunk from the API when the sentinel below comes into view.
    const groupView = heading !== undefined;
    const [tiles, setTiles] = useState<CollectionTile[]>(collections);
    const [visibleCount, setVisibleCount] = useState(TILES_PER_CHUNK);
    const [serverHasMore, setServerHasMore] = useState(hasMore);
    const nextPage = useRef(2);
    const loadingRef = useRef(false);
    const sentinelRef = useRef<HTMLDivElement>(null);

    const shownTiles = groupView ? tiles.slice(0, visibleCount) : tiles;
    const moreToShow = groupView ? visibleCount < tiles.length : serverHasMore;

    const loadMore = useCallback(async () => {
        if (loadingRef.current) return;
        if (groupView) {
            setVisibleCount((n) => n + TILES_PER_CHUNK);
            return;
        }
        loadingRef.current = true;
        try {
            const res = await getApi<{ data: { items: CollectionTile[]; pagination?: { hasNextPage?: boolean } } }>(
                `/commerce/${shop.shopId}/storefront/collections?page=${nextPage.current}&limit=${TILES_PER_CHUNK}`
            );
            const incoming = res.data?.data?.items ?? [];
            nextPage.current += 1;
            setTiles((current) => {
                const have = new Set(current.map((t) => `${t.kind}:${t._id}`));
                return [...current, ...incoming.filter((t) => !have.has(`${t.kind}:${t._id}`))];
            });
            setServerHasMore(res.data?.data?.pagination?.hasNextPage === true && incoming.length > 0);
        } catch {
            // Stop here rather than retrying in a loop; the tiles already shown stay.
            setServerHasMore(false);
        } finally {
            loadingRef.current = false;
        }
    }, [groupView, shop.shopId]);

    // Re-observed after every chunk, so a still-visible sentinel (a short page) asks for the next one.
    useEffect(() => {
        const node = sentinelRef.current;
        if (!node || !moreToShow || typeof IntersectionObserver === "undefined") return;
        const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && void loadMore(), { rootMargin: "400px" });
        observer.observe(node);
        return () => observer.disconnect();
    }, [moreToShow, loadMore, shownTiles.length]);

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
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">{heading ?? settings.page_title}</h1>
                    <p className="text-gray-500 text-lg max-w-xl mx-auto">{subheading ?? settings.subtitle}</p>
                </div>

                {shownTiles.length > 0 ? (
                    <>
                    <div className={`grid gap-8 ${gridClass}`}>
                        {shownTiles.map((collection) => (
                            <Link
                                key={`${collection.kind}:${collection._id}`}
                                href={collection.kind === "group" ? `/collections?group=${encodeURIComponent(collection.slug)}` : `/collections/${collection.slug}`}
                                className="group cursor-pointer block"
                                style={{ "--spark-name-hover": hoverColor } as React.CSSProperties}
                            >
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
                                    <div className="flex items-center justify-center gap-3 px-2">
                                        <h2 className="spark-tile-name text-2xl font-bold text-gray-900 text-center">
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
                    {moreToShow && (
                        <div ref={sentinelRef} className="mt-12 flex justify-center" data-testid="collections-sentinel">
                            {typeof IntersectionObserver === "undefined" && (
                                <button type="button" onClick={() => void loadMore()} className="px-8 py-3 rounded-full border border-gray-900 font-medium hover:bg-gray-900 hover:text-white transition-colors">
                                    Show more
                                </button>
                            )}
                        </div>
                    )}
                    </>
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
                        storeName={shop.shopName}
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
