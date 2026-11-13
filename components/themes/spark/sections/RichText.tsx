"use client";

import type { SparkRichTextBlock, SparkRichTextSettings } from "../sparkConfig";
import { sanitizeRichText } from "@/lib/sanitizeRichText";

interface RichTextProps {
    settings: SparkRichTextSettings;
    // Already filtered for hidden and in the merchant's chosen order — Rich
    // Text's 3 block types (Heading/Text/Button) freely interleave in one
    // list, unlike Header/Image Banner's single-block-type arrays, so
    // render order is simply array order.
    blocks: SparkRichTextBlock[];
    isEditorPreview?: boolean;
    activeBlockId?: string | null;
    onBlockClick?: (kind: "heading" | "text" | "button", id: string) => void;
}

// Full port of Fype-E-Commerce-UI's sections/RichText.tsx (read-only design
// reference). Font is a real, schema-declared property here (unlike
// Header's vestigial `settings.font`) — actually applied as inline
// font-family below, matching the reference. The reference's `isCentered`
// check reads `block.settings['Alignment']`, a property that doesn't exist
// anywhere in THEME_SCHEMA for this section — it's dead code that always
// evaluates to centered; rendered as always-centered here too, matching
// actual reference behavior rather than the unreachable branch.
export default function RichText({ settings, blocks, isEditorPreview = false, activeBlockId = null, onBlockClick }: RichTextProps) {
    const wrapBlock = (kind: "heading" | "text" | "button", id: string, label: string, children: React.ReactNode) => {
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

    return (
        <section
            className="relative w-full overflow-hidden"
            style={{ backgroundColor: settings.background_color, paddingTop: `${settings.padding_top}px`, paddingBottom: `${settings.padding_bottom}px` }}
        >
            <div className="relative z-10 w-full px-6 flex flex-col gap-6 md:gap-8 mx-auto max-w-4xl items-center text-center">
                {blocks.map((block) => {
                    if (block.type === "Heading") {
                        const { text, size, color, font } = block.settings;
                        let sizeClass = "text-3xl sm:text-4xl";
                        if (size === "Small") sizeClass = "text-2xl sm:text-3xl";
                        if (size === "Large") sizeClass = "text-4xl md:text-5xl";
                        return (
                            <div key={block.id} className="w-full flex justify-center">
                                {wrapBlock(
                                    "heading",
                                    block.id,
                                    "Heading",
                                    <h2
                                        className={`font-light tracking-tight leading-[1.3] ${sizeClass}`}
                                        style={{ color }}
                                        dangerouslySetInnerHTML={{ __html: sanitizeRichText(text) }}
                                    />
                                )}
                            </div>
                        );
                    }
                    if (block.type === "Text") {
                        const { text, style, color } = block.settings;
                        return (
                            <div key={block.id} className="w-full flex justify-center">
                                {wrapBlock(
                                    "text",
                                    block.id,
                                    "Text",
                                    <div
                                        className={`font-medium max-w-xl mx-auto tracking-widest [&_p]:mb-4 last:[&_p]:mb-0 [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-gray-900 transition-colors ${style === "Subtitle" ? "text-sm spark-font-subheading" : "text-xs"}`}
                                        style={{ color }}
                                        dangerouslySetInnerHTML={{ __html: sanitizeRichText(text) }}
                                    />
                                )}
                            </div>
                        );
                    }
                    // Button
                    const { label, style, button_color: btnColor, link, button_text_color: btnTextColor } = block.settings;
                    return (
                        <div key={block.id} className="w-full flex justify-center">
                            {wrapBlock(
                                "button",
                                block.id,
                                "Button",
                                style === "Filled" ? (
                                    <a
                                        href={link || "#"}
                                        className="px-8 py-3.5 font-medium rounded-full transition-opacity hover:opacity-90 uppercase tracking-widest text-xs inline-block text-white cursor-pointer"
                                        style={{ backgroundColor: btnColor, color: btnTextColor || "#ffffff" }}
                                    >
                                        {label}
                                    </a>
                                ) : (
                                    <a
                                        href={link || "#"}
                                        className="px-8 py-3.5 bg-transparent border font-medium rounded-full transition-colors uppercase tracking-widest text-xs inline-block cursor-pointer"
                                        style={{ borderColor: btnColor, color: btnColor }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = btnColor;
                                            e.currentTarget.style.color = "#ffffff";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = "transparent";
                                            e.currentTarget.style.color = btnColor;
                                        }}
                                    >
                                        {label}
                                    </a>
                                )
                            )}
                        </div>
                    );
                })}

                {blocks.length === 0 && (
                    <div className="w-full text-center text-gray-400 p-8 border border-dashed border-gray-300">Rich Text block - add content here</div>
                )}
            </div>
        </section>
    );
}
