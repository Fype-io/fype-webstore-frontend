"use client";

import { Fragment } from "react";
import type { SparkImageWithTextBlock, SparkImageWithTextSettings } from "../sparkConfig";
import { sanitizeRichText } from "@/lib/sanitizeRichText";

type ButtonBlock = Extract<SparkImageWithTextBlock, { type: "Button" }>;

function resolveImageWithTextLink(value: string): { href: string; external: boolean } {
    const href = value.trim();
    if (href === "/shop" || href === "/shops") return { href: "/products", external: false };
    const external = /^(https?:\/\/|\/\/|www\.)/i.test(href) || /^[\w-]+(?:\.[\w-]+)+(?:\/|$)/i.test(href);
    if (!external) return { href, external: false };
    if (/^https?:\/\//i.test(href)) return { href, external: true };
    return { href: `https://${href.replace(/^\/\//, "")}`, external: true };
}

interface ImageWithTextProps {
    settings: SparkImageWithTextSettings;
    // Already filtered for hidden and in the merchant's chosen order — Image
    // is pulled out of the flow below (always independently positioned by
    // its own image_position, matching the reference), the rest render in
    // array order with consecutive Buttons grouped into one flex row.
    blocks: SparkImageWithTextBlock[];
    isEditorPreview?: boolean;
    activeBlockId?: string | null;
    onBlockClick?: (kind: "image" | "heading" | "text" | "button", id: string) => void;
}

// Full port of Fype-E-Commerce-UI's sections/ImageWithText.tsx (read-only
// design reference) — the second mixed-type block list after Rich Text
// (Image/Heading/Text/Button freely interleaved, per-type limits enforced
// by the editor's "+ Add block" popover, not this shape). The reference's
// drag-to-adjust-image-position canvas interaction isn't ported — Object
// Position X/Y are still real (applied as `object-position` below), just
// editable via plain sliders in the property panel instead, same
// simplification already made for Banner Slide's identical properties.
export default function ImageWithText({ settings, blocks, isEditorPreview = false, activeBlockId = null, onBlockClick }: ImageWithTextProps) {
    const imageBlock = blocks.find((b) => b.type === "Image");
    const nonImageBlocks = blocks.filter((b) => b.type !== "Image");

    const alignment = settings.content_horizontal_alignment;
    const justify = alignment === "Left" ? "justify-start" : alignment === "Right" ? "justify-end" : "justify-center";
    const items = alignment === "Left" ? "items-start text-left" : alignment === "Right" ? "items-end text-right" : "items-center text-center";
    const vertical =
        settings.content_vertical_alignment === "Top"
            ? "items-start pt-8 lg:pt-16"
            : settings.content_vertical_alignment === "Bottom"
              ? "items-end pb-8 lg:pb-16"
              : "items-center";

    const imageSize = imageBlock?.settings.image_size ?? "Medium";
    const imageAspectRatio = imageSize === "Small" ? "16/9" : imageSize === "Large" ? "3/4" : "1/1";
    const imagePos = imageBlock?.settings.image_position ?? "Left";

    const wrapBlock = (kind: "image" | "heading" | "text" | "button", id: string, label: string, children: React.ReactNode) => {
        if (!isEditorPreview) return children;
        const isActive = activeBlockId === id;
        return (
            <div
                id={`spark-block-${id}`}
                className={`relative w-full group/block cursor-pointer ${isActive ? "ring-2 ring-blue-500 rounded-sm" : "hover:ring-2 hover:ring-blue-400 rounded-sm"}`}
                onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onBlockClick?.(kind, id);
                }}
            >
                <div
                    className={`absolute -top-5 left-0 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 whitespace-nowrap z-30 transition-opacity ${
                        isActive ? "opacity-100" : "opacity-0 group-hover/block:opacity-100"
                    }`}
                >
                    {label}
                </div>
                {children}
            </div>
        );
    };

    // Consecutive Buttons render as one flex-wrap row (matches the
    // reference's groupedBlocks logic) — any other block interleaved
    // between them starts a new group.
    const grouped: Array<SparkImageWithTextBlock | { type: "ButtonGroup"; blocks: ButtonBlock[] }> = [];
    for (let i = 0; i < nonImageBlocks.length; i++) {
        const block = nonImageBlocks[i];
        if (block.type === "Button") {
            const group: ButtonBlock[] = [block];
            while (i + 1 < nonImageBlocks.length && nonImageBlocks[i + 1].type === "Button") {
                i++;
                group.push(nonImageBlocks[i] as ButtonBlock);
            }
            grouped.push({ type: "ButtonGroup", blocks: group });
        } else {
            grouped.push(block);
        }
    }

    return (
        <section
            className="w-full relative border-t border-gray-100"
            style={{ backgroundColor: settings.background_color, paddingTop: `${settings.padding_top}px`, paddingBottom: `${settings.padding_bottom}px` }}
        >
            <div className="max-w-7xl mx-auto px-6">
                <div className={`grid gap-16 grid-cols-1 md:grid-cols-2 ${vertical}`}>
                    {imageBlock && (
                        // Not routed through wrapBlock() — its generic
                        // wrapper div (relative, no explicit height) would
                        // become this block's positioned ancestor instead of
                        // this aspect-ratio container, and since its only
                        // content is absolutely positioned, that wrapper's
                        // own height collapses to 0 and the image disappears
                        // (real bug hit here). Same "absolute-overlay
                        // sibling" selection-ring pattern BannerSlider.tsx
                        // already uses for its own absolutely-positioned
                        // image, instead of wrapping it.
                        <div
                            id={`spark-block-${imageBlock.id}`}
                            className={`w-full relative rounded-2xl overflow-hidden ${imagePos === "Right" ? "md:order-2" : ""} ${isEditorPreview ? "cursor-pointer" : ""}`}
                            style={{ aspectRatio: imageAspectRatio }}
                            onClick={
                                isEditorPreview
                                    ? (e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          onBlockClick?.("image", imageBlock.id);
                                      }
                                    : undefined
                            }
                        >
                            {imageBlock.settings.image_url && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={imageBlock.settings.image_url}
                                    alt=""
                                    className="absolute inset-0 w-full h-full object-cover select-none"
                                    style={{ objectPosition: `${imageBlock.settings.object_position_x}% ${imageBlock.settings.object_position_y}%` }}
                                />
                            )}
                            <div
                                className="absolute inset-0 pointer-events-none"
                                style={{ backgroundColor: imageBlock.settings.overlay_color, opacity: imageBlock.settings.overlay_opacity / 100 }}
                            />
                            {isEditorPreview && (
                                <div
                                    className={`absolute inset-0 pointer-events-none z-10 ${
                                        activeBlockId === imageBlock.id ? "ring-2 ring-blue-500 ring-inset" : "hover:ring-1 hover:ring-blue-300 ring-inset"
                                    }`}
                                >
                                    {activeBlockId === imageBlock.id && (
                                        <div className="absolute top-0 left-0 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 whitespace-nowrap z-30">
                                            Image
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div className={`flex flex-col gap-6 w-full ${items}`}>
                        {grouped.map((item, index) => {
                            if (item.type === "ButtonGroup") {
                                return (
                                    <div key={`btn-group-${index}`} className={`flex flex-wrap gap-4 w-full ${justify}`}>
                                        {item.blocks.map((block) => (
                                            <Fragment key={block.id}>
                                                {(() => {
                                                    const buttonLink = block.settings.link ? resolveImageWithTextLink(block.settings.link) : { href: "#", external: false };
                                                    return wrapBlock(
                                                        "button",
                                                        block.id,
                                                        "Button",
                                                        block.settings.style === "Filled" ? (
                                                            <a
                                                                href={buttonLink.href}
                                                                target={buttonLink.external ? "_blank" : undefined}
                                                                rel={buttonLink.external ? "noopener noreferrer" : undefined}
                                                                className="px-8 py-3.5 font-medium rounded-full transition-opacity hover:opacity-90 uppercase tracking-widest text-xs inline-block cursor-pointer text-white"
                                                                style={{ backgroundColor: block.settings.button_color }}
                                                            >
                                                                {block.settings.label || "Discover More"}
                                                            </a>
                                                        ) : (
                                                            <a
                                                                href={buttonLink.href}
                                                                target={buttonLink.external ? "_blank" : undefined}
                                                                rel={buttonLink.external ? "noopener noreferrer" : undefined}
                                                                className="px-8 py-3.5 bg-transparent border font-medium rounded-full transition-colors uppercase tracking-widest text-xs inline-block cursor-pointer"
                                                                style={{ borderColor: block.settings.button_color, color: block.settings.button_color }}
                                                            >
                                                                {block.settings.label || "Discover More"}
                                                            </a>
                                                        )
                                                    );
                                                })()}
                                            </Fragment>
                                        ))}
                                    </div>
                                );
                            }

                            if (item.type === "Text") {
                                const styleClass =
                                    item.settings.style === "Subtitle"
                                        ? "tracking-[0.2em] text-xs sm:text-sm font-semibold block spark-font-subheading"
                                        : "text-gray-600 text-lg leading-relaxed block [&_p]:mb-4 last:[&_p]:mb-0";
                                return (
                                    <Fragment key={item.id}>
                                        {wrapBlock(
                                            "text",
                                            item.id,
                                            "Text",
                                            <span className={styleClass} style={{ color: item.settings.color || undefined }} dangerouslySetInnerHTML={{ __html: sanitizeRichText(item.settings.text) }} />
                                        )}
                                    </Fragment>
                                );
                            }

                            if (item.type === "Heading") {
                                const sizeClass = item.settings.size === "Small" ? "text-2xl" : item.settings.size === "Medium" ? "text-3xl" : "text-4xl";
                                return (
                                    <Fragment key={item.id}>
                                        {wrapBlock(
                                            "heading",
                                            item.id,
                                            "Heading",
                                            <h2
                                                className={`font-bold tracking-tight text-gray-900 leading-tight ${sizeClass}`}
                                                style={{ color: item.settings.color || undefined }}
                                                dangerouslySetInnerHTML={{ __html: sanitizeRichText(item.settings.text) }}
                                            />
                                        )}
                                    </Fragment>
                                );
                            }

                            return null;
                        })}

                        {nonImageBlocks.length === 0 && (
                            <div className="w-full text-center text-gray-400 p-8 border border-dashed border-gray-300">Image with Text — add content here</div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
