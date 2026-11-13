import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import ProductCard from "../ProductCard";
import { StoreCurrencyProvider } from "@/components/shared/StoreCurrency";
import type { StorefrontProduct } from "@/types/storefront";

vi.mock("@/redux/hooks", () => ({
    useAppDispatch: () => vi.fn(),
    useAppSelector: (select: (state: unknown) => unknown) => select({ user: { isAuthenticated: false, wishlist: [] } }),
}));
vi.mock("@/redux/slices/userSlice", () => ({ addToCart: vi.fn(), addToGuestCart: vi.fn(), fetchCart: vi.fn(), fetchGuestCart: vi.fn() }));
vi.mock("@/components/themes/spark/SparkCartContext", () => ({ useSparkCart: () => ({ openCart: vi.fn() }) }));

const product: StorefrontProduct = {
    productId: "PROD-abc1234567",
    name: "A very long perfume name that needs two lines to be read in full",
    slug: "perfume",
    image: "https://cdn.example.com/p.png",
    images: [],
    price: 2153,
    compareAtPrice: 2400,
    hasDiscount: true,
    discountPercentage: 10,
    hasVariants: false,
};

const renderCard = () =>
    render(
        <StoreCurrencyProvider currency="AED">
            <ProductCard product={product} />
        </StoreCurrencyProvider>,
    ).container;

describe("Spark ProductCard price and title", () => {
    it("shows prices with grouping and two decimals", () => {
        const text = renderCard().textContent;
        expect(text).toContain("AED 2,153.00");
        expect(text).toContain("AED 2,400.00");
    });

    it("the selling price is dark and medium weight, the compare-at price struck through and lighter", () => {
        const c = renderCard();
        const selling = [...c.querySelectorAll("p")].find((p) => p.textContent === "AED 2,153.00")!;
        expect(selling.className).toContain("font-medium");
        expect(selling.className).not.toContain("text-gray-500");
        const compare = [...c.querySelectorAll("p")].find((p) => p.textContent === "AED 2,400.00")!;
        expect(compare.className).toContain("line-through");
    });

    it("lets the title wrap to two lines instead of cutting it with one line", () => {
        const title = renderCard().querySelector("h3")!;
        expect(title.className).toContain("line-clamp-2");
        expect(title.className).not.toContain("truncate");
    });
});

describe("Spark ProductCard title height", () => {
    it("always reserves two lines, so prices line up across a row", () => {
        expect(renderCard().querySelector("h3")!.className).toContain("min-h-[3rem]");
    });
});
