"use client";

import { sparkLayoutStyle } from "./sparkLayout";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import Header from "./Header";
import BannerSlider from "./sections/BannerSlider";
import RichText from "./sections/RichText";
import FeaturedCollection from "./sections/FeaturedCollection";
import FeaturedProduct from "./sections/FeaturedProduct";
import Multicolumn from "./sections/Multicolumn";
import ImageWithText from "./sections/ImageWithText";
import CollectionList from "./sections/CollectionList";
import Slideshow from "./sections/Slideshow";
import CollapsibleContent from "./sections/CollapsibleContent";
import ContactForm from "./sections/ContactForm";
import Footer from "./sections/Footer";
import { mergeSparkConfig, type SparkBodySection, type SparkConfig, type SparkConfigOverride } from "./sparkConfig";
import type { CollectionSummary, ProductDetail, ProductVariant, ShopIdentity, StorefrontProduct } from "@/types/storefront";
import SparkHeaderShell from "./SparkHeaderShell";
import { isEditorMessage, isEditorPreview as isEditorPreviewFrame, postToEditor } from "@/lib/editor-preview";

// Message protocol between ecommerce_app's customization editor (parent
// frame) and this page (embedded in an iframe). See MIGRATION_RUNBOOK.md
// Phase 4.5's customization-editor section for the full design.
export const SPARK_DRAFT_UPDATE = "SPARK_DRAFT_CONFIG_UPDATE";
export const SPARK_DRAFT_READY = "SPARK_DRAFT_READY";
// Sent by the editor when the merchant selects a section in its section
// list — mirrors Fype-E-Commerce-UI's ThemeCustomizePage.tsx (read-only
// design reference), which outlines the selected section directly on the
// canvas with a blue border + label tag rather than leaving the canvas
// unannotated. "header" covers both the announcement bar and header
// settings (the editor's section list bundles them into one "Header" item,
// matching the reference).
export const SPARK_SET_ACTIVE_SECTION = "SPARK_SET_ACTIVE_SECTION";
// Sent by this page back to the editor when the merchant clicks a section
// directly in the canvas (not just via the editor's own section list) —
// keeps both selection UIs in sync, matching the reference's click-anywhere
// selection model.
export const SPARK_SECTION_CLICKED = "SPARK_SECTION_CLICKED";
// Block-level counterparts of the two messages above — lets the merchant
// click a specific block (an announcement, a text block, a button) directly
// in the canvas, not just the section it lives in, matching the reference's
// per-block click selection (ring highlight + right-panel scoped to that
// block alone).
export const SPARK_SET_ACTIVE_BLOCK = "SPARK_SET_ACTIVE_BLOCK";
export const SPARK_BLOCK_CLICKED = "SPARK_BLOCK_CLICKED";

// A section identifier is just "header" (the one fixed singleton — it
// bundles Announcement Bar and is never duplicated) or a Body instance's
// own `id`. No longer a fixed type-name union: Body is a real ordered list
// of section *instances* now (see sparkConfig.ts's SparkBodySection), so
// e.g. two Rich Text sections can coexist, each independently selectable by
// its own id.
export type SparkActiveSectionId = string;

// `sectionId` is the owning instance's id ("header" for Announcement Bar
// blocks); `kind` is block-type-specific (e.g. "heading"/"text"/"button"
// for Rich Text, "column" for Multicolumn) and is only ever consumed by
// that section's own component — not validated at the protocol level.
export interface SparkActiveBlock {
    sectionId: string;
    kind: string;
    id: string;
}

const BODY_SECTION_LABELS: Record<SparkBodySection["type"], string> = {
    image_banner: "Image Banner",
    rich_text: "Rich Text",
    featured_collection: "Featured Collection",
    featured_product: "Featured Product",
    multicolumn: "Multicolumn",
    image_with_text: "Image with Text",
    collection_list: "Collection List",
    slideshow: "Slideshow",
    collapsible_content: "Collapsible Content",
    contact_form: "Contact Form",
};

interface SparkHomeProps {
    initialConfig: SparkConfig;
    navItems: Array<{ label: string; href: string }>;
    shop: ShopIdentity;
    // Real-data section types can now have multiple instances (Add Section
    // allows duplicates, matching the reference), so SSR-fetched initial
    // data is keyed by the owning instance's id rather than one flat prop
    // per type.
    initialFeaturedCollectionProducts?: Record<string, StorefrontProduct[]>;
    initialFeaturedCollections?: Record<string, CollectionSummary | null>;
    initialFeaturedProducts?: Record<string, (ProductDetail & { variants?: ProductVariant[] }) | null>;
    initialCollectionListCollections?: Record<string, CollectionSummary[]>;
}

// Only rendered at all in editor preview — on real storefront traffic
// isEditorPreview is always false, so this returns null and no hover/ring
// affordance can ever leak to a real customer. Requires the section's own
// wrapping div (sectionProps below) to carry the "group" class so
// group-hover: below can key off it. Matches Fype-E-Commerce-UI's (read-only
// design reference) newer hover-highlight-plus-name-badge polish added in
// commit dc33eb4 — the label is now always mounted (fades in via opacity),
// not conditionally rendered only when active, and hovering an unselected
// section shows a ring too, not just the active one — makes sections that
// have no visible content yet (e.g. an empty Rich Text) discoverable.
function SectionOutline({ label, active, isEditorPreview }: { label: string; active: boolean; isEditorPreview: boolean }) {
    if (!isEditorPreview) return null;
    return (
        // z-100: above every in-section element (Header's own bar is z-40,
        // its announcement bar z-50, its mobile drawer z-60/z-70) — an
        // editor selection outline must always paint on top of real content.
        <div
            className={`absolute inset-0 z-100 pointer-events-none transition-colors ${active ? "ring-2 ring-inset ring-blue-500" : "ring-0 group-hover:ring-1 group-hover:ring-inset group-hover:ring-blue-400"
                }`}
        >
            <span
                className={`absolute -top-px left-0 bg-blue-500 text-white text-[11px] font-medium px-2 py-0.5 transition-opacity ${active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    }`}
            >
                {label}
            </span>
        </div>
    );
}

// Client Component so it can hold live-editing state and listen for
// postMessage draft updates. Only listens at all when embedded in an iframe
// AND the server verified a preview token (lib/editor-preview.ts) — normal customer traffic
// (not in an iframe, no token) never registers the listener, so a
// stray postMessage from an unrelated parent page can't do anything.
export default function SparkHome({
    initialConfig,
    navItems,
    shop,
    initialFeaturedCollectionProducts = {},
    initialFeaturedCollections = {},
    initialFeaturedProducts = {},
    initialCollectionListCollections = {},
}: SparkHomeProps) {
    const [liveConfig, setLiveConfig] = useState(initialConfig);
    const [activeSection, setActiveSection] = useState<SparkActiveSectionId | null>(null);
    const [activeBlock, setActiveBlock] = useState<SparkActiveBlock | null>(null);
    // Set once on mount (client-only, see effect below) — used to gate both
    // the postMessage listener AND click-to-select-in-canvas, and to stop
    // real nav-link navigation from firing when a merchant is just trying to
    // select the Header section while editing.
    const [isEditorPreview, setIsEditorPreview] = useState(false);
    const [isUserScrolling, setIsUserScrolling] = useState(false);
    const scrollLockRef = useRef<number | null>(null);

    useEffect(() => {
        if (typeof window === "undefined" || window.parent === window) return;
        if (!isEditorPreviewFrame()) return;
        // Genuinely tied to a client-only check (parent frame + query
        // param) that can't be known at initial render — not derivable from
        // props/state the way most effect-body setState calls are.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsEditorPreview(true);

        function handleMessage(event: MessageEvent) {
            if (!isEditorMessage(event)) return;
            if (!event.data) return;
            if (event.data.type === SPARK_DRAFT_UPDATE) {
                setLiveConfig((current) => mergeSparkConfig(current, event.data.config as SparkConfigOverride));
            } else if (event.data.type === SPARK_SET_ACTIVE_SECTION) {
                setActiveSection((event.data.section as SparkActiveSectionId | null) ?? null);
            } else if (event.data.type === SPARK_SET_ACTIVE_BLOCK) {
                setActiveBlock((event.data.block as SparkActiveBlock | null) ?? null);
            }
        }

        window.addEventListener("message", handleMessage);
        // Handshake: tell the parent we're mounted and ready to receive the
        // current draft (avoids a race where the parent posts before we're
        // listening), and hand it our real merged starting config so its
        // property panel can prefill fields with actual values instead of
        // blanks — the parent has no other way to know the resolved
        // (defaults + saved themeConfig) starting point.
        postToEditor({ type: SPARK_DRAFT_READY, config: initialConfig });
        return () => window.removeEventListener("message", handleMessage);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { header, announcement_bar: announcementBar, body, footer } = liveConfig.sections;

    // Glass Effect + Sticky Header together on the home page's header mean
    // it floats fully transparent over the hero (first body section)
    // instead of taking up its own space above it, becoming a solid frosted
    // bar once scrolled — matches Fype-E-Commerce-UI's SparkTheme.tsx demo,
    // which only ever does this on the home/about pages. Both settings are
    // required: Sticky Header off means the merchant wants the header to
    // scroll away normally, not float. Position: fixed (applied to the
    // header's own section wrapper below) takes it out of flow entirely, so
    // no negative-margin/measured-height compensation is needed — the hero
    // just naturally renders starting at the top of the page.
    const heroOverlap = !header.hidden && header.settings.glass_effect === true && header.settings.sticky_header === true;
    const { colors: colorSchemeSettings, logo: logoSettings, social_media: socialMedia } = liveConfig.theme_settings;
    const sectionAnimation = liveConfig.theme_settings.animation.section_animation;

    const sectionMotionProps =
        sectionAnimation === "Fade"
            ? {
                  initial: { opacity: 0 },
                  whileInView: { opacity: 1 },
                  viewport: { once: true, amount: 0.25 },
                  transition: { duration: 0.45, ease: "easeOut" as const },
              }
            : sectionAnimation === "Slide Up"
              ? {
                    initial: { opacity: 0, y: 24 },
                    whileInView: { opacity: 1, y: 0 },
                    viewport: { once: true, amount: 0.25 },
                    transition: { duration: 0.5, ease: "easeOut" as const },
                }
              : null;

    // Matches the reference exactly: only background/backgroundGradient/text
    // of the active scheme are applied, as an inline style on the page root
    // — solid_button_background/outline_button/shadow are editable in the
    // Theme Settings panel but not consumed by any rendering yet, same as
    // the reference itself (see sparkConfig.ts's SparkColorScheme comment).
    const activeScheme =
        colorSchemeSettings.schemes.find((s) => s.id === colorSchemeSettings.active_scheme_id) ?? colorSchemeSettings.schemes[0];
    const fontStack = (font?: string) => {
        if (!font) return '"Outfit", sans-serif';
        if (font.includes("Playfair Display")) return '"Playfair Display", serif';
        return '"Outfit", sans-serif';
    };
    const rootStyle = {
        backgroundColor: activeScheme?.background,
        backgroundImage: activeScheme?.background_gradient || undefined,
        color: activeScheme?.text,
        ["--spark-heading-font" as string]: fontStack(liveConfig.theme_settings.typography.heading_font),
        ["--spark-body-font" as string]: fontStack(liveConfig.theme_settings.typography.body_font),
        ["--spark-accent-font" as string]: fontStack(liveConfig.theme_settings.typography.sub_heading_font),
        ...sparkLayoutStyle(liveConfig.theme_settings.layout),
    };

    const selectSection = (sectionId: string) => {
        setActiveSection(sectionId);
        setActiveBlock(null);
        postToEditor({ type: SPARK_SECTION_CLICKED, section: sectionId });
    };

    const selectBlock = (block: SparkActiveBlock) => {
        setActiveSection(block.sectionId);
        setActiveBlock(block);
        postToEditor({ type: SPARK_BLOCK_CLICKED, block });
    };

    useEffect(() => {
        if (!isEditorPreview) return;

        const targetId = activeBlock ? `spark-block-${activeBlock.id}` : activeSection ? `spark-section-${activeSection}` : null;
        if (!targetId || isUserScrolling) return;

        const target = document.getElementById(targetId) ?? (activeBlock?.sectionId ? document.getElementById(`spark-section-${activeBlock.sectionId}`) : null);
        if (!target) return;

        const frame = window.requestAnimationFrame(() => {
            target.scrollIntoView({ behavior: "smooth", block: "center" });
        });

        return () => window.cancelAnimationFrame(frame);
    }, [activeBlock, activeSection, isEditorPreview]);

    useEffect(() => {
        if (!isEditorPreview) return;

        const onUserScroll = () => {
            setIsUserScrolling(true);
            if (scrollLockRef.current) window.clearTimeout(scrollLockRef.current);
            scrollLockRef.current = window.setTimeout(() => {
                setIsUserScrolling(false);
                scrollLockRef.current = null;
            }, 180);
        };

        window.addEventListener("wheel", onUserScroll, { passive: true });
        window.addEventListener("touchmove", onUserScroll, { passive: true });
        window.addEventListener("scroll", onUserScroll, { passive: true });
        return () => {
            window.removeEventListener("wheel", onUserScroll);
            window.removeEventListener("touchmove", onUserScroll);
            window.removeEventListener("scroll", onUserScroll);
            if (scrollLockRef.current) window.clearTimeout(scrollLockRef.current);
        };
    }, [isEditorPreview]);

    // Selecting a section in the editor must never actually follow the
    // real nav/search/account/cart links inside Header — preventDefault in
    // the capture phase runs before those <Link>s' own click handlers,
    // which (like every Next.js Link) skip navigation when the event
    // arrives already defaultPrevented.
    const sectionProps = (sectionId: string) =>
        isEditorPreview
            ? {
                className: "relative group cursor-pointer spark-layout-section",
                onClickCapture: (e: React.MouseEvent) => {
                    e.preventDefault();
                    selectSection(sectionId);
                },
            }
            : { className: "relative spark-layout-section" };

    // Merchant-toggled visibility (SparkCustomizeTheme.tsx's sidebar eye
    // icon) — persisted on the section/block itself, so hidden here means
    // hidden for real customers too, not just an editor-preview convenience.
    const visibleAnnouncementBlocks = announcementBar.settings.show
        ? announcementBar.settings.blocks.filter((b) => !b.hidden)
        : [];

    const renderBodySection = (section: SparkBodySection) => {
        const activeBlockId = activeBlock?.sectionId === section.id ? activeBlock.id : null;
        switch (section.type) {
            case "image_banner":
                return (
                    <BannerSlider
                        settings={section.settings}
                        slides={section.banner_slides.filter((s) => !s.hidden)}
                        isEditorPreview={isEditorPreview}
                        activeSlideId={activeBlockId}
                        onSlideClick={(id) => selectBlock({ sectionId: section.id, kind: "banner_slide", id })}
                    />
                );
            case "rich_text":
                return (
                    <RichText
                        settings={section.settings}
                        blocks={section.blocks.filter((b) => !b.hidden)}
                        isEditorPreview={isEditorPreview}
                        activeBlockId={activeBlockId}
                        onBlockClick={(kind, id) => selectBlock({ sectionId: section.id, kind, id })}
                    />
                );
            case "featured_collection":
                return (
                    <FeaturedCollection
                        settings={section.settings}
                        storeId={shop.shopId}
                        globalTax={shop.settings?.tax}
                        initialProducts={initialFeaturedCollectionProducts[section.id] ?? []}
                        initialCollection={initialFeaturedCollections?.[section.id] ?? null}
                        isEditorPreview={isEditorPreview}
                    />
                );
            case "featured_product":
                return (
                    <FeaturedProduct
                        settings={section.settings}
                        storeId={shop.shopId}
                        globalTax={shop.settings?.tax}
                        initialProduct={initialFeaturedProducts[section.id] ?? null}
                        isEditorPreview={isEditorPreview}
                    />
                );
            case "multicolumn":
                return (
                    <Multicolumn
                        settings={section.settings}
                        blocks={section.blocks.filter((b) => !b.hidden)}
                        isEditorPreview={isEditorPreview}
                        activeBlockId={activeBlockId}
                        onBlockClick={(id) => selectBlock({ sectionId: section.id, kind: "column", id })}
                    />
                );
            case "image_with_text":
                return (
                    <ImageWithText
                        settings={section.settings}
                        blocks={section.blocks.filter((b) => !b.hidden)}
                        isEditorPreview={isEditorPreview}
                        activeBlockId={activeBlockId}
                        onBlockClick={(kind, id) => selectBlock({ sectionId: section.id, kind, id })}
                    />
                );
            case "collection_list":
                return (
                    <CollectionList
                        settings={section.settings}
                        storeId={shop.shopId}
                        initialCollections={initialCollectionListCollections[section.id] ?? []}
                        isEditorPreview={isEditorPreview}
                    />
                );
            case "slideshow":
                return (
                    <Slideshow
                        settings={section.settings}
                        slides={section.blocks.filter((s) => !s.hidden)}
                        isEditorPreview={isEditorPreview}
                        activeSlideId={activeBlockId}
                        onSlideClick={(id) => selectBlock({ sectionId: section.id, kind: "slide", id })}
                    />
                );
            case "collapsible_content":
                return (
                    <CollapsibleContent
                        settings={section.settings}
                        items={section.blocks.filter((b) => !b.hidden)}
                        isEditorPreview={isEditorPreview}
                        activeBlockId={activeBlockId}
                        onBlockClick={(id) => selectBlock({ sectionId: section.id, kind: "item", id })}
                    />
                );
            case "contact_form":
                return <ContactForm settings={section.settings} />;
            default:
                return null;
        }
    };

    return (
        <div
            className="spark-page-layout bg-white text-black"
            style={rootStyle}
            onClick={(e) => {
                if (!isEditorPreview || e.target !== e.currentTarget) return;
                setActiveSection(null);
                setActiveBlock(null);
                postToEditor({ type: SPARK_SECTION_CLICKED, section: null });
            }}
        >
            <SparkHeaderShell
                config={liveConfig}
                navItems={navItems}
                shop={shop}
                isEditorPreview={isEditorPreview}
                activeBlockId={activeBlock?.sectionId === "header" ? activeBlock.id : null}
                onAnnouncementClick={(id) => selectBlock({ sectionId: "header", kind: "announcement", id })}
                onHeaderClick={() => selectSection("header")}
                heroOverlap={heroOverlap}
            />
            {body.filter((section) => !section.hidden).map((section, index) => (
                    <motion.div
                        id={`spark-section-${section.id}`}
                        key={section.id}
                        {...sectionProps(section.id)}
                        {...sectionMotionProps}
                        style={index === 0 && heroOverlap ? { marginTop: 0 } : undefined}
                    >
                        <SectionOutline label={BODY_SECTION_LABELS[section.type]} active={activeSection === section.id} isEditorPreview={isEditorPreview} />
                        {renderBodySection(section)}
                    </motion.div>
            ))}
            {!footer.hidden && (
                <div id="spark-section-footer" {...sectionProps("footer")}>
                    <SectionOutline label="Footer" active={activeSection === "footer"} isEditorPreview={isEditorPreview} />
                    <Footer
                        settings={footer.settings}
                        blocks={footer.blocks.filter((b) => !b.hidden)}
                        navItems={navItems}
                        socialMedia={socialMedia}
                        shopName={shop.shopName}
                        footerLogoUrl={logoSettings.footer_logo_url}
                        footerLogoWidth={logoSettings.footer_logo_width}
                        isEditorPreview={isEditorPreview}
                        activeBlockId={activeBlock?.sectionId === "footer" ? activeBlock.id : null}
                        onBlockClick={(kind, id) => selectBlock({ sectionId: "footer", kind, id })}
                    />
                </div>
            )}
        </div>
    );
}
