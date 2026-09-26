import { describe, it, expect, vi, afterEach } from "vitest";

// A two-theme registry stands in for the real one (which currently only has
// Spark), to prove selection works once a second theme is added.
vi.mock("@/components/themes/registry", () => ({
    themeRegistry: {
        spark: async () => ({ Layout: "SparkLayout", HomePage: "SparkHome" }),
        nova: async () => ({ Layout: "NovaLayout" }),
    },
    loadBaseThemeModule: async () => ({ Layout: "BaseLayout", Footer: "BaseFooter" }),
}));

import { resolveThemeSlug, loadTheme, FALLBACK_THEME } from "../theme";
import type { ThemeSlug } from "@/components/themes/registry";

describe("resolveThemeSlug", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("selects the store's own theme when it is registered", () => {
        expect(resolveThemeSlug("spark")).toBe("spark");
        expect(resolveThemeSlug("nova")).toBe("nova");
    });

    it.each([
        ["legacy theme_one", "theme_one"],
        ["auto-created default", "TEMPLATE-DEFAULT"],
        ["unshipped template", "TEMPLATE-abc123"],
        ["prototype key", "constructor"],
        ["empty string", ""],
        ["null", null],
        ["undefined", undefined],
    ])("falls back to Spark for an unregistered id (%s)", (_label, templateId) => {
        expect(resolveThemeSlug(templateId)).toBe("spark");
        expect(FALLBACK_THEME).toBe("spark");
    });

    it("behaves the same regardless of NODE_ENV", () => {
        vi.stubEnv("NODE_ENV", "production");
        expect(resolveThemeSlug("nova")).toBe("nova");
        expect(resolveThemeSlug("theme_one")).toBe("spark");
        vi.stubEnv("NODE_ENV", "development");
        expect(resolveThemeSlug("nova")).toBe("nova");
        expect(resolveThemeSlug("theme_one")).toBe("spark");
    });
});

describe("loadTheme", () => {
    it("layers the selected theme over the base module", async () => {
        const nova = (await loadTheme("nova" as ThemeSlug)) as unknown as Record<string, string>;
        expect(nova.Layout).toBe("NovaLayout");
        expect(nova.Footer).toBe("BaseFooter");

        const spark = (await loadTheme("spark")) as unknown as Record<string, string>;
        expect(spark.Layout).toBe("SparkLayout");
        expect(spark.HomePage).toBe("SparkHome");
    });
});
