"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { SparkSlideBlock, SparkSlideshowSettings } from "../sparkConfig";
import { sanitizeRichText } from "@/lib/sanitizeRichText";

interface SlideshowProps {
    settings: SparkSlideshowSettings;
    slides: SparkSlideBlock[];
    // Editor-preview-only: lets the merchant click the current slide
    // directly in the live canvas to select it — same model as Banner
    // Slide (a whole Slide is one block, not independently sub-selectable).
    isEditorPreview?: boolean;
    activeSlideId?: string | null;
    onSlideClick?: (id: string) => void;
}

function resolveSlideshowLink(value: string): { href: string; external: boolean } {
    const href = value.trim();
    if (href === "/shop" || href === "/shops") return { href: "/products", external: false };
    const external = /^(https?:\/\/|\/\/|www\.)/i.test(href) || /^[\w-]+(?:\.[\w-]+)+(?:\/|$)/i.test(href);
    if (!external) return { href, external: false };
    if (/^https?:\/\//i.test(href)) return { href, external: true };
    return { href: `https://${href.replace(/^\/\//, "")}`, external: true };
}

// Full port of Fype-E-Commerce-UI's sections/Slideshow.tsx (read-only design
// reference) — a second, independently-configurable carousel alongside
// Image Banner/Banner Slide. "Sleek" renders as a contained rounded card;
// "Full Width" is a full-bleed fixed-height hero, matching the reference's
// own `isSleek` branching. Autoplay is a flat 4s interval, matching the
// reference (unlike Banner Slide's 5s — the reference itself uses different
// intervals for these two carousels).
export default function Slideshow({ settings, slides, isEditorPreview = false, activeSlideId = null, onSlideClick }: SlideshowProps) {
    const [currentIndex, setCurrentIndex] = useState(0);

    const activeSlideIndex = activeSlideId ? slides.findIndex((s) => s.id === activeSlideId) : -1;
    const isSlideSelectedInEditor = isEditorPreview && activeSlideIndex !== -1;

    useEffect(() => {
        if (isSlideSelectedInEditor) return;
        if (slides.length <= 1) return;
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % slides.length);
        }, 4000);
        return () => clearInterval(timer);
    }, [isSlideSelectedInEditor, slides.length]);

    if (slides.length === 0) return null;

    const isSleek = settings.style === "Sleek";
    const safeIndex = isSlideSelectedInEditor ? activeSlideIndex : currentIndex >= slides.length ? 0 : currentIndex;
    const slide = slides[safeIndex];
    const s = slide.settings;
    const buttonLink = s.button_link ? resolveSlideshowLink(s.button_link) : { href: "#", external: false };

    return (
        <section
            style={{ paddingTop: `${settings.padding_top}px`, paddingBottom: `${settings.padding_bottom}px` }}
            className={isSleek ? "px-6 max-w-7xl mx-auto relative" : "relative"}
        >
            <div
                id={`spark-block-${slide.id}`}
                className={`${
                    isSleek
                        ? "w-full relative rounded-2xl overflow-hidden aspect-[16/9] md:aspect-[21/9] shadow-sm bg-gray-100"
                        : "h-[500px] md:h-[600px] relative overflow-hidden"
                } ${isEditorPreview ? "group/block" : ""}`}
                onClick={
                    isEditorPreview
                        ? (e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              onSlideClick?.(slide.id);
                          }
                        : undefined
                }
            >
                <AnimatePresence>
                    <motion.div
                        key={slide.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8 }}
                        className={`absolute inset-0 w-full h-full ${isEditorPreview ? "cursor-pointer" : ""}`}
                    >
                        {s.image_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={s.image_url} alt={s.heading || "Slide"} className="absolute inset-0 w-full h-full object-cover object-center" />
                        )}
                        <div
                            className={isSleek ? "absolute inset-0" : "absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"}
                            style={{ backgroundColor: s.overlay_color, opacity: s.overlay_opacity / 100 }}
                        />
                    </motion.div>
                </AnimatePresence>

                <div
                    className={`absolute inset-0 z-10 flex flex-col items-center justify-center text-center ${isSleek ? "" : "px-6 max-w-4xl mx-auto"}`}
                    style={{ color: settings.color, pointerEvents: "none" }}
                >
                    {s.text && (
                        <motion.span
                            key={`sub-${slide.id}`}
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2, duration: 0.5 }}
                            className={
                                isSleek
                                    ? "text-sm uppercase tracking-widest font-bold mb-2 block"
                                    : "uppercase tracking-widest text-[11px] font-bold mb-6 block drop-shadow-md"
                            }
                            style={{ color: isSleek ? "rgba(255,255,255,0.9)" : settings.color }}
                        >
                            <span dangerouslySetInnerHTML={{ __html: sanitizeRichText(s.text) }} />
                        </motion.span>
                    )}
                    {s.heading && (
                        <motion.h2
                            key={`title-${slide.id}`}
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3, duration: 0.5 }}
                            className={
                                isSleek
                                    ? "text-3xl md:text-5xl font-bold tracking-tight text-white drop-shadow-md"
                                    : "text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-4 md:mb-8 drop-shadow-md"
                            }
                            style={{ color: isSleek ? "#ffffff" : settings.color }}
                        >
                            <span dangerouslySetInnerHTML={{ __html: sanitizeRichText(s.heading) }} />
                        </motion.h2>
                    )}

                    {s.button_text && (
                        <div className="h-14 mt-4 pointer-events-auto">
                            <motion.div
                                key={`btn-${slide.id}`}
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.4, duration: 0.5 }}
                            >
                                <a
                                    href={buttonLink.href}
                                    target={buttonLink.external ? "_blank" : undefined}
                                    rel={buttonLink.external ? "noopener noreferrer" : undefined}
                                    className={
                                        s.button_style === "Filled"
                                            ? "px-8 py-3 rounded-full uppercase tracking-[0.2em] text-[10px] hover:opacity-90 transition-opacity inline-block"
                                            : "spark-banner-outline-button border px-8 py-3 rounded-full uppercase tracking-[0.2em] text-[10px] bg-transparent backdrop-blur-sm inline-block"
                                    }
                                    style={
                                        s.button_style === "Filled"
                                            ? { backgroundColor: s.button_color, color: s.button_text_color }
                                            : {
                                                  borderColor: s.button_color,
                                                  ["--spark-button-text" as string]: s.button_color,
                                                  ["--spark-button-hover-text" as string]: s.button_hover_text_color || "#000000",
                                              }
                                    }
                                >
                                    {s.button_text}
                                </a>
                            </motion.div>
                        </div>
                    )}
                </div>

                <div className="absolute bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 flex gap-2 md:gap-3 z-20">
                    {slides.map((slideItem, i) => (
                        <button
                            key={slideItem.id}
                            onClick={(e) => {
                                e.stopPropagation();
                                setCurrentIndex(i);
                            }}
                            className={`w-1.5 md:w-2 h-1.5 md:h-2 rounded-full transition-all duration-300 ${
                                i === safeIndex ? "bg-white w-4 md:w-6" : "bg-white/50 hover:bg-white/80"
                            }`}
                            aria-label={`Go to slide ${i + 1}`}
                        />
                    ))}
                </div>

                {isEditorPreview && (
                    <div
                        className={`absolute inset-0 pointer-events-none z-50 ${
                            activeSlideId === slide.id ? "ring-2 ring-blue-500 ring-inset" : "group-hover/block:ring-2 group-hover/block:ring-blue-400 ring-inset"
                        }`}
                    >
                        <div
                            className={`absolute top-0 left-0 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 whitespace-nowrap transition-opacity ${
                                activeSlideId === slide.id ? "opacity-100" : "opacity-0 group-hover/block:opacity-100"
                            }`}
                        >
                            Slide
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
