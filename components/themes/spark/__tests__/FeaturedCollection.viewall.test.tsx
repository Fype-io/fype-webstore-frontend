import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import FeaturedCollection from "../sections/FeaturedCollection";
import type { SparkFeaturedCollectionSettings } from "../sparkConfig";
import type { StorefrontProduct } from "@/types/storefront";

vi.mock("@/lib/client-api", () => ({ getApi: vi.fn() }));
vi.mock("@/redux/hooks", () => ({
    useAppDispatch: () => vi.fn(),
    useAppSelector: (select: (state: unknown) => unknown) => select({ user: { isAuthenticated: false } }),
}));
vi.mock("@/components/themes/spark/SparkCartContext", () => ({ useSparkCart: () => ({ openCart: vi.fn() }) }));

const settings: SparkFeaturedCollectionSettings = {
    section_heading: "New Arrivals",
    collection_id: "c1",
    products_to_show: 4,
    goto_label: "View all",
    goto_link: "",
    background_color: "#fff",
    padding_top: 0,
    padding_bottom: 0,
};

const products = (n: number): StorefrontProduct[] =>
    Array.from({ length: n }, (_, i) => ({
        productId: `p${i + 1}`,
        name: `Product ${i + 1}`,
        slug: `product-${i + 1}`,
        image: "https://cdn.example.com/p.png",
        images: [],
        price: 10,
        compareAtPrice: 0,
        hasDiscount: false,
        discountPercentage: 0,
        hasVariants: false,
    }));

const collection = { _id: "c1", name: "Summer Sale", slug: "summer-sale" };

describe("Featured Collection View all and products per row", () => {
    it("offers one View all below the grid when the collection has more products than shown", () => {
        render(<FeaturedCollection settings={settings} storeId="s1" initialProducts={products(4)} initialTotal={11} initialCollection={collection} />);

        const links = screen.getAllByRole("link", { name: /View all/ });
        expect(links).toHaveLength(1);
        expect(links[0]).toHaveAttribute("href", "/collections/summer-sale");
    });

    it("keeps the header link, and no extra button, when everything is already shown", () => {
        render(<FeaturedCollection settings={settings} storeId="s1" initialProducts={products(4)} initialTotal={4} initialCollection={collection} />);

        expect(screen.getAllByRole("link", { name: /View all/ })).toHaveLength(1);
    });

    it("uses the merchant's link and label for the button when set", () => {
        render(
            <FeaturedCollection
                settings={{ ...settings, goto_label: "Shop the sale", goto_link: "/pages/sale" }}
                storeId="s1"
                initialProducts={products(4)}
                initialTotal={9}
                initialCollection={collection}
            />
        );

        expect(screen.getByRole("link", { name: /Shop the sale/ })).toHaveAttribute("href", "/pages/sale");
    });

    it("shows a View all button even with no label set, when there is more to see", () => {
        render(<FeaturedCollection settings={{ ...settings, goto_label: "" }} storeId="s1" initialProducts={products(4)} initialTotal={9} initialCollection={collection} />);

        expect(screen.getByRole("link", { name: /View all/ })).toHaveAttribute("href", "/collections/summer-sale");
    });

    it("sets products per row, with 4 for sections saved before the setting existed", () => {
        const { container, unmount } = render(<FeaturedCollection settings={settings} storeId="s1" initialProducts={products(4)} initialCollection={collection} />);
        expect(container.querySelector(".md\\:grid-cols-4")).not.toBeNull();
        unmount();

        const { container: wide } = render(<FeaturedCollection settings={{ ...settings, products_per_row: 6 }} storeId="s1" initialProducts={products(4)} initialCollection={collection} />);
        expect(wide.querySelector(".lg\\:grid-cols-6")).not.toBeNull();
    });
});
