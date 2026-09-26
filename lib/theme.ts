import {
    themeRegistry,
    loadBaseThemeModule,
    type ThemeSlug,
    type ResolvedThemeModule,
} from "@/components/themes/registry";

// Rendered for a templateId that isn't a registered theme: the legacy
// "theme_one", the auto-created "TEMPLATE-DEFAULT", or a template the backend
// knows about but this storefront build doesn't ship yet. Same in every
// environment.
export const FALLBACK_THEME: ThemeSlug = "spark";

export function isKnownThemeSlug(slug: string): slug is ThemeSlug {
    return Object.prototype.hasOwnProperty.call(themeRegistry, slug);
}

// A store's theme is its live Theme document's templateId.
export function resolveThemeSlug(templateId: string | null | undefined): ThemeSlug {
    return templateId && isKnownThemeSlug(templateId) ? templateId : FALLBACK_THEME;
}

// Merges the selected theme's module onto theme_one's as a baseline (see
// PartialThemeModule's docstring in registry.ts) — a theme that only
// implements e.g. Layout + HomePage still gets working components for every
// route it hasn't built yet, rather than those routes crashing on an
// undefined component.
export async function loadTheme(slug: ThemeSlug): Promise<ResolvedThemeModule> {
    const [base, override] = await Promise.all([loadBaseThemeModule(), themeRegistry[slug]()]);
    // Safe: `base` guarantees every ThemeModule field is present; `override`
    // only ever adds to or replaces those, never removes any.
    return { ...base, ...override } as ResolvedThemeModule;
}
