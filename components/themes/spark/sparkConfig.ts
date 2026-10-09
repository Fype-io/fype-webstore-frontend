// Spark's own config schema — genuinely different shape from theme_one's
// ThemeCustomization/ThemeSections (see MIGRATION_RUNBOOK.md Phase 4 decision
// #2: "each theme owns an arbitrary, theme-specific config schema"). Ported
// from Fype-E-Commerce-UI/src/themes/spark/spark.config.json (read-only
// design reference, not part of this codebase) — that file documents the
// intended Shopify-style "sections + presets.order" model; this is the same
// shape as a real TypeScript type, plus a bundled default instance used as
// this theme's placeholder/preview content until per-store persistence of a
// merchant's own edited config exists (deferred — see runbook).

import type { Page, ProductSortBy } from "@/types/storefront";

export interface SparkAnnouncementBarBlockSettings {
    text: string;
    link: string;
    text_animation: "Scroll" | "Slide";
    speed: number;
    appear_after: number;
    background_color: string;
    text_color: string;
    // Set by the editor's Rich Text font dropdown — not a THEME_SCHEMA
    // property, applied as inline font-family when rendering.
    font?: string;
}

export interface SparkAnnouncementBarBlock {
    id: string;
    // Merchant-toggled per-block visibility (the sidebar's eye icon in
    // SparkCustomizeTheme.tsx) — persisted, not just an editor-preview
    // convenience, so a hidden block is skipped for real customers too.
    hidden?: boolean;
    settings: SparkAnnouncementBarBlockSettings;
}

export interface SparkAnnouncementBarSettings {
    show: boolean;
    blocks: SparkAnnouncementBarBlock[];
}

export interface SparkHeaderSettings {
    logo_type: "Logo Image" | "Text Only" | "Text + Logo Image";
    logo_text: string;
    logo_image_url: string;
    logo_position: "Left" | "Center";
    menu_style: "Drawer" | "Tabs";
    navigation: string[];
    sticky_header: boolean;
    glass_effect: boolean;
    background_color: string;
    foreground_color: string;
}

// "Image Banner" is now a carousel (THEME_SCHEMA renamed its block to
// "Banner Slide", capped at 10, replacing the old fixed Image/Heading/
// Text/Button-block shape) — see Fype-E-Commerce-UI commit c9cb197
// "feat(theme): replace ImageBanner with BannerSlider". Section-level
// Content Alignment moved down into each slide.
export interface SparkBannerSlideBlockSettings {
    image_url: string;
    image_fit: "Cover" | "Contain" | "Stretch" | "Original Size";
    overlay_color: string;
    overlay_opacity: number;
    object_position_x: number;
    object_position_y: number;
    // Real, editable property — but BannerSlider (both here and in the
    // reference) never reads it. Autoplay is a hardcoded 5s interval
    // regardless of this value. Kept editable for schema parity, not wired
    // to the timer, matching the reference exactly.
    appear_after: number;
    content_horizontal_alignment: "Left" | "Center" | "Right";
    content_vertical_alignment: "Top" | "Center" | "Bottom";
    heading_text: string;
    heading_size: "Small" | "Medium" | "Large";
    heading_color: string;
    text: string;
    text_style: "Body" | "Subtitle";
    text_color: string;
    button_label: string;
    button_link: string;
    button_style: "Outline" | "Filled";
    button_color: string;
    button_hover_text_color?: string;
    // Only meaningful when button_style is "Filled" (Outline uses
    // button_color for both border and text).
    button_text_color: string;
}

export interface SparkBannerSlideBlock {
    id: string;
    hidden?: boolean;
    settings: SparkBannerSlideBlockSettings;
}

export interface SparkImageBannerSettings {
    banner_height: "Small" | "Medium" | "Large";
    background_color: string;
    padding_top: number;
    padding_bottom: number;
}

// Rich Text has 3 block types (Heading limit 1, Text limit 2, Button limit
// 1) coexisting in one ordered, freely-interleavable list — matching the
// reference's own model exactly (a single `blocks` array holding any block
// type; per-type limits are enforced by the editor's "Add block" UI, not
// this shape). Unlike Header's vestigial `font` field, Font here is a real,
// rendering-affecting property (see sections/RichText.tsx).
export interface SparkRichTextSettings {
    background_color: string;
    padding_top: number;
    padding_bottom: number;
}

export interface SparkRichTextHeadingBlockSettings {
    text: string;
    size: "Small" | "Medium" | "Large";
    color: string;
    font: "Outfit" | "Playfair Display";
}

export interface SparkRichTextTextBlockSettings {
    text: string;
    style: "Body" | "Subtitle";
    color: string;
    font: "Outfit" | "Playfair Display";
}

export interface SparkRichTextButtonBlockSettings {
    label: string;
    link: string;
    style: "Outline" | "Filled";
    button_color: string;
    button_text_color: string;
}

export type SparkRichTextBlock =
    | { id: string; type: "Heading"; hidden?: boolean; settings: SparkRichTextHeadingBlockSettings }
    | { id: string; type: "Text"; hidden?: boolean; settings: SparkRichTextTextBlockSettings }
    | { id: string; type: "Button"; hidden?: boolean; settings: SparkRichTextButtonBlockSettings };

// Unlike every other section so far, this one has no addable blocks (matches
// the reference's THEME_SCHEMA — "No addable blocks" on every property) and
// its content isn't stored in themeConfig at all: `collection_id` is a
// pointer to a real Collection doc, resolved to real products at render time
// via a new backend endpoint (CollectionController.fetchCollectionStorefrontProducts)
// rather than the reference's 8 hardcoded mock products.
export interface SparkFeaturedCollectionSettings {
    section_heading: string;
    collection_id: string;
    products_to_show: number;
    goto_label: string;
    goto_link: string;
    background_color: string;
    padding_top: number;
    padding_bottom: number;
}

// Same "no addable blocks" shape as Featured Collection, and the same
// real-vs-reference divergence: `product_id` points at a real Product doc,
// resolved to real product data at render time via the storefront's
// existing product-detail endpoint (already used by the PDP) rather than
// the reference's 5 hardcoded mock products keyed off a slug string.
export interface SparkFeaturedProductSettings {
    section_heading: string;
    product_id: string;
    show_description: boolean;
    show_price: boolean;
    show_add_to_cart: boolean;
    image_position: "Left" | "Right";
    background_color: string;
    padding_top: number;
    padding_bottom: number;
}

// Column blocks are a single homogeneous type capped at 4 (matches the
// reference's "Add up to 4 columns" note on every property) — same shape as
// Banner Slide, not Rich Text's mixed-type list. `font` is vestigial, same
// precedent as SparkAnnouncementBarBlockSettings.font: THEME_SCHEMA marks
// Heading/Text "Rich Text Editor", which the reference's generic property
// panel renders with a font dropdown, but Multicolumn.tsx (both here and in
// the reference) never applies it when rendering — kept only so the shared
// rich-text editor widget has somewhere to write it.
export interface SparkColumnBlockSettings {
    image_url: string;
    heading: string;
    text: string;
    link: string;
    font?: string;
}

export interface SparkColumnBlock {
    id: string;
    hidden?: boolean;
    settings: SparkColumnBlockSettings;
}

export interface SparkMulticolumnSettings {
    section_heading: string;
    columns_on_desktop: number;
    column_alignment: "Left" | "Center";
    background_color: string;
    padding_top: number;
    padding_bottom: number;
}

// Image with Text is the second mixed-type block list (after Rich Text) —
// Image (limit 1), Heading (limit 1), Text (limit 2), Button (limit 2)
// freely coexist in one ordered array, matching the reference's THEME_SCHEMA
// exactly. Unlike Rich Text, the Image block is never part of the visual
// text-column flow — it's always independently positioned by its own
// `image_position` (see sections/ImageWithText.tsx) — but it lives in the
// same `blocks` array for the editor's sidebar/reorder/type-picker to stay
// one consistent mechanism across both sections. `font` on Heading/Text is
// vestigial (see SparkColumnBlockSettings' comment) — the reference's own
// ImageWithText.tsx never applies it either. Object Position X/Y are real
// (image `object-position`), but the reference's drag-to-adjust canvas
// interaction isn't ported — plain sliders, same simplification already
// made for Banner Slide's identical properties.
export interface SparkImageWithTextSettings {
    background_color: string;
    padding_top: number;
    padding_bottom: number;
    content_horizontal_alignment: "Left" | "Center" | "Right";
    content_vertical_alignment: "Top" | "Center" | "Bottom";
}

export interface SparkImageWithTextImageBlockSettings {
    image_url: string;
    image_position: "Left" | "Right";
    image_size: "Small" | "Medium" | "Large";
    overlay_color: string;
    overlay_opacity: number;
    object_position_x: number;
    object_position_y: number;
}

export interface SparkImageWithTextHeadingBlockSettings {
    text: string;
    size: "Small" | "Medium" | "Large";
    color: string;
    font?: string;
}

export interface SparkImageWithTextTextBlockSettings {
    text: string;
    style: "Body" | "Subtitle";
    color: string;
    font?: string;
}

export interface SparkImageWithTextButtonBlockSettings {
    label: string;
    link: string;
    style: "Outline" | "Filled";
    button_color: string;
}

export type SparkImageWithTextBlock =
    | { id: string; type: "Image"; hidden?: boolean; settings: SparkImageWithTextImageBlockSettings }
    | { id: string; type: "Heading"; hidden?: boolean; settings: SparkImageWithTextHeadingBlockSettings }
    | { id: string; type: "Text"; hidden?: boolean; settings: SparkImageWithTextTextBlockSettings }
    | { id: string; type: "Button"; hidden?: boolean; settings: SparkImageWithTextButtonBlockSettings };

// No addable blocks (matches the reference's THEME_SCHEMA — "blocks": {}).
// `collection_ids` points at real Collection docs (checkbox multi-select in
// the editor, reusing the same collections redux slice as Featured
// Collection's dropdown) rather than the reference's array of plain name
// strings matched against a static image lookup table
// (Fype-E-Commerce-UI/src/themes/spark/sections/CollectionList.tsx's
// `collectionImages` record). `columns_on_desktop` is real (rendering-
// affecting — see CollectionList.tsx's own `sectionSettings['Columns on
// Desktop']` read) but genuinely absent from THEME_SCHEMA's declared
// properties, so the reference's own settings panel never lets a merchant
// edit it either — permanently fixed at its default (3) there. Matched
// exactly: kept here since it's still real, but the editor
// (sparkThemeSchema.ts's SPARK_COLLECTION_LIST_PROPERTIES) deliberately
// doesn't expose a control for it.
export interface SparkCollectionListSettings {
    section_heading: string;
    // Where the listed collections come from. Absent on configs saved before
    // collection groups existed, which means "pick" (the hand-picked list).
    source?: "pick" | "group";
    collection_ids: string[];
    // Used when source === "group": that group's collections are listed, in
    // the group's order, and follow the group as it changes.
    collection_group_id?: string;
    columns_on_desktop: number;
    goto_label: string;
    goto_link: string;
    background_color: string;
    padding_top: number;
    padding_bottom: number;
}

// Slide is a single homogeneous block type capped at 8 (matches the
// reference's THEME_SCHEMA "limit": 8) — same shape as Banner Slide, just a
// second, independently-configurable carousel section. "Sleek" style
// renders as a contained rounded card (aspect-ratio box); "Full Width" is a
// full-bleed fixed-height hero, matching Slideshow.tsx's own `isSleek`
// branching exactly.
export interface SparkSlideshowSettings {
    style: "Full Width" | "Sleek";
    color: string;
    padding_top: number;
    padding_bottom: number;
}

export interface SparkSlideBlockSettings {
    image_url: string;
    overlay_color: string;
    overlay_opacity: number;
    text: string;
    heading: string;
    button_text: string;
    button_style: "Outline" | "Filled";
    button_color: string;
    button_hover_text_color?: string;
    button_text_color: string;
    button_link: string;
}

export interface SparkSlideBlock {
    id: string;
    hidden?: boolean;
    settings: SparkSlideBlockSettings;
}

// Item is a single homogeneous block type capped at 12 (matches the
// reference's THEME_SCHEMA "limit": 12) — an FAQ-style accordion, no
// addable-block-type picker needed (same shape as Column/Slide/Banner
// Slide).
export interface SparkCollapsibleContentSettings {
    section_heading: string;
    background_color: string;
    block_color: string;
    text_color: string;
    padding_top: number;
    padding_bottom: number;
}

export interface SparkCollapsibleItemBlockSettings {
    title: string;
    content: string;
    open_by_default: boolean;
}

export interface SparkCollapsibleItemBlock {
    id: string;
    hidden?: boolean;
    settings: SparkCollapsibleItemBlockSettings;
}

// No addable blocks (matches the reference's THEME_SCHEMA — "blocks": {}).
// The reference's own submit handler is entirely decorative (a local
// setTimeout-based fake "submitted" state, no request anywhere) — matched
// exactly rather than building a real submission pipeline (new backend
// model/endpoint, likely email-notify wiring), which is genuinely separate
// scope from porting this section. `fields` mirrors the reference's "Field
// Checkboxes" property with a fixed option set (Name/Email/Phone
// Number/Subject/Location/Message) — unlike Collection List's Checkboxes,
// these options are static, not resolved from real store data.
export interface SparkContactFormSettings {
    heading: string;
    subtext: string;
    fields: string[];
    submit_button_label: string;
    success_message: string;
    background_color: string;
    padding_top: number;
    padding_bottom: number;
}

// Footer stays a fixed singleton, same precedent as Header/Announcement Bar
// (never duplicated in the reference either) — ported from Fype-E-Commerce-UI
// commit dc33eb4 "feat: add theme color customization support", the commit
// that first added a real Footer section (previously unbuilt).
export interface SparkFooterSettings {
    background_color: string;
    text_color: string;
    // Case-insensitive names matched against a fixed badge lookup at render
    // time (see sections/Footer.tsx) — same static-name-list convention as
    // SparkContactFormSettings.fields, not a real payment-provider integration.
    payment_icons: string[];
}

export interface SparkFooterTextBlockSettings {
    text: string;
}

export interface SparkFooterMenuBlockSettings {
    heading: string;
    menu_items: string[];
}

// Text is capped at 1, Menu at 6 — matches the reference's THEME_SCHEMA
// exactly (see Footer schema diff in commit dc33eb4).
export type SparkFooterBlock =
    | { id: string; type: "Text"; hidden?: boolean; settings: SparkFooterTextBlockSettings }
    | { id: string; type: "Menu"; hidden?: boolean; settings: SparkFooterMenuBlockSettings };

// A named, reusable palette — Shopify-style "color schemes" model, ported
// from the reference's `ColorScheme` type (Fype-E-Commerce-UI's
// ThemeCustomizePage.tsx). Distinct from the pre-existing (and, same as in
// the reference, still unconsumed-by-rendering) settings.colors/typography
// above — that was ported earlier from spark.config.json's top-level
// `settings` block; this is the reference's newer, separate system.
export interface SparkColorScheme {
    id: string;
    name: string;
    background: string;
    background_gradient: string;
    text: string;
    // Defined and editable, matching the reference's own scheme fields
    // exactly, but — same as the reference itself — not yet consumed by any
    // button/section rendering. Kept for schema parity with the design
    // source of truth rather than invented ahead of it.
    solid_button_background: string;
    solid_button_label: string;
    outline_button: string;
    shadow: string;
}

export interface SparkThemeSettingsLogo {
    logo_url: string;
    logo_width: number;
    footer_logo_url: string;
    footer_logo_width: number;
    favicon_url: string;
}

export interface SparkThemeSettingsSocialMedia {
    facebook: string;
    instagram: string;
    x_twitter: string;
    linkedin: string;
    youtube: string;
    tiktok: string;
    snapchat: string;
    pinterest: string;
}

export interface SparkThemeSettingsPages {
    shop_show_in_navbar: boolean;
    shop_navbar_label: string;
    collections_show_in_navbar: boolean;
    collections_navbar_label: string;
    collection_page_show_in_navbar: boolean;
    collection_page_navbar_label: string;
    product_show_in_navbar: boolean;
    product_navbar_label: string;
}

// Site-wide settings shared by the editor and storefront renderers.
export interface SparkThemeSettings {
    logo: SparkThemeSettingsLogo;
    colors: { schemes: SparkColorScheme[]; active_scheme_id: string };
    typography: { heading_font: string; sub_heading_font: string; body_font: string };
    layout: { page_width: number; section_spacing: number; horizontal_spacing: number; vertical_spacing: number };
    animation: { section_animation: string; hover_animation: string };
    social_media: SparkThemeSettingsSocialMedia;
    pages: SparkThemeSettingsPages;
}

// Body is a real Shopify-style ordered list of section *instances* (each
// with its own unique `id`, independent of `type`) — not a fixed one-per-
// type object like Header/Announcement Bar still are. This matches the
// reference's actual "Add Section" behavior exactly: its own popover lists
// every type in THEME_SCHEMA[category] regardless of whether one's already
// on the page, so e.g. two Rich Text sections can coexist. Header stays a
// fixed singleton (it bundles Announcement Bar and is never duplicated in
// any real theme, including the reference's own usage) — this instance
// model is deliberately scoped to Body only, matching what "Add Section"
// actually needs.
export type SparkBodySection =
    | { id: string; type: "image_banner"; hidden?: boolean; settings: SparkImageBannerSettings; banner_slides: SparkBannerSlideBlock[] }
    | { id: string; type: "rich_text"; hidden?: boolean; settings: SparkRichTextSettings; blocks: SparkRichTextBlock[] }
    | { id: string; type: "featured_collection"; hidden?: boolean; settings: SparkFeaturedCollectionSettings }
    | { id: string; type: "featured_product"; hidden?: boolean; settings: SparkFeaturedProductSettings }
    | { id: string; type: "multicolumn"; hidden?: boolean; settings: SparkMulticolumnSettings; blocks: SparkColumnBlock[] }
    | { id: string; type: "image_with_text"; hidden?: boolean; settings: SparkImageWithTextSettings; blocks: SparkImageWithTextBlock[] }
    | { id: string; type: "collection_list"; hidden?: boolean; settings: SparkCollectionListSettings }
    | { id: string; type: "slideshow"; hidden?: boolean; settings: SparkSlideshowSettings; blocks: SparkSlideBlock[] }
    | { id: string; type: "collapsible_content"; hidden?: boolean; settings: SparkCollapsibleContentSettings; blocks: SparkCollapsibleItemBlock[] }
    | { id: string; type: "contact_form"; hidden?: boolean; settings: SparkContactFormSettings };

export type SparkBodySectionType = SparkBodySection["type"];

export interface SparkSectionsConfig {
    announcement_bar: { type: "announcement_bar"; settings: SparkAnnouncementBarSettings };
    // Section-level `hidden` (the sidebar's eye icon on the Header row
    // itself, not a block within it) — same persisted-visibility model as
    // the block-level `hidden` above.
    header: { type: "header"; hidden?: boolean; settings: SparkHeaderSettings };
    body: SparkBodySection[];
    // Section-level `hidden`/`blocks`, same persisted-visibility/replace-
    // wholesale conventions as Header/Body above.
    footer: { type: "footer"; hidden?: boolean; settings: SparkFooterSettings; blocks: SparkFooterBlock[] };
    // Other section types (email_signup) exist in the design reference but
    // aren't ported yet — deliberately deferred, see runbook.
}

// ---- Page settings — unlike Home's `sections` (a live-editable body of
// section instances), Shop/Collections/Collection Page/Product are real,
// fixed-layout pages (already fully built against real catalog data before
// this settings layer existed) with a flat set of display/layout knobs each.
// Ported from the design reference's ThemeCustomizePage.tsx per-page
// settings objects (shopLayoutSettings/collectionsLayoutSettings/
// collectionPageLayoutSettings/productPageLayoutSettings) — those never
// persisted anywhere even in the reference itself (pure editor-session
// React state); this is the first real, persisted implementation.
export interface SparkShopPageSettings {
    page_title: string;
    show_page_title: boolean;
    page_title_alignment: "Left" | "Center";
    products_per_row: "2" | "3" | "4";
    show_product_name: boolean;
    show_price: boolean;
    show_badges: boolean;
    // Real 4-value union (storefront-next's actual ProductSortBy), not the
    // reference's 3-option enum — the real backend/UI already only knows
    // these 4 values. Only a *default* for when no `?sortBy=` is present —
    // ProductFilters.tsx's own sort dropdown already works independently.
    default_sort: ProductSortBy;
}

export interface SparkCollectionsPageSettings {
    page_title: string;
    subtitle: string;
    // Only 2 breakpoint tiers exist in CollectionsPage.tsx today
    // (grid-cols-1 md:grid-cols-3, no lg: tier) — matches the reference's
    // own 2-option field exactly, not a 3-tier scale like Shop's.
    collections_per_row: "2" | "3";
    show_collection_name: boolean;
}

// Per-collection custom hero banner override, matched by `collection_id`
// (a real, stable Collection _id) rather than the reference's fragile
// name-string match (which silently stops matching if a collection is
// renamed).
export interface SparkCollectionPageHeroOverride {
    id: string;
    collection_id: string;
    hero_images: string[];
    heading: string;
    text: string;
}

export interface SparkCollectionPageSettings {
    default_banner_images: string[];
    banner_heading: string;
    banner_text: string;
    hero_overrides: SparkCollectionPageHeroOverride[];
    products_per_row: "2" | "3" | "4";
    section_title: string;
    show_product_count: boolean;
    show_product_name: boolean;
    show_price: boolean;
    show_badges: boolean;
}

export interface SparkProductHighlight {
    title: string;
    text: string;
}

export interface SparkProductPageSettings {
    image_layout: "Main + Thumbnails Below" | "Main + Thumbnails Side" | "Single Image";
    show_breadcrumb: boolean;
    show_description: boolean;
    description_position: "Below Add to Cart" | "Below Product Title";
    show_wishlist: boolean;
    // Custom link can be either a URL or a page slug
    custom_link_label: string;
    custom_link_url: string;
    custom_link_page_id?: string;
    // Merchant-authored trust/policy rows (Truck / Refresh / Shield icons in
    // order). Empty titles are not rendered — never mock US-shipping copy.
    highlights: SparkProductHighlight[];
}

export interface SparkPageSettings {
    shop: SparkShopPageSettings;
    collections: SparkCollectionsPageSettings;
    collection_page: SparkCollectionPageSettings;
    product: SparkProductPageSettings;
}

export interface SparkConfig {
    name: string;
    version: string;
    theme_id: string;
    settings: {
        colors: {
            primary: string;
            secondary: string;
            accent: string;
            text: string;
            text_muted: string;
            border: string;
        };
        typography: {
            heading_font: string;
            body_font: string;
            accent_font: string;
        };
    };
    theme_settings: SparkThemeSettings;
    sections: SparkSectionsConfig;
    page_settings: SparkPageSettings;
}

// Shape of a merchant's saved/draft overrides (Theme.themeConfig on the
// backend, or a customization editor's unsaved draft) — every field optional
// since it's only ever merged onto sparkDefaultConfig, never used standalone.
// `blocks` arrays are replaced wholesale rather than merged element-by-element
// when present — the editor always sends the full resolved snapshot (see
// SparkCustomizeTheme.tsx's handleSave), so there's never a sparse partial
// blocks list to reconcile against the base.
export interface SparkConfigOverride {
    settings?: {
        colors?: Partial<SparkConfig["settings"]["colors"]>;
        typography?: Partial<SparkConfig["settings"]["typography"]>;
    };
    theme_settings?: {
        logo?: Partial<SparkThemeSettingsLogo>;
        // `schemes` replaced wholesale, same convention as every `blocks`
        // array — the editor always sends the full resolved list.
        colors?: { schemes?: SparkColorScheme[]; active_scheme_id?: string };
        typography?: Partial<SparkThemeSettings["typography"]>;
        layout?: Partial<SparkThemeSettings["layout"]>;
        animation?: Partial<SparkThemeSettings["animation"]>;
        social_media?: Partial<SparkThemeSettingsSocialMedia>;
        pages?: Partial<SparkThemeSettingsPages>;
    };
    sections?: {
        announcement_bar?: { settings?: Partial<SparkAnnouncementBarSettings> };
        header?: { hidden?: boolean; settings?: Partial<SparkHeaderSettings> };
        // Replaced wholesale, same convention every `blocks` array already
        // uses — the editor always sends the full resolved list (including
        // adds/removes/reorders), never a sparse partial to reconcile.
        body?: SparkBodySection[];
        footer?: { hidden?: boolean; settings?: Partial<SparkFooterSettings>; blocks?: SparkFooterBlock[] };
    };
    page_settings?: {
        shop?: Partial<SparkShopPageSettings>;
        collections?: Partial<SparkCollectionsPageSettings>;
        // `hero_overrides`/`default_banner_images` replaced wholesale, same
        // convention as every other array field here.
        collection_page?: Partial<SparkCollectionPageSettings>;
        product?: Partial<SparkProductPageSettings>;
    };
}

// One-level-deep merge (per section/settings key), mirroring how the backend
// (crmApp's theme.controller.ts updateTheme) merges partial saves — so a
// draft that only edits the hero banner never drops header/announcement
// overrides, and vice versa.
export function mergeSparkConfig(base: SparkConfig, override?: SparkConfigOverride | Record<string, unknown> | null): SparkConfig {
    if (!override) return base;
    const o = override as SparkConfigOverride;
    const mergedBody = o.sections?.body ?? base.sections.body;
    const normalizedBody = mergedBody.map((section) => {
        if (section.type !== "image_with_text") return section;

        const legacyHeading = section.blocks.find(
            (block): block is Extract<SparkImageWithTextBlock, { type: "Heading" }> =>
                block.type === "Heading" &&
                /^\s*<span[^>]*>\s*Sustainability\s*<\/span>/i.test(block.settings.text)
        );
        const hasSubtitle = section.blocks.some(
            (block) => block.type === "Text" && block.settings.style === "Subtitle" && /sustainability/i.test(block.settings.text)
        );
        if (!legacyHeading || hasSubtitle) return section;

        const headingText = legacyHeading.settings.text.replace(/^\s*<span[^>]*>\s*Sustainability\s*<\/span>\s*/i, "");
        const subtitle = {
            id: `${legacyHeading.id}_subtitle`,
            type: "Text" as const,
            settings: {
                text: "Sustainability",
                style: "Subtitle" as const,
                color: legacyHeading.settings.color,
                font: legacyHeading.settings.font ?? "Outfit",
            },
        };
        const migratedBlocks: SparkImageWithTextBlock[] = section.blocks.map((block) => {
            if (block.type !== "Heading" || block.id !== legacyHeading.id) return block;
            return {
                ...block,
                settings: { ...block.settings, text: headingText },
            };
        });
        const headingIndex = migratedBlocks.findIndex((block) => block.id === legacyHeading.id);
        migratedBlocks.splice(headingIndex, 0, subtitle);

        return {
            ...section,
            blocks: migratedBlocks,
        };
    });

    return {
        ...base,
        settings: {
            colors: { ...base.settings.colors, ...(o.settings?.colors ?? {}) },
            typography: { ...base.settings.typography, ...(o.settings?.typography ?? {}) },
        },
        theme_settings: {
            logo: { ...base.theme_settings.logo, ...(o.theme_settings?.logo ?? {}) },
            colors: {
                schemes: o.theme_settings?.colors?.schemes ?? base.theme_settings.colors.schemes,
                active_scheme_id: o.theme_settings?.colors?.active_scheme_id ?? base.theme_settings.colors.active_scheme_id,
            },
            typography: { ...base.theme_settings.typography, ...(o.theme_settings?.typography ?? {}) },
            layout: { ...base.theme_settings.layout, ...(o.theme_settings?.layout ?? {}) },
            animation: { ...base.theme_settings.animation, ...(o.theme_settings?.animation ?? {}) },
            social_media: { ...base.theme_settings.social_media, ...(o.theme_settings?.social_media ?? {}) },
            pages: { ...base.theme_settings.pages, ...(o.theme_settings?.pages ?? {}) },
        },
        sections: {
            announcement_bar: {
                type: "announcement_bar",
                settings: { ...base.sections.announcement_bar.settings, ...(o.sections?.announcement_bar?.settings ?? {}) },
            },
            header: {
                type: "header",
                hidden: o.sections?.header?.hidden ?? base.sections.header.hidden,
                settings: { ...base.sections.header.settings, ...(o.sections?.header?.settings ?? {}) },
            },
            body: normalizedBody,
            footer: {
                type: "footer",
                hidden: o.sections?.footer?.hidden ?? base.sections.footer.hidden,
                settings: { ...base.sections.footer.settings, ...(o.sections?.footer?.settings ?? {}) },
                blocks: o.sections?.footer?.blocks ?? base.sections.footer.blocks,
            },
        },
        page_settings: {
            shop: { ...base.page_settings.shop, ...(o.page_settings?.shop ?? {}) },
            collections: { ...base.page_settings.collections, ...(o.page_settings?.collections ?? {}) },
            collection_page: {
                ...base.page_settings.collection_page,
                ...(o.page_settings?.collection_page ?? {}),
            },
            product: {
                ...base.page_settings.product,
                ...(o.page_settings?.product ?? {}),
                highlights: o.page_settings?.product?.highlights ?? base.page_settings.product.highlights,
            },
        },
    };
}

// Every Spark page builds its header nav the same way: the three fixed,
// always-real storefront routes first, then whatever generic pages the
// merchant has created — so the bar is never empty on a fresh store and
// never loses Shop/Collections once a custom page exists (the old
// per-page `header.settings.navigation` fallback showed placeholder
// labels like "About"/"Blog" all pointing at /products, and disappeared
// completely as soon as navPages was non-empty).
export function buildSparkNavItems(navPages: Page[]): Array<{ label: string; href: string }> {
    return [
        { label: "Home", href: "/" },
        { label: "Shop", href: "/products" },
        { label: "Collections", href: "/collections" },
        ...navPages
            .filter((p) => p.isActive && p.status === "visible" && p.pageType === "generic")
            .map((p) => ({ label: p.title, href: `/${p.slug}` })),
    ];
}

export const sparkDefaultConfig: SparkConfig = {
    name: "Spark",
    version: "1.0.0",
    theme_id: "spark-core-theme",
    settings: {
        colors: {
            primary: "#000000",
            secondary: "#ffffff",
            accent: "#f5f5f5",
            text: "#111827",
            text_muted: "#6b7280",
            border: "#e5e7eb",
        },
        typography: {
            heading_font: "Outfit, sans-serif",
            body_font: "Outfit, sans-serif",
            accent_font: "Playfair Display, serif",
        },
    },
    theme_settings: {
        logo: {
            logo_url: "",
            logo_width: 120,
            footer_logo_url: "",
            footer_logo_width: 120,
            favicon_url: "",
        },
        colors: {
            // Matches the reference's own DEFAULT_COLOR_SCHEMES exactly (two
            // starter schemes — a light default and a dark alternate).
            schemes: [
                {
                    id: "scheme-1",
                    name: "Scheme 1",
                    background: "#ffffff",
                    background_gradient: "",
                    text: "#111827",
                    solid_button_background: "#111827",
                    solid_button_label: "#ffffff",
                    outline_button: "#111827",
                    shadow: "#0000001a",
                },
                {
                    id: "scheme-2",
                    name: "Scheme 2",
                    background: "#0f172a",
                    background_gradient: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
                    text: "#f8fafc",
                    solid_button_background: "#3b82f6",
                    solid_button_label: "#ffffff",
                    outline_button: "#94a3b8",
                    shadow: "#00000040",
                },
            ],
            active_scheme_id: "scheme-1",
        },
        typography: {
            heading_font: "Outfit",
            sub_heading_font: "Outfit",
            body_font: "Outfit",
        },
        layout: {
            page_width: 1200,
            section_spacing: 40,
            horizontal_spacing: 0,
            vertical_spacing: 0,
        },
        animation: {
            section_animation: "None",
            hover_animation: "None",
        },
        social_media: {
            facebook: "",
            instagram: "",
            x_twitter: "",
            linkedin: "",
            youtube: "",
            tiktok: "",
            snapchat: "",
            pinterest: "",
        },
        pages: {
            shop_show_in_navbar: true,
            shop_navbar_label: "Shop",
            collections_show_in_navbar: true,
            collections_navbar_label: "Collections",
            collection_page_show_in_navbar: false,
            collection_page_navbar_label: "Collection Page",
            product_show_in_navbar: false,
            product_navbar_label: "Product",
        },
    },
    sections: {
        announcement_bar: {
            type: "announcement_bar",
            settings: {
                show: true,
                blocks: [
                    {
                        id: "announcement_1",
                        settings: {
                            text: "Free shipping on orders over $150",
                            link: "",
                            text_animation: "Slide",
                            speed: 20,
                            appear_after: 5,
                            background_color: "#111111",
                            text_color: "#ffffff",
                        },
                    },
                ],
            },
        },
        header: {
            type: "header",
            settings: {
                logo_type: "Text Only",
                logo_text: "SPARK",
                logo_image_url: "",
                logo_position: "Left",
                menu_style: "Tabs",
                navigation: ["Shop", "Collections", "About", "Blog"],
                sticky_header: true,
                glass_effect: true,
                background_color: "#ffffff",
                foreground_color: "#000000",
            },
        },
        // Body's default order matches the reference's own default homepage
        // section order exactly. Each instance's `id` is stable across
        // reloads (not regenerated per-request) so a merchant's saved
        // override (which references these ids for hidden/settings/blocks
        // overrides on the *default* instances) keeps matching after a
        // deploy — only "Add Section" mints fresh Date.now()-based ids for
        // genuinely new instances.
        body: [
            {
                id: "image_banner_1",
                type: "image_banner",
                settings: {
                    banner_height: "Large",
                    background_color: "#f9fafb",
                    padding_top: 0,
                    padding_bottom: 0,
                },
                banner_slides: [
                    {
                        id: "banner_slide_1",
                        settings: {
                            image_url: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80",
                            image_fit: "Cover",
                            overlay_color: "#000000",
                            overlay_opacity: 40,
                            object_position_x: 50,
                            object_position_y: 50,
                            appear_after: 5,
                            content_horizontal_alignment: "Center",
                            content_vertical_alignment: "Center",
                            heading_text: "Ignite your style",
                            heading_size: "Large",
                            heading_color: "#ffffff",
                            text: "The New Standard",
                            text_style: "Subtitle",
                            text_color: "#ffffff",
                            button_label: "Discover More",
                            button_link: "/products",
                            button_style: "Outline",
                            button_color: "#ffffff",
                            button_hover_text_color: "#000000",
                            button_text_color: "#000000",
                        },
                    },
                    {
                        id: "banner_slide_2",
                        settings: {
                            image_url: "https://images.unsplash.com/photo-1445205170230-053b83016050?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80",
                            image_fit: "Cover",
                            overlay_color: "#000000",
                            overlay_opacity: 40,
                            object_position_x: 50,
                            object_position_y: 50,
                            appear_after: 5,
                            content_horizontal_alignment: "Center",
                            content_vertical_alignment: "Center",
                            heading_text: "Winter Collection",
                            heading_size: "Large",
                            heading_color: "#ffffff",
                            text: "Stay warm and stylish",
                            text_style: "Subtitle",
                            text_color: "#ffffff",
                            button_label: "Shop Winter",
                            button_link: "/products",
                            button_style: "Filled",
                            button_color: "#ffffff",
                            button_text_color: "#000000",
                        },
                    },
                ],
            },
            {
                id: "rich_text_1",
                type: "rich_text",
                settings: {
                    background_color: "#ffffff",
                    padding_top: 128,
                    padding_bottom: 128,
                },
                blocks: [
                    {
                        id: "rich_text_heading_1",
                        type: "Heading",
                        settings: {
                            text: 'We believe in creating products that <span class="font-medium">last</span>. Crafted with the finest <span class="italic text-gray-500" style="font-family: \'Playfair Display\', serif;">sustainable materials</span>.',
                            size: "Large",
                            color: "#111827",
                            font: "Outfit",
                        },
                    },
                    {
                        id: "rich_text_text_1",
                        type: "Text",
                        settings: {
                            text: "Experience the perfect balance of form and function",
                            style: "Body",
                            color: "#9ca3af",
                            font: "Outfit",
                        },
                    },
                    {
                        id: "rich_text_button_1",
                        type: "Button",
                        settings: {
                            label: "Read our story",
                            link: "",
                            style: "Outline",
                            button_color: "#000000",
                            button_text_color: "#ffffff",
                        },
                    },
                ],
            },
            {
                id: "featured_collection_1",
                type: "featured_collection",
                // Empty collection_id until a merchant picks a real one in
                // the editor — FeaturedCollection.tsx renders nothing (not a
                // mock grid) when unset, unlike the reference's
                // always-populated mock.
                settings: {
                    section_heading: "New Arrivals",
                    collection_id: "",
                    products_to_show: 4,
                    goto_label: "View all",
                    goto_link: "/products",
                    background_color: "#ffffff",
                    padding_top: 128,
                    padding_bottom: 128,
                },
            },
            {
                id: "featured_product_1",
                type: "featured_product",
                // Empty product_id until a merchant picks a real one —
                // matches Featured Collection's empty-default convention.
                settings: {
                    section_heading: "",
                    product_id: "",
                    show_description: true,
                    show_price: true,
                    show_add_to_cart: true,
                    image_position: "Left",
                    background_color: "#f9fafb",
                    padding_top: 128,
                    padding_bottom: 128,
                },
            },
            // Pure static content (like Rich Text/Image Banner, not
            // data-driven like Featured Collection/Product), so — matching
            // those sections' own precedent — ships pre-filled with real
            // default content rather than starting empty. Icons/copy match
            // the reference's own default 3 columns exactly.
            {
                id: "multicolumn_1",
                type: "multicolumn",
                settings: {
                    section_heading: "Why choose us",
                    columns_on_desktop: 3,
                    column_alignment: "Center",
                    background_color: "#ffffff",
                    padding_top: 128,
                    padding_bottom: 128,
                },
                blocks: [
                    {
                        id: "column_1",
                        settings: {
                            image_url:
                                'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%23000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 18H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3"/><path d="M14 18h-4"/><path d="M14 12V4a2 2 0 0 1 2-2h3l4 6v8h-3"/><path d="M19 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"/><path d="M9 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"/></svg>',
                            heading: "Free Shipping",
                            text: "On all orders over $150. Fast, reliable delivery straight to your door.",
                            link: "",
                        },
                    },
                    {
                        id: "column_2",
                        settings: {
                            image_url:
                                'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%23000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>',
                            heading: "Sustainable",
                            text: "We offset 100% of carbon emissions from shipping and packaging.",
                            link: "",
                        },
                    },
                    {
                        id: "column_3",
                        settings: {
                            image_url:
                                'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%23000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2-1 4-2 7-2 2.76 0 4.96.88 7 2a1 1 0 0 1 1 1v7Z"/><path d="m9 12 2 2 4-4"/></svg>',
                            heading: "Lifetime Guarantee",
                            text: "Our products are built to last a lifetime. We stand behind our quality.",
                            link: "",
                        },
                    },
                ],
            },
            // Pure static content, same precedent as Multicolumn — ships
            // pre-filled with the reference's own default Image/Heading/Text
            // (no default Button — the reference's own default has none
            // either).
            {
                id: "image_with_text_1",
                type: "image_with_text",
                settings: {
                    background_color: "#ffffff",
                    padding_top: 80,
                    padding_bottom: 80,
                    content_horizontal_alignment: "Left",
                    content_vertical_alignment: "Center",
                },
                blocks: [
                    {
                        id: "iwt_image",
                        type: "Image",
                        settings: {
                            image_url: "https://images.unsplash.com/photo-1606041008023-472dfb5e530f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80",
                            image_position: "Left",
                            image_size: "Medium",
                            overlay_color: "#000000",
                            overlay_opacity: 0,
                            object_position_x: 50,
                            object_position_y: 50,
                        },
                    },
                    {
                        id: "iwt_subtitle",
                        type: "Text",
                        settings: {
                            text: "Sustainability",
                            style: "Subtitle",
                            color: "",
                            font: "Outfit",
                        },
                    },
                    {
                        id: "iwt_heading",
                        type: "Heading",
                        settings: {
                            text: "Conscious Creation.",
                            size: "Large",
                            color: "",
                            font: "Outfit",
                        },
                    },
                    {
                        id: "iwt_text",
                        type: "Text",
                        settings: {
                            text: "Every material we use is traced back to its origin. We offset 100% of our carbon emissions and partner exclusively with factories that guarantee living wages and safe conditions for their workers.",
                            style: "Body",
                            color: "",
                            font: "Outfit",
                        },
                    },
                ],
            },
            // Empty collection_ids until a merchant picks real ones —
            // matches Featured Collection/Product's empty-default
            // convention (data-driven section, not pure static content like
            // Multicolumn/Image with Text).
            {
                id: "collection_list_1",
                type: "collection_list",
                settings: {
                    section_heading: "Shop by Category",
                    source: "pick",
                    collection_ids: [],
                    collection_group_id: "",
                    columns_on_desktop: 3,
                    goto_label: "",
                    goto_link: "",
                    background_color: "#ffffff",
                    padding_top: 128,
                    padding_bottom: 128,
                },
            },
            // Pure static content, same precedent as Multicolumn/Image with
            // Text — ships pre-filled with the reference's own default 3
            // slides.
            {
                id: "slideshow_1",
                type: "slideshow",
                settings: {
                    style: "Full Width",
                    color: "#ffffff",
                    padding_top: 0,
                    padding_bottom: 0,
                },
                blocks: [
                    {
                        id: "slide_1",
                        settings: {
                            image_url: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80",
                            overlay_color: "#000000",
                            overlay_opacity: 40,
                            text: "New Collection",
                            heading: "The Wash Series",
                            button_text: "Explore Now",
                            button_style: "Outline",
                            button_color: "#ffffff",
                            button_hover_text_color: "#000000",
                            button_text_color: "#000000",
                            button_link: "#",
                        },
                    },
                    {
                        id: "slide_2",
                        settings: {
                            image_url: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80",
                            overlay_color: "#000000",
                            overlay_opacity: 40,
                            text: "Essentials",
                            heading: "Everyday Comfort",
                            button_text: "Shop Essentials",
                            button_style: "Outline",
                            button_color: "#ffffff",
                            button_hover_text_color: "#000000",
                            button_text_color: "#000000",
                            button_link: "#",
                        },
                    },
                    {
                        id: "slide_3",
                        settings: {
                            image_url: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80",
                            overlay_color: "#000000",
                            overlay_opacity: 40,
                            text: "Accessories",
                            heading: "The Finishing Touch",
                            button_text: "Shop Accessories",
                            button_style: "Outline",
                            button_color: "#ffffff",
                            button_hover_text_color: "#000000",
                            button_text_color: "#000000",
                            button_link: "#",
                        },
                    },
                ],
            },
            // Pure static content — ships pre-filled with the reference's
            // own default 4 FAQ items.
            {
                id: "collapsible_content_1",
                type: "collapsible_content",
                settings: {
                    section_heading: "Frequently Asked Questions",
                    background_color: "transparent",
                    block_color: "#ffffff",
                    text_color: "#000000",
                    padding_top: 128,
                    padding_bottom: 128,
                },
                blocks: [
                    {
                        id: "faq_1",
                        settings: {
                            title: "What is your return policy?",
                            content:
                                "We accept returns within 30 days of delivery. Items must be in their original condition and packaging. Please note that return shipping costs are the responsibility of the customer.",
                            open_by_default: true,
                        },
                    },
                    {
                        id: "faq_2",
                        settings: {
                            title: "How long does shipping take?",
                            content: "Standard shipping usually takes 3-5 business days within the contiguous US. Expedited options are available at checkout.",
                            open_by_default: false,
                        },
                    },
                    {
                        id: "faq_3",
                        settings: {
                            title: "Do you ship internationally?",
                            content: "Yes, we offer worldwide shipping. International shipping rates and times vary by location and are calculated at checkout.",
                            open_by_default: false,
                        },
                    },
                    {
                        id: "faq_4",
                        settings: {
                            title: "Are your products ethically made?",
                            content: "Absolutely. We work directly with skilled artisans and responsible manufacturing partners who ensure fair wages and safe working conditions.",
                            open_by_default: false,
                        },
                    },
                ],
            },
            // Fully decorative, matching the reference exactly (its own
            // submit handler never sends anything anywhere either) — see
            // SparkContactFormSettings' comment.
            {
                id: "contact_form_1",
                type: "contact_form",
                settings: {
                    heading: "Get in touch",
                    subtext: "Have a question? We'd love to hear from you.",
                    fields: ["Name", "Email", "Message"],
                    submit_button_label: "Send Message",
                    success_message: "Thanks for contacting us. We'll get back to you as soon as possible.",
                    background_color: "#f9fafb",
                    padding_top: 128,
                    padding_bottom: 128,
                },
            },
        ],
        // Matches the reference's own default Footer section content exactly
        // (see commit dc33eb4's updated `sections` default array).
        footer: {
            type: "footer",
            settings: {
                background_color: "#f9fafb",
                text_color: "#6b7280",
                payment_icons: ["Visa", "Mastercard", "Amex", "PayPal", "Apple Pay", "Google Pay"],
            },
            blocks: [
                {
                    id: "footer_brand",
                    type: "Text",
                    settings: {
                        text: "Elevating the everyday through thoughtful design and uncompromising quality.",
                    },
                },
                {
                    id: "footer_menu_1",
                    type: "Menu",
                    settings: {
                        heading: "Shop",
                        menu_items: ["shop", "collections"],
                    },
                },
                {
                    id: "footer_menu_2",
                    type: "Menu",
                    settings: {
                        heading: "Pages",
                        menu_items: ["home"],
                    },
                },
                {
                    id: "footer_menu_3",
                    type: "Menu",
                    settings: {
                        heading: "More",
                        menu_items: [],
                    },
                },
            ],
        },
    },
    page_settings: {
        shop: {
            page_title: "Shop All",
            show_page_title: true,
            page_title_alignment: "Left",
            products_per_row: "4",
            show_product_name: true,
            show_price: true,
            show_badges: true,
            default_sort: "newest",
        },
        collections: {
            page_title: "Curated Collections",
            subtitle: "Explore our specialized ranges, thoughtfully designed around core materials and silhouettes.",
            collections_per_row: "3",
            show_collection_name: true,
        },
        collection_page: {
            default_banner_images: [],
            banner_heading: "",
            banner_text: "",
            hero_overrides: [],
            products_per_row: "4",
            section_title: "",
            show_product_count: true,
            show_product_name: true,
            show_price: true,
            show_badges: true,
        },
        product: {
            image_layout: "Main + Thumbnails Below",
            show_breadcrumb: true,
            show_description: true,
            description_position: "Below Add to Cart",
            show_wishlist: true,
            custom_link_label: "",
            custom_link_url: "",
            custom_link_page_id: "",
            highlights: [
                { title: "", text: "" },
                { title: "", text: "" },
                { title: "", text: "" },
            ],
        },
    },
};
