import type { ProductVariant } from "@/types/storefront";
import { VARIANT_PARAM } from "@/lib/product-url";

interface OptionDefinition {
    name: string;
    values: string[];
}

/**
 * The options a product page starts on: those of the variant named by `?variant=`
 * when it is one of this product's variants, otherwise the first value of every
 * option. An unknown, stale or missing id never fails - it just means the default.
 */
export function initialSelectedOptions(
    options: OptionDefinition[],
    variants: Pick<ProductVariant, "variantId" | "options">[],
    variantId?: string | null
): Record<string, string> {
    const requested = variantId ? variants.find((variant) => variant.variantId === variantId) : undefined;
    const selected: Record<string, string> = {};
    for (const option of options) {
        const wanted = requested?.options[option.name];
        const value = wanted !== undefined && option.values.includes(wanted) ? wanted : option.values[0];
        if (value !== undefined) selected[option.name] = value;
    }
    return selected;
}

/**
 * Puts the chosen variant in the address bar (?variant=<id>), or takes it out when
 * there is none, without navigating: no refetch, no scroll, no new history entry.
 * Other query parameters and the hash are kept.
 */
export function syncVariantParam(variantId: string | null | undefined): void {
    if (typeof window === "undefined") return;
    try {
        const url = new URL(window.location.href);
        const current = url.searchParams.get(VARIANT_PARAM);
        if ((variantId ?? null) === current) return;
        if (variantId) url.searchParams.set(VARIANT_PARAM, variantId);
        else url.searchParams.delete(VARIANT_PARAM);
        window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    } catch {
        // The address bar is a convenience; never let it break the page.
    }
}
