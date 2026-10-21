import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ProductDetailsPage from "../ProductDetailsPage";
import type { ProductDetail, ProductVariant } from "@/types/storefront";

// Add to cart follows what checkout will accept: untracked items and items that sell past zero are buyable,
// whether the switch is on the product or on the variant.

vi.mock("@/redux/hooks", () => ({
    useAppDispatch: () => vi.fn(),
    useAppSelector: (select: (state: unknown) => unknown) => select({ user: { isAuthenticated: false, wishlist: [] } }),
}));
vi.mock("@/redux/slices/userSlice", () => ({
    addToCart: vi.fn(), addToGuestCart: vi.fn(), addToWishlist: vi.fn(), fetchCart: vi.fn(), fetchGuestCart: vi.fn(), removeFromWishlist: vi.fn(),
}));
vi.mock("@/components/themes/spark/SparkCartContext", () => ({ useSparkCart: () => ({ openCart: vi.fn() }) }));
vi.mock("@/components/themes/spark/SparkHeaderShell", () => ({ default: () => null }));
vi.mock("@/components/themes/spark/sections/Footer", () => ({ default: () => null }));
vi.mock("@/components/themes/spark/ProductGallery", () => ({ default: () => null }));
vi.mock("@/components/themes/spark/Header", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/components/shared/AuthModal", () => ({ default: () => null }));

const base = {
    productId: "PROD-1", slug: "thing", name: "Thing", description: "", images: ["a.jpg"], skuCode: "", barCode: "",
    continueSellWhenOutOfStock: false, price: { price: 10, compareAtPrice: 0, taxApplied: false, taxRate: 0 },
};
const simple = (over: Record<string, unknown>) => ({ ...base, hasVariants: false, ...over }) as unknown as ProductDetail;
const withVariants = (over: Record<string, unknown>) => ({ ...base, hasVariants: true, inventory: null, ...over }) as unknown as ProductDetail;
const variant = (over: Partial<ProductVariant> & { inventory: ProductVariant["inventory"] }): ProductVariant => ({
    _id: "V1", variantId: "V1", options: { Size: "M" }, price: 10, compareAtPrice: 0, sku: "", barcode: "", image: [], available: true, ...over,
});
const options = { options: [{ name: "Size", values: ["M"] }] };
const shop = { shopId: "s1", shopName: "Shop", settings: {} } as never;
const renderPage = (product: ProductDetail, variants: ProductVariant[] = []) =>
    render(<ProductDetailsPage shop={shop} navPages={[]} footerPages={[]} product={product} variants={variants} variantOptions={options} relatedProducts={[]} />);

const buyable = () => !(screen.getByRole("button", { name: /add to cart|out of stock/i }) as HTMLButtonElement).disabled;

describe("Spark product page: can it be bought", () => {
    it("tracked, in stock: yes; tracked, none left: no", () => {
        renderPage(simple({ inventory: { available: 3, trackQuantity: true } }));
        expect(buyable()).toBe(true);
    });

    it("tracked, none left: out of stock", () => {
        renderPage(simple({ inventory: { available: 0, trackQuantity: true } }));
        expect(buyable()).toBe(false);
        expect(screen.getByText("Out of stock")).toBeInTheDocument();
    });

    it("an item that does not track quantity is buyable at zero", () => {
        renderPage(simple({ inventory: { available: 0, trackQuantity: false } }));
        expect(buyable()).toBe(true);
    });

    it("continue selling on the product keeps it buyable at zero", () => {
        renderPage(simple({ inventory: { available: 0, trackQuantity: true, continueSelling: true } }));
        expect(buyable()).toBe(true);
    });

    it("variant: its own continueSelling makes it buyable at zero", () => {
        renderPage(withVariants({}), [variant({ inventory: { available: 0, trackQuantity: true }, continueSelling: true })]);
        expect(buyable()).toBe(true);
    });

    it("variant: an untracked variant is buyable at zero", () => {
        renderPage(withVariants({}), [variant({ inventory: { available: 0, trackQuantity: false } })]);
        expect(buyable()).toBe(true);
    });

    it("variant: the product-level switch (sent at the top level for products with variants) applies when the variant has none", () => {
        renderPage(withVariants({ continueSelling: true }), [variant({ inventory: { available: 0, trackQuantity: true } })]);
        expect(buyable()).toBe(true);
    });

    it("variant: tracked with none left and no switch is out of stock", () => {
        renderPage(withVariants({}), [variant({ inventory: { available: 0, trackQuantity: true } })]);
        expect(buyable()).toBe(false);
    });
});
