import type { ThemeSlug } from "@/components/themes/registry";

// Static demo shop names for the theme preset preview — never a real
// merchant's name, just enough for each theme's chrome (header/footer
// title) to render something sensible. Shared by the layout (chrome) and
// page (Home content) so both use the same static brand for a given theme.
export const DEMO_SHOP_NAMES: Record<ThemeSlug, string> = {
    spark: "Spark Demo",
};
