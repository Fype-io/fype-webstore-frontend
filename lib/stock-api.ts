import { getApi } from "./client-api";
import type { CartItem } from "@/redux/slices/userSlice";
import { productContinueSelling, variantContinueSelling } from "./stock";

interface ProductDetailStockResponse {
    success: boolean;
    data: {
        data: {
            product: {
                productId: string;
                hasVariants: boolean;
                continueSelling?: boolean;
                inventory: { available: number; trackQuantity?: boolean; continueSelling?: boolean } | null;
                variants?: Array<{ variantId: string; continueSelling?: boolean; inventory: { available: number; trackQuantity?: boolean } }>;
            };
        };
    };
}

/**
 * Fetch available stock for all items in the cart.
 *
 * Returns a map keyed by `productId` (simple) or `productId:variantId` (variant).
 * - `number` = known available quantity
 * - `null`   = unknown / fetch failed / quantity not tracked / continueSelling enabled → caller should treat as "in stock"
 */
export async function fetchStockForCartItems(storeId: string, items: CartItem[]): Promise<Record<string, number | null>> {
    if (!items.length) return {};

    const uniqueProductIds = [...new Set(items.map((i) => i.productId))];

    const results = await Promise.allSettled(
        uniqueProductIds.map((productId) => getApi<ProductDetailStockResponse>(`/commerce/${storeId}/product/${productId}`))
    );

    const stockMap: Record<string, number | null> = {};

    results.forEach((result, index) => {
        const productId = uniqueProductIds[index];

        if (result.status === "rejected") {
            console.warn(`[stock-api] Failed to fetch stock for product ${productId}:`, result.reason);
            items
                .filter((i) => i.productId === productId)
                .forEach((i) => {
                    const key = i.variantId ? `${i.productId}:${i.variantId}` : i.productId;
                    stockMap[key] = null;
                });
            return;
        }

        const product = result.value.data.data.data.product;
        if (!product) return;

        if (product.hasVariants && product.variants) {
            for (const variant of product.variants) {
                const key = `${productId}:${variant.variantId}`;
                // Not tracked, or sold past zero (the variant's own switch, else the product's): no limit to enforce.
                const unlimited = variant.inventory?.trackQuantity === false || variantContinueSelling(variant, product);
                stockMap[key] = unlimited ? null : (variant.inventory?.available ?? null);
            }
            items
                .filter((i) => i.productId === productId && i.variantId)
                .forEach((i) => {
                    const key = `${productId}:${i.variantId}`;
                    if (!(key in stockMap)) stockMap[key] = null;
                });
        } else {
            const unlimited = product.inventory?.trackQuantity === false || productContinueSelling(product);
            stockMap[productId] = unlimited ? null : (product.inventory?.available ?? null);
        }
    });

    return stockMap;
}
