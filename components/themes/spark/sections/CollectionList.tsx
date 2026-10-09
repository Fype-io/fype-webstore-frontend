"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getApi } from "@/lib/client-api";
import type { SparkCollectionListSettings } from "../sparkConfig";
import type { CollectionSummary } from "@/types/storefront";

interface CollectionListProps {
    settings: SparkCollectionListSettings;
    storeId: string;
    // SSR-fetched by HomePage.tsx for the collection_ids the page was
    // rendered with — real customers see this immediately. Only re-fetched
    // (below) when a merchant changes the picked collections live in the
    // editor.
    initialCollections?: CollectionSummary[];
    // Gates the placeholder fallback below — real customers must never see
    // dummy content, only a merchant actively customizing the theme.
    isEditorPreview?: boolean;
}

const PLACEHOLDER_IMAGE =
    "https://i0.wp.com/mikeyarce.com/wp-content/uploads/2021/09/woocommerce-placeholder.png?ssl=1";

// Matches the reference's own default `Collections` array length (6, always
// — independent of Columns on Desktop, which is a pure CSS layout setting,
// not an item count). Fixed rather than tied to columns_on_desktop so the
// placeholder preview shows a realistic multi-row grid instead of always
// collapsing to exactly one row.
const PLACEHOLDER_COLLECTION_COUNT = 6;

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
// editor, resolved to real name/thumbnailUrl) instead of the reference's
// array of plain name strings matched against a static `collectionImages`
// lookup table. Each tile links to the real /collections/[slug] page
// (new — the reference's own onCollectionClick has no real destination
// either). No addable blocks (matches the reference's THEME_SCHEMA), so —
// like Featured Collection/Product — the whole section is one click target
// in the editor, handled by SparkHome's existing sectionProps wrapper; no
// per-tile selection here.
export default function CollectionList({ settings, storeId, initialCollections = [], isEditorPreview = false }: CollectionListProps) {
    const [collections, setCollections] = useState<CollectionSummary[]>(initialCollections);
    // What the list is built from: a collection group's id, or the picked ids.
    // Changes live in the editor re-fetch; the SSR'd set is kept until then.
    const isGroup = settings.source === "group";
    const sourceKey = isGroup ? `group:${settings.collection_group_id ?? ""}` : `pick:${settings.collection_ids.join(",")}`;
    const ssrKey = useRef(sourceKey).current;

    useEffect(() => {
        if (sourceKey === ssrKey) return;
        if (isGroup) {
            const groupId = settings.collection_group_id;
            if (!groupId) {
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
        if (settings.collection_ids.length === 0) {
            setCollections([]);
            return;
        }
        let cancelled = false;
        Promise.all(
            settings.collection_ids.map((id) =>
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

    const displayCollections = collections.length > 0 ? collections : isEditorPreview ? placeholderCollections(PLACEHOLDER_COLLECTION_COUNT) : [];
    const isPlaceholder = collections.length === 0 && displayCollections.length > 0;

    if (displayCollections.length === 0) return null;

    const colsClass = settings.columns_on_desktop === 4 ? "lg:grid-cols-4" : settings.columns_on_desktop === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3";

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
                {settings.goto_label && (
                    <a href={settings.goto_link || (isGroup && settings.collection_group_id ? `/collections?group=${settings.collection_group_id}` : "#")} className="hidden md:inline-flex font-medium items-center gap-2 hover:text-gray-500 transition-colors">
                        {settings.goto_label}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14" />
                            <path d="m12 5 7 7-7 7" />
                        </svg>
                    </a>
                )}
            </div>
            <div className={`grid grid-cols-2 gap-x-6 gap-y-12 ${colsClass}`}>
                {displayCollections.map((collection) => (
                    <Link
                        key={collection._id}
                        href={isPlaceholder ? "#" : `/collections/${collection.slug}`}
                        onClick={isPlaceholder ? (e) => e.preventDefault() : undefined}
                        className="group block cursor-pointer"
                    >
                        <div className="aspect-square bg-gray-50 border border-gray-100 rounded-xl overflow-hidden mb-5 relative isolate">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={collection.thumbnailUrl || PLACEHOLDER_IMAGE}
                                alt={collection.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                            />
                            <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors pointer-events-none" />
                        </div>
                        <h3 className="font-semibold text-lg text-gray-900 group-hover:text-blue-600 transition-colors">{collection.name}</h3>
                    </Link>
                ))}
            </div>
        </section>
    );
}
