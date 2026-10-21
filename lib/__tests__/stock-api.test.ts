import { describe, it, expect, vi } from "vitest";
import { fetchStockForCartItems } from "@/lib/stock-api";
import { getApi } from "@/lib/client-api";
import type { CartItem } from "@/redux/slices/userSlice";

vi.mock("@/lib/client-api", () => ({ getApi: vi.fn() }));

// The checkout stock pre-check must not refuse what the backend would sell: untracked items and items that
// continue selling have no limit (null); tracked ones are limited to what is available.

const item = (productId: string, variantId?: string, quantity = 5) => ({ _id: `${productId}-${variantId ?? ""}`, productId, ...(variantId && { variantId }), name: "x", image: "", price: 1, quantity, maxQuantity: 99 }) as unknown as CartItem;
const respond = (product: Record<string, unknown>) => vi.mocked(getApi).mockResolvedValueOnce({ data: { data: { data: { product } } } } as never);

describe("fetchStockForCartItems", () => {
    it("simple product: limited when tracked, unlimited when untracked or continue selling", async () => {
        respond({ productId: "A", hasVariants: false, inventory: { available: 2, trackQuantity: true } });
        respond({ productId: "B", hasVariants: false, inventory: { available: 0, trackQuantity: false } });
        respond({ productId: "C", hasVariants: false, continueSelling: true, inventory: { available: 0, trackQuantity: true } });

        const map = await fetchStockForCartItems("S", [item("A"), item("B"), item("C")]);

        expect(map).toEqual({ A: 2, B: null, C: null });
    });

    it("variants: each variant's own switch and tracking decide, falling back to the product's", async () => {
        respond({
            productId: "P", hasVariants: true, continueSelling: false, inventory: null,
            variants: [
                { variantId: "own", continueSelling: true, inventory: { available: 0, trackQuantity: true } },
                { variantId: "untracked", inventory: { available: 0, trackQuantity: false } },
                { variantId: "limited", continueSelling: false, inventory: { available: 4, trackQuantity: true } },
                { variantId: "inherits", inventory: { available: 1, trackQuantity: true } },
            ],
        });

        const map = await fetchStockForCartItems("S", [item("P", "own"), item("P", "untracked"), item("P", "limited"), item("P", "inherits")]);

        expect(map).toEqual({ "P:own": null, "P:untracked": null, "P:limited": 4, "P:inherits": 1 });
    });

    it("the product's switch covers variants that have none of their own", async () => {
        respond({ productId: "P", hasVariants: true, continueSelling: true, inventory: null, variants: [{ variantId: "v", inventory: { available: 0, trackQuantity: true } }] });

        expect(await fetchStockForCartItems("S", [item("P", "v")])).toEqual({ "P:v": null });
    });

    it("a failed fetch means unknown (the backend decides)", async () => {
        vi.mocked(getApi).mockRejectedValueOnce(new Error("down"));
        vi.spyOn(console, "warn").mockImplementation(() => {});

        expect(await fetchStockForCartItems("S", [item("A")])).toEqual({ A: null });
    });
});
