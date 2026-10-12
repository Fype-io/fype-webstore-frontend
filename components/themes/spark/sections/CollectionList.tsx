"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getApi } from "@/lib/client-api";
import { COLLECTION_LIST_DEFAULTS, type SparkCollectionListSettings } from "../sparkConfig";
import { clampTileCount, collectionListGrid, safeHoverColor } from "../tileLayout";
import type { CollectionSummary } from "@/types/storefront";

interface CollectionListProps {
    settings: SparkCollectionListSettings;
    storeId: string;
    // SSR-fetched by HomePage.tsx for the collections the page was rendered
    // with (a group's collections, or the first `collections_to_show` picked
    // ones) — real customers see this immediately. Only re-fetched (below)
    // when a merchant changes the source live in the editor.
    initialCollections?: CollectionSummary[];
    // Gates the placeholder fallback below — real customers must never see
    // dummy content, only a merchant actively customizing the theme.
    isEditorPreview?: boolean;
}

const PLACEHOLDER_IMAGE =
    "https://i0.wp.com/mikeyarce.com/wp-content/uploads/2021/09/woocommerce-placeholder.png?ssl=1";

// Same convention as Featured Collection/Product's placeholder fallback.
function placeholderCollections(count: number): CollectionSummary[] {
    return Array.from({ length: count }, (_, i) => ({
        _id: `placeholder-${i + 1}`,
        name: `Collection ${i + 1}`,
        slug: `collection-${i + 1}`,
        thumbnailUrl: PLACEHOLDER_IMAGE,
    }));
}

// Full port of Fype-E-Commerce-UI's sections/CollectionList.tsx (read-only
// design reference) — real collections (picked via checkboxes in the
// editor, or all of a collection group's, resolved to real name/thumbnailUrl)
// instead of the reference's array of plain name strings. Each tile links to
// the real /collections/[slug] page. At most `collections_to_show` tiles are
// drawn; when there are more, a "View all" button leads on to the rest (the
// Collections page, filtered to the group for a group source).
export default function CollectionList({ settings, storeId, initialCollections = [], isEditorPreview = false }: CollectionListProps) {
    const limit = clampTileCount(settings.collections_to_show, 2, 12, COLLECTION_LIST_DEFAULTS.collections_to_show);
    const isGroup = settings.source === "group";
    const groupId = settings.collection_group_id ?? "";
    // Only the first `limit` picked collections are ever fetched.
    const shownIds = settings.collection_ids.slice(0, limit);

    const [collections, setCollections] = useState<CollectionSummary[]>(initialCollections);
    // What the list is built from. Changes live in the editor re-fetch; the SSR'd set is kept until then.
    const sourceKey = isGroup ? `group:${groupId}` : `pick:${shownIds.join(",")}`;
    const ssrKey = useRef(sourceKey).current;

    useEffect(() => {
        if (sourceKey === ssrKey) return;
        if (isGroup) {
            if (!groupId) {
                // eslint-disable-next-line react-hooks/set-state-in-effect -- the editor cleared the group
                setCollections([]);
                return;
            }
            let cancelled = false;
            getApi<{ data: { collections: CollectionSummary[] } }>(`/commerce/${storeId}/storefront/collection-groups/${groupId}`)
                .then((res) => !cancelled && setCollections(res.data?.data?.collections ?? []))
                .catch(() => !cancelled && setCollections([]));
            return () => {
                cancelled = true;
            };
        }
        if (shownIds.length === 0) {
            setCollections([]);
            return;
        }
        let cancelled = false;
        Promise.all(
            shownIds.map((id) =>
                getApi<{ data: { collection: CollectionSummary } }>(`/commerce/${storeId}/products/collections/${id}`)
                    .then((res) => res.data?.data?.collection ?? null)
                    .catch(() => null)
            )
        ).then((results) => {
            if (!cancelled) setCollections(results.filter((c): c is CollectionSummary => c !== null));
        });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceKey, storeId]);

    const realCollections = collections.slice(0, limit);
    // A group hands back all of its collections; a pick list is cut to `limit` before fetching.
    const hasMore = isGroup ? collections.length > limit : settings.collection_ids.length > limit;
    const displayCollections = realCollections.length > 0 ? realCollections : isEditorPreview ? placeholderCollections(limit) : [];
    const isPlaceholder = realCollections.length === 0 && displayCollections.length > 0;

    if (displayCollections.length === 0) return null;

    const showName = settings.show_collection_name ?? COLLECTION_LIST_DEFAULTS.show_collection_name;
    const hoverColor = safeHoverColor(settings.name_hover_color, COLLECTION_LIST_DEFAULTS.name_hover_color);
    const viewAllLabel = settings.goto_label || "View all";
    const viewAllHref = settings.goto_link || (isGroup && groupId ? `/collections?group=${encodeURIComponent(groupId)}` : "/collections");

    return (
        <section
            className="px-6 max-w-7xl mx-auto border-b border-gray-100 relative"
            style={{ backgroundColor: settings.background_color, paddingTop: `${settings.padding_top}px`, paddingBottom: `${settings.padding_bottom}px` }}
        >
            {isPlaceholder && (
                <div className="mb-4 text-xs text-gray-400 border border-dashed border-gray-300 rounded px-3 py-1.5 inline-block">
                    Preview content — {isGroup ? "choose a collection group" : "pick collections"} to replace this
                </div>
            )}
            <div className="flex items-end justify-between mb-12">
                {settings.section_heading && <h2 className="font-bold tracking-tight text-3xl md:text-4xl">{settings.section_heading}</h2>}
                {settings.goto_label && !hasMore && (
                    <a href={viewAllHref} className="hidden md:inline-flex font-medium items-center gap-2 hover:text-gray-500 transition-colors">
                        {settings.goto_label}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14" />
                            <path d="m12 5 7 7-7 7" />
                        </svg>
                    </a>
                )}
            </div>
            <div className={`grid gap-x-6 gap-y-12 ${collectionListGrid(settings.columns_on_desktop)}`}>
                {displayCollections.map((collection) => (
                    <Link
                        key={collection._id}
                        href={isPlaceholder ? "#" : `/collections/${collection.slug}`}
                        onClick={isPlaceholder ? (e) => e.preventDefault() : undefined}
                        className="group block cursor-pointer"
                        style={{ "--spark-name-hover": hoverColor } as React.CSSProperties}
                    >
                        <div className={`aspect-square bg-gray-50 border border-gray-100 rounded-xl overflow-hidden relative isolate ${showName ? "mb-5" : ""}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={collection.thumbnailUrl || PLACEHOLDER_IMAGE}
                                alt={collection.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                            />
                            <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors pointer-events-none" />
                        </div>
                        {showName && <h3 className="spark-tile-name font-semibold text-lg text-gray-900 text-center">{collection.name}</h3>}
                    </Link>
                ))}
            </div>
            {hasMore && !isPlaceholder && (
                <div className="mt-12 flex justify-center">
                    <a
                        href={viewAllHref}
                        className="inline-flex items-center gap-2 px-8 py-3 rounded-full border border-gray-900 font-medium hover:bg-gray-900 hover:text-white transition-colors"
                    >
                        {viewAllLabel}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14" />
                            <path d="m12 5 7 7-7 7" />
                        </svg>
                    </a>
                </div>
            )}
        </section>
    );
}
