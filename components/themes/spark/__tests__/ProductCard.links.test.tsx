import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import ProductCard from "../ProductCard";
import type { StorefrontProduct } from "@/types/storefront";

vi.mock("@/redux/hooks", () => ({
    useAppDispatch: () => vi.fn(),
    useAppSelector: (select: (state: unknown) => unknown) => select({ user: { isAuthenticated: false, wishlist: [] } }),
}));
vi.mock("@/redux/slices/userSlice", () => ({ addToCart: vi.fn(), addToGuestCart: vi.fn(), fetchCart: vi.fn(), fetchGuestCart: vi.fn() }));
vi.mock("@/components/themes/spark/SparkCartContext", () => ({ useSparkCart: () => ({ openCart: vi.fn() }) }));

const product = (over: Partial<StorefrontProduct>): StorefrontProduct => ({
    productId: "PROD-abc1234567",
    name: "Blue Shirt",
    slug: "blue-shirt",
    image: "https://cdn.example.com/p.png",
    images: [],
    price: 10,
    compareAtPrice: 0,
    hasDiscount: false,
    discountPercentage: 0,
    hasVariants: false,
    ...over,
});

const hrefOf = (p: StorefrontProduct) => render(<ProductCard product={p} />).container.querySelector("a")?.getAttribute("href");

describe("Spark ProductCard link", () => {
    it("links to the product's slug page", () => {
        expect(hrefOf(product({}))).toBe("/products/blue-shirt");
    });

    it("falls back to the product id for a product with no slug yet", () => {
        expect(hrefOf(product({ slug: null }))).toBe("/products/PROD-abc1234567");
    });

    it("opens a best-selling variant's tile on that variant", () => {
        expect(hrefOf(product({ variantId: "VAR-9" }))).toBe("/products/blue-shirt?variant=VAR-9");
    });
});
