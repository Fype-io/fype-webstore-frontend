"use client";

import { Fragment, useEffect, useState, type MouseEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { SparkCollapsibleContentSettings, SparkCollapsibleItemBlock } from "../sparkConfig";

interface CollapsibleContentProps {
    settings: SparkCollapsibleContentSettings;
    // Already filtered for hidden and in the merchant's chosen order.
    items: SparkCollapsibleItemBlock[];
    isEditorPreview?: boolean;
    activeBlockId?: string | null;
    onBlockClick?: (id: string) => void;
}

// Full port of Fype-E-Commerce-UI's sections/CollapsibleContent.tsx
// (read-only design reference) — an FAQ-style accordion. Item is a single
// homogeneous block type capped at 12 (matches the reference's THEME_SCHEMA
// "limit": 12), same shape as Column/Slide/Banner Slide.
function initialOpenIds(items: SparkCollapsibleItemBlock[]): Set<string> {
    const flagged = items.filter((item) => item.settings.open_by_default === true).map((item) => item.id);
    if (flagged.length > 0) return new Set(flagged);
    return items[0] ? new Set([items[0].id]) : new Set();
}

export default function CollapsibleContent({ settings, items, isEditorPreview = false, activeBlockId = null, onBlockClick }: CollapsibleContentProps) {
    const defaultOpenKey = items.map((item) => `${item.id}:${item.settings.open_by_default === true}`).join("|");
    const [openIds, setOpenIds] = useState<Set<string>>(() => initialOpenIds(items));

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- re-apply the editor's Open-by-default flags
        setOpenIds(initialOpenIds(items));
        // Re-apply only when Open-by-default flags change (merchant customization).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [defaultOpenKey]);

    const toggleOpen = (id: string, e?: MouseEvent) => {
        e?.stopPropagation();
        setOpenIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    if (items.length === 0) return null;

    return (
        <section
            style={{ paddingTop: `${settings.padding_top}px`, paddingBottom: `${settings.padding_bottom}px`, backgroundColor: settings.background_color }}
            className="px-6 max-w-3xl mx-auto w-full"
        >
            <div className="text-center mb-16" style={{ color: settings.text_color }}>
                {settings.section_heading && <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{settings.section_heading}</h2>}
            </div>
            <div className="space-y-4">
                {items.map((item) => {
                    const isActive = isEditorPreview && activeBlockId === item.id;
                    const isOpen = openIds.has(item.id);
                    const content = (
                        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm" style={{ backgroundColor: settings.block_color }}>
                            <button
                                type="button"
                                onClick={(e) => toggleOpen(item.id, e)}
                                className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors group"
                            >
                                <span
                                    className="font-medium text-lg pr-4 group-hover:!text-black"
                                    style={{ color: isOpen ? settings.text_color : `${settings.text_color}cc` }}
                                    dangerouslySetInnerHTML={{ __html: item.settings.title }}
                                />
                                <span
                                    className="w-8 h-8 rounded-full flex items-center justify-center border shrink-0 transition-colors"
                                    style={{
                                        backgroundColor: isOpen ? settings.text_color : "transparent",
                                        borderColor: isOpen ? settings.text_color : `${settings.text_color}33`,
                                        color: isOpen ? settings.block_color : `${settings.text_color}99`,
                                    }}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                        {isOpen ? <path d="M5 12h14" /> : <path d="M12 5v14M5 12h14" />}
                                    </svg>
                                </span>
                            </button>
                            <AnimatePresence>
                                {isOpen && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                        <div
                                            className="p-6 border-t border-gray-100 leading-relaxed bg-black/5 [&_p]:mb-4 last:[&_p]:mb-0 [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:opacity-80 transition-opacity"
                                            style={{ color: `${settings.text_color}cc`, borderColor: `${settings.text_color}1a` }}
                                            dangerouslySetInnerHTML={{ __html: item.settings.content }}
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );

                    if (!isEditorPreview) return <Fragment key={item.id}>{content}</Fragment>;

                    return (
                        <div
                            id={`spark-block-${item.id}`}
                            key={item.id}
                            className={`relative w-full group/block cursor-pointer ${isActive ? "ring-2 ring-blue-500 rounded-sm" : "hover:ring-2 hover:ring-blue-400 rounded-sm"}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onBlockClick?.(item.id);
                            }}
                        >
                            <div
                                className={`absolute -top-5 left-0 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 whitespace-nowrap z-30 transition-opacity ${
                                    isActive ? "opacity-100" : "opacity-0 group-hover/block:opacity-100"
                                }`}
                            >
                                Item
                            </div>
                            {content}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
