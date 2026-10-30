// Whether a product (or variant) can be bought, decided the way the backend's checkout decides it:
//  - an item that does not track quantity has no stock to run out of;
//  - an item that sells past zero (its own continueSelling, else the product's) is never "out of stock";
//  - otherwise it needs stock on hand.
// The product page used to look at `available` alone (plus the product-level flag, read from a field the API does not
// send for products with variants), so shoppers saw "Out of stock" for items checkout would happily sell.

export interface StockFields {
    available?: number | null;
    /** Only an explicit `false` means "not tracked" (an absent value, e.g. placeholder data, is treated as tracked). */
    trackQuantity?: boolean;
    continueSelling?: boolean;
}

export function canBuy({ available, trackQuantity, continueSelling }: StockFields): boolean {
    return trackQuantity === false || continueSelling === true || (available ?? 0) > 0;
}

interface ContinueSellingSource {
    continueSelling?: boolean;
    continueSellWhenOutOfStock?: boolean;
    inventory?: { continueSelling?: boolean } | null;
}

/** The product's oversell switch, from whichever field the response carries (top level for products with variants). */
export function productContinueSelling(product: ContinueSellingSource): boolean {
    return product.continueSelling ?? product.inventory?.continueSelling ?? product.continueSellWhenOutOfStock ?? false;
}

/** The variant's own switch, falling back to the product's when it has none. */
export function variantContinueSelling(variant: { continueSelling?: boolean }, product: ContinueSellingSource): boolean {
    return variant.continueSelling ?? productContinueSelling(product);
}
