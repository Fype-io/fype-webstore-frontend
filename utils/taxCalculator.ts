export interface TaxCalculationResult {
    displayPrice: string;
}

/**
 * The price a shopper is shown. Prices are entered without tax and tax is always added at checkout; "prices include
 * tax" (inclusivePricing.webstore) only changes what is DISPLAYED: price + tax, with the tax shown as included.
 *
 * The rate is the server's `effectiveRate` (what the product or variant is taxed at under the store's tax settings,
 * including "charge tax" off and per-product mode). Without it (an older API, the editor's placeholder product) the
 * previous rule is used so nothing breaks.
 */
export const calculateProductTax = (
    basePrice: number,
    globalTax:
        | {
              global?: boolean;
              rate?: number;
              label?: string;
              inclusivePricing?: { webstore?: boolean };
          }
        | null
        | undefined,
    productTax: {
        applied?: boolean;
        rate?: number;
        effectiveRate?: number;
    }
): TaxCalculationResult => {
    const isInclusive = globalTax?.inclusivePricing?.webstore ?? false;
    let effectiveRate = 0;

    if (typeof productTax?.effectiveRate === "number" && Number.isFinite(productTax.effectiveRate)) {
        effectiveRate = productTax.effectiveRate;
    } else if (globalTax?.global ?? false) {
        effectiveRate = globalTax?.rate ?? 0;
    } else if (productTax?.applied) {
        effectiveRate = productTax?.rate ?? 0;
    } else {
        effectiveRate = globalTax?.rate ?? 0;
    }

    const formatPrice = (value: number): string => Number(value.toFixed(2)).toString();

    if (effectiveRate === 0 || !isInclusive) {
        return { displayPrice: formatPrice(basePrice) };
    }

    return { displayPrice: formatPrice(basePrice * (1 + effectiveRate / 100)) };
};

/** "CGST (9%)", "VAT (5%)": a tax line as shown to the shopper. */
/** "GST on shipping" for India's CGST/SGST/IGST, otherwise "<tax name> on shipping" (VAT on shipping ...). */
export const shippingTaxLabel = (lines: Array<{ type: string }>): string => {
    const types = lines.map((line) => line.type);
    if (types.some((type) => type === "CGST" || type === "SGST" || type === "IGST")) return "GST on shipping";
    return `${types[0] ?? "Tax"} on shipping`;
};

export const taxLineLabel = (line: { type: string; rate: number }): string =>
    line.rate > 0 ? `${line.type} (${Number(line.rate.toFixed(2))}%)` : line.type;
