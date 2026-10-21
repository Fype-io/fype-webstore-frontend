"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Search, ShoppingBag, User } from "lucide-react";
import type { SparkAnnouncementBarBlock, SparkHeaderSettings } from "./sparkConfig";
import { useAppSelector } from "@/redux/hooks";
import { cartTotalCount, useSparkCart } from "./SparkCartContext";
import AuthModal from "@/components/shared/AuthModal";
import { getCurrentStoreId } from "@/lib/client-store-context";

interface SparkHeaderProps {
    header: SparkHeaderSettings;
    navItems: Array<{ label: string; href: string }>;
    announcementBlocks: SparkAnnouncementBarBlock[];
    // Store-wide logo (Theme settings panel), not the per-header-section
    // Logo Image toggle — this is the only logo upload path that's wired up.
    logoUrl?: string;
    logoWidth?: number;
    // Editor-preview-only: lets the merchant click a specific announcement
    // block directly in the live canvas (not just pick it from the editor's
    // own block list) and see it highlighted, matching the reference's
    // per-block click selection. Undefined on real storefront traffic.
    isEditorPreview?: boolean;
    activeAnnouncementId?: string | null;
    onAnnouncementClick?: (id: string) => void;
    // Only passed by the home page (matches Fype-E-Commerce-UI's
    // SparkTheme.tsx demo, which gates this to home/about): the parent has
    // already taken this cluster (announcement bar + header) out of normal
    // flow via `position: fixed` so it floats over the hero, and just wants
    // this component to switch between fully-transparent and frosted-glass
    // based on scroll position.
    heroOverlap?: boolean;
}

const REPEAT_COUNT = 10;

// Converts a "#rrggbb" hex color to an rgba() string at the given alpha —
// needed because the header's background is set via inline style, so
// Tailwind's bg-opacity-* utility (which only works on colors defined
// through Tailwind's own utility classes) silently does nothing to it.
function hexToRgba(hex: string, alpha: number): string {
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!match) return hex;
    const [, r, g, b] = match;
    return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, ${alpha})`;
}

function resolveAnnouncementLink(value: string): { href: string; external: boolean } {
    const href = value.trim();
    if (href === "/shop" || href === "/shops") return { href: "/products", external: false };
    const external = /^(https?:\/\/|\/\/|www\.)/i.test(href) || /^[\w-]+(?:\.[\w-]+)+(?:\/|$)/i.test(href);
    if (!external) return { href, external: false };
    if (/^https?:\/\//i.test(href)) return { href, external: true };
    return { href: `https://${href.replace(/^\/\//, "")}`, external: true };
}

// Full port of Fype-E-Commerce-UI's sections/Header.tsx (read-only design
// reference) — every section setting (Logo Type/Position, Menu Style,
// Sticky Header, Glass Effect, Background/Foreground Color) and every
// Announcement Bar block property (Text, Link, Text Animation, Speed, Appear
// After, per-block colors, multi-block rotation) is wired up here, matching
// the reference 1:1. Client Component because the Scroll marquee and Slide
// rotation both need timers/animation state.
export default function Header({
    header,
    navItems,
    announcementBlocks,
    logoUrl,
    logoWidth = 120,
    isEditorPreview = false,
    activeAnnouncementId = null,
    onAnnouncementClick,
    heroOverlap = false,
}: SparkHeaderProps) {
    const [currentAnnouncement, setCurrentAnnouncement] = useState(0);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const [authOpen, setAuthOpen] = useState(false);
    const router = useRouter();
    const { cart, isAuthenticated } = useAppSelector((state) => state.user);
    const { openCart } = useSparkCart();
    const count = cartTotalCount(cart);
    const storeId = getCurrentStoreId() ?? undefined;

    useEffect(() => {
        if (!heroOverlap) return;
        const onScroll = () => setIsScrolled(window.scrollY > 40);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, [heroOverlap]);

    const numBlocks = announcementBlocks.length;
    // Blocks can be added/removed/reordered by the editor while this is
    // mounted (live preview) — derive instead of syncing currentAnnouncement
    // to numBlocks via an effect, so there's never an out-of-bounds frame.
    const selectedAnnouncementIndex = isEditorPreview && activeAnnouncementId
        ? announcementBlocks.findIndex((block) => block.id === activeAnnouncementId)
        : -1;
    const activeIndex = selectedAnnouncementIndex >= 0
        ? selectedAnnouncementIndex
        : numBlocks > 0
            ? currentAnnouncement % numBlocks
            : 0;
    const activeBlockSettings = announcementBlocks[activeIndex]?.settings;
    // Animation and rotation timing are announcement-bar-wide settings. The
    // editor propagates changes to every block, while the first block keeps
    // older saved drafts deterministic if their values differ.
    const sharedAnimationSettings = announcementBlocks[0]?.settings;
    const isScroll = sharedAnimationSettings?.text_animation === "Scroll";
    const appearAfter = sharedAnimationSettings?.appear_after || 5;

    useEffect(() => {
        if (numBlocks <= 1 || isScroll || selectedAnnouncementIndex >= 0) return;
        const timer = setTimeout(() => {
            setCurrentAnnouncement((prev) => (prev + 1) % numBlocks);
        }, appearAfter * 1000);
        return () => clearTimeout(timer);
    }, [numBlocks, isScroll, appearAfter, activeIndex, selectedAnnouncementIndex]);

    const speedSetting = sharedAnimationSettings?.speed || 20;
    const scrollDuration = `${speedSetting * REPEAT_COUNT}s`;

    // Colors remain block-specific and follow whichever slide is currently
    // visible. Scroll mode applies each block's colors directly to its item.
    const containerBgColor = isScroll ? "transparent" : activeBlockSettings?.background_color || "#111111";
    const containerTextColor = isScroll ? "inherit" : activeBlockSettings?.text_color || "#ffffff";

    const {
        logo_type: logoType,
        logo_text: logoText,
        logo_position: logoPosition,
        menu_style: menuStyle,
        sticky_header: isSticky,
        glass_effect: glassEffect,
        background_color: bgColor,
        foreground_color: fgColor,
    } = header;

    // Resolve the configured navigation here so every page uses the same
    // links. Home previously resolved this separately, while inner pages
    // rendered only the fallback Shop/Collections items.
    const displayNavItems = header.navigation?.length
        ? header.navigation.reduce((items, item) => {
              const lowerItem = item.toLowerCase();
              if (lowerItem === "home" && !items.some((entry) => entry.href === "/")) items.push({ label: "Home", href: "/" });
              else if (lowerItem === "shop" && !items.some((entry) => entry.href === "/products")) items.push({ label: "Shop", href: "/products" });
              else if (lowerItem === "collections" && !items.some((entry) => entry.href === "/collections")) items.push({ label: "Collections", href: "/collections" });
              else if (lowerItem.startsWith("page:")) {
                  const [pagePart, ...titleParts] = item.split("|");
                  const slug = pagePart.slice(5);
                  const serverItem = navItems.find((entry) => entry.href === `/${slug}`);
                  items.push({ label: titleParts.join("|") || serverItem?.label || slug, href: serverItem?.href || `/${slug}` });
              } else if (!items.some((entry) => entry.label.toLowerCase() === lowerItem)) {
                  items.push({ label: item, href: `/${item.toLowerCase().replace(/\s+/g, "-")}` });
              }
              return items;
          }, [] as Array<{ label: string; href: string }>)
        : navItems;

    // Only the home page opts into overlapping the hero (heroOverlap), and
    // only makes sense combined with both settings that make the effect
    // legible: Sticky Header (so it stays put as you scroll past the hero
    // instead of vanishing) and Glass Effect itself. The parent already
    // applies `position: fixed` to the whole cluster when this is active, so
    // the header itself only needs its own sticky class in the normal
    // (non-overlap) case.
    const overlapActive = heroOverlap && glassEffect && isSticky;
    const isTransparent = overlapActive && !isScrolled;

    // Sticky positioning is owned by SparkHeaderShell's outer wrapper so the
    // header can stay visual-only here. Keeping the sticky class off this
    // inner element avoids nested-sticky behavior that can break when the
    // header is opaque instead of glassy.
    const headerClass = "z-40 transition-all duration-300 border-b";
    const headerStyle: CSSProperties = isTransparent
        ? { backgroundColor: "transparent", color: "#ffffff", borderColor: "rgba(255,255,255,0.15)" }
        : {
              // Glass Effect means the header is fully transparent over the
              // hero (handled above) and, once scrolled, a frosted glass bar
              // rather than a flat opaque one — bg-opacity-90 can't do this
              // via Tailwind since backgroundColor is set inline, so blend
              // the alpha into the color itself and pair it with a real blur.
              backgroundColor: glassEffect ? hexToRgba(bgColor, 0.58) : bgColor,
              color: fgColor,
              borderColor: fgColor === "#ffffff" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)",
              backdropFilter: glassEffect ? "blur(18px) saturate(180%)" : undefined,
              WebkitBackdropFilter: glassEffect ? "blur(18px) saturate(180%)" : undefined,
          };

    const logoContent = (
        <Link href="/" className="flex items-center gap-2 sm:gap-3 min-w-0">
            {(logoType === "Logo Image" || logoType === "Text + Logo Image") && logoUrl && (
                <span className="flex items-center shrink-0 overflow-hidden max-w-[36vw] sm:max-w-none" style={{ width: `${logoWidth}px` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- store-uploaded logo, arbitrary remote origin not worth a next/image remotePatterns entry */}
                    <img src={logoUrl} className="w-full h-auto max-h-10 sm:max-h-12 object-contain" alt={logoText || "Logo"} />
                </span>
            )}
            {(logoType === "Text Only" || logoType === "Text + Logo Image") && (
                <span className="font-black tracking-tighter text-xl sm:text-2xl hover:opacity-80 transition-opacity truncate max-w-[42vw] md:max-w-none">
                    {logoText}
                </span>
            )}
        </Link>
    );

    const menuButton = (
        <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
            className={`transition-colors hover:opacity-70 shrink-0 ${menuStyle === "Drawer" ? "block" : "md:hidden"}`}
        >
            <span className="material-symbols-outlined text-2xl">menu</span>
        </button>
    );

    const navContent = (
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold tracking-wide uppercase">
            {displayNavItems.map((item) => (
                <Link key={item.label} href={item.href} className="opacity-80 hover:opacity-100 transition-opacity">
                    {item.label}
                </Link>
            ))}
        </nav>
    );

    // The three icons come from one set (lucide, 20px, 1.5 stroke) and sit in the same fixed 24px centred box.
    // They used to mix Material Symbols glyphs (baseline-aligned in a 30px line box) with an SVG, which left
    // the bag about 3px lower than search and person.
    const iconButtonClass = "relative inline-flex h-6 w-6 items-center justify-center hover:opacity-70 transition-opacity";
    const iconLinks = (
        <div className="flex items-center gap-3 sm:gap-5 shrink-0">
            <Link href="/products" className={iconButtonClass} aria-label="Search">
                <Search size={20} strokeWidth={1.5} />
            </Link>
            <button
                type="button"
                onClick={() => {
                    if (isEditorPreview) return;
                    if (isAuthenticated) router.push("/accounts");
                    else setAuthOpen(true);
                }}
                className={iconButtonClass}
                aria-label={isAuthenticated ? "Account" : "Sign in"}
            >
                <User size={20} strokeWidth={1.5} />
            </button>
            <button type="button" onClick={openCart} className={iconButtonClass} aria-label="Open cart">
                <ShoppingBag size={20} strokeWidth={1.5} />
                {count > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#111] text-white text-[10px] font-bold flex items-center justify-center rounded-full">
                        {count}
                    </span>
                )}
            </button>
        </div>
    );

    const renderAnnouncementContent = (block: SparkAnnouncementBarBlock) => {
        const link = block.settings.link ? resolveAnnouncementLink(block.settings.link) : null;
        const content = (
            <div
                dangerouslySetInnerHTML={{ __html: block.settings.text || "Welcome to our store" }}
                className="[&_p]:inline [&_p]:m-0"
            />
        );
        const inner = link?.href ? (
            <a
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noreferrer noopener" : undefined}
                className="hover:opacity-80 transition-opacity"
            >
                {content}
            </a>
        ) : (
            content
        );

        if (!isEditorPreview) return inner;

        const isActive = activeAnnouncementId === block.id;
        return (
            <div
                id={`spark-block-${block.id}`}
                className={`relative group/block cursor-pointer rounded-sm ${isActive ? "ring-2 ring-blue-500" : "hover:ring-2 hover:ring-blue-400"}`}
                onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onAnnouncementClick?.(block.id);
                }}
            >
                <div
                        className={`absolute top-full left-0 mt-1 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 whitespace-nowrap z-[100] pointer-events-none transition-opacity ${
                        isActive ? "opacity-100" : "opacity-0 group-hover/block:opacity-100"
                    }`}
                >
                    Announcement Bar
                </div>
                {inner}
            </div>
        );
    };

    return (
        <div className="w-full flex flex-col font-sans">
            {/* ANNOUNCEMENT BAR */}
            {announcementBlocks.length > 0 && (
                <div
                    className="text-[10px] sm:text-[11px] font-bold tracking-[0.2em] uppercase relative z-50 flex items-center h-[34px] sm:h-[36px] transition-colors duration-500"
                    style={{ backgroundColor: containerBgColor, color: containerTextColor }}
                >
                    {isScroll ? (
                        <div className="w-full overflow-hidden whitespace-nowrap flex group h-full">
                            {[0, 1].map((marqueeIndex) => (
                                <div
                                    key={marqueeIndex}
                                    className="flex animate-marquee group-hover:[animation-play-state:paused] h-full shrink-0 min-w-full"
                                    style={{ animationDuration: scrollDuration }}
                                    aria-hidden={marqueeIndex === 1}
                                >
                                    {Array(REPEAT_COUNT)
                                        .fill(isEditorPreview ? [announcementBlocks[activeIndex]] : announcementBlocks)
                                        .flat()
                                        .filter(Boolean)
                                        .map((block: SparkAnnouncementBarBlock, index: number) => (
                                            <div
                                                key={`${marqueeIndex}_${block.id}_${index}_${block.settings.text_animation}_${block.settings.appear_after}_${block.settings.speed}`}
                                                className="px-8 shrink-0 flex items-center h-full transition-colors duration-500"
                                                style={{
                                                    backgroundColor: block.settings.background_color || "#111111",
                                                    color: block.settings.text_color || "#ffffff",
                                                }}
                                            >
                                                {renderAnnouncementContent(block)}
                                            </div>
                                        ))}
                                </div>
                            ))}
                        </div>
                    ) : announcementBlocks.length === 1 ? (
                        <div className="w-full flex items-center justify-center px-4 h-full">
                            <div className="text-center w-full">{renderAnnouncementContent(announcementBlocks[0])}</div>
                        </div>
                    ) : (
                        <div className="w-full flex items-center justify-center relative h-full">
                            <AnimatePresence mode="popLayout">
                                {announcementBlocks.map((block, index) => {
                                    if (index !== activeIndex) return null;
                                    return (
                                        <motion.div
                                            key={`${block.id}_${block.settings.text_animation}_${block.settings.appear_after}_${block.settings.speed}`}
                                            initial={{ opacity: 0, x: 100 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -100 }}
                                            transition={{ duration: 0.4, ease: "easeOut" }}
                                            className="absolute text-center w-full h-full flex items-center justify-center px-4"
                                        >
                                            <div className="w-full">{renderAnnouncementContent(block)}</div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            )}

            {/* HEADER */}
            <header className={headerClass} style={headerStyle}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between min-w-0 gap-3">
                    {logoPosition === "Left" ? (
                        <>
                            <div className="flex items-center gap-3 sm:gap-6 min-w-0">
                                {menuButton}
                                {logoContent}
                            </div>

                            {menuStyle === "Tabs" && <div className="hidden md:flex flex-1 justify-center">{navContent}</div>}

                            {iconLinks}
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-3 sm:gap-6 flex-1 justify-start min-w-0">
                                {menuButton}
                                {menuStyle === "Tabs" && navContent}
                            </div>

                            <div className="flex items-center justify-center flex-1 min-w-0">{logoContent}</div>

                            <div className="flex-1 flex justify-end">{iconLinks}</div>
                        </>
                    )}
                </div>
            </header>

            {/* Drawer menu — the reference (a static design tool) only shows the
                hamburger icon as a mock; this is a real storefront, so "Menu
                Style: Drawer" has to actually open something. */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/40 z-[60]"
                            onClick={() => setMobileMenuOpen(false)}
                        />
                        <motion.div
                            initial={{ x: "-100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "-100%" }}
                            transition={{ duration: 0.25, ease: "easeOut" }}
                            className="fixed top-0 left-0 bottom-0 w-72 bg-white z-[70] flex flex-col shadow-xl"
                        >
                            <div className="flex items-center justify-between px-5 h-16 border-b border-gray-100">
                                <span className="font-black tracking-tighter text-xl">{logoText}</span>
                                <button onClick={() => setMobileMenuOpen(false)} aria-label="Close menu" className="hover:opacity-70">
                                    <span className="material-symbols-outlined text-xl">close</span>
                                </button>
                            </div>
                            <nav className="flex flex-col p-5 gap-4 text-sm font-semibold tracking-wide uppercase">
                                {displayNavItems.map((item) => (
                                    <Link key={item.label} href={item.href} onClick={() => setMobileMenuOpen(false)} className="opacity-80 hover:opacity-100">
                                        {item.label}
                                    </Link>
                                ))}
                            </nav>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
            {!isEditorPreview && (
                <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} storeId={storeId} shopName={logoText} platformName="Fype" />
            )}
        </div>
    );
}
