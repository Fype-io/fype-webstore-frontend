import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ProductDetailsPage from "../ProductDetailsPage";
import type { ProductDetail, ProductVariant } from "@/types/storefront";

// Variant URLs: the page opens on the variant named by ?variant=, and once the shopper
// picks an option the address bar follows the chosen variant (replaceState, no navigation).

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
vi.mock("@/lib/editor-preview", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/editor-preview")>()),
    isEditorPreview: vi.fn(() => false),
}));

import { isEditorPreview } from "@/lib/editor-preview";

const product = {
    productId: "PROD-1",
    slug: "reflection",
    name: "Reflection",
    description: "",
    images: [],
    hasVariants: true,
    continueSellWhenOutOfStock: false,
    skuCode: "",
    barCode: "",
    price: { price: 0, compareAtPrice: 0, taxApplied: false, taxRate: 0 },
} as unknown as ProductDetail;

const variant = (id: string, size: string, strength: string, price: number): ProductVariant => ({
    _id: id,
    variantId: id,
    options: { Size: size, Strength: strength },
    price,
    compareAtPrice: 0,
    sku: id,
    barcode: "",
    image: [],
    available: true,
    inventory: { available: 5, trackQuantity: true },
});

const variants = [variant("VAR-1", "50ML", "EDP", 980), variant("VAR-2", "100ML", "EDP", 1450), variant("VAR-3", "100ML", "Parfum", 1900)];
const variantOptions = {
    options: [
        { name: "Size", values: ["50ML", "100ML"] },
        { name: "Strength", values: ["EDP", "Parfum"] },
    ],
};

const shop = { shopId: "s1", shopName: "Shop", settings: {} } as never;
const renderPage = (initialVariantId?: string) =>
    render(
        <ProductDetailsPage
            shop={shop}
            navPages={[]}
            footerPages={[]}
            product={product}
            variants={variants}
            variantOptions={variantOptions}
            relatedProducts={[]}
            {...(initialVariantId ? { initialVariantId } : {})}
        />
    );

const selected = (name: string) => screen.getByRole("button", { name }).className.includes("bg-black");

describe("Spark product page: variant in the URL", () => {
    beforeEach(() => {
        window.history.replaceState(null, "", "/products/reflection");
        (isEditorPreview as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
    });
    afterEach(() => window.history.replaceState(null, "", "/"));

    it("opens on the first value of each option when the address names no variant", () => {
        renderPage();
        expect(selected("50ML")).toBe(true);
        expect(selected("EDP")).toBe(true);
        expect(window.location.search).toBe("");
    });

    it("opens on the variant named by ?variant=", () => {
        renderPage("VAR-3");
        expect(selected("100ML")).toBe(true);
        expect(selected("Parfum")).toBe(true);
        expect(selected("50ML")).toBe(false);
    });

    it("opens on the default when the variant id is unknown or stale", () => {
        renderPage("VAR-deleted");
        expect(selected("50ML")).toBe(true);
        expect(selected("EDP")).toBe(true);
    });

    it("does not touch the address on first paint, even with a variant given", () => {
        window.history.replaceState(null, "", "/products/reflection?variant=VAR-3");
        renderPage("VAR-3");
        expect(window.location.search).toBe("?variant=VAR-3");
    });

    it("puts the chosen variant in the address when the shopper changes an option, without a new history entry", () => {
        const entries = window.history.length;
        renderPage();

        fireEvent.click(screen.getByRole("button", { name: "100ML" }));
        expect(new URLSearchParams(window.location.search).get("variant")).toBe("VAR-2");

        fireEvent.click(screen.getByRole("button", { name: "Parfum" }));
        expect(new URLSearchParams(window.location.search).get("variant")).toBe("VAR-3");
        expect(window.location.pathname).toBe("/products/reflection");
        expect(window.history.length).toBe(entries);
    });

    it("never changes the address inside the theme customizer's frame", () => {
        (isEditorPreview as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
        renderPage();
        fireEvent.click(screen.getByRole("button", { name: "100ML" }));
        expect(window.location.search).toBe("");
    });
});
