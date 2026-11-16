import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import FeaturedCollection from "../sections/FeaturedCollection";
import type { SparkFeaturedCollectionSettings } from "../sparkConfig";
import type { StorefrontProduct } from "@/types/storefront";

const getApi = vi.fn();
vi.mock("@/lib/client-api", () => ({ getApi: (...args: unknown[]) => getApi(...args) }));
vi.mock("@/redux/hooks", () => ({
    useAppDispatch: () => vi.fn(),
    useAppSelector: (select: (state: unknown) => unknown) => select({ user: { isAuthenticated: false } }),
}));
vi.mock("@/components/themes/spark/SparkCartContext", () => ({ useSparkCart: () => ({ openCart: vi.fn() }) }));

const settings = (over: Partial<SparkFeaturedCollectionSettings> = {}): SparkFeaturedCollectionSettings => ({
    section_heading: "New Arrivals",
    collection_id: "c1",
    products_to_show: 4,
    goto_label: "",
    goto_link: "",
    background_color: "#fff",
    padding_top: 0,
    padding_bottom: 0,
    ...over,
});

const product = (id: string, name: string): StorefrontProduct => ({
    productId: id,
    name,
    slug: id,
    image: "https://cdn.example.com/p.png",
    images: [],
    price: 10,
    compareAtPrice: 0,
    hasDiscount: false,
    discountPercentage: 0,
    hasVariants: false,
});

const original = [product("p1", "Original Perfume"), product("p2", "Original Oud")];
const originalCollection = { _id: "c1", name: "Best Sellers", slug: "best-sellers" };

const view = (s: SparkFeaturedCollectionSettings) => (
    <FeaturedCollection settings={s} storeId="s1" initialProducts={original} initialTotal={2} initialCollection={originalCollection} isEditorPreview />
);

describe("Featured Collection in the editor: switching back to the collection the page was rendered with", () => {
    beforeEach(() => getApi.mockReset());

    it("shows the original collection's products again after picking another collection and going back", async () => {
        getApi.mockImplementation((url: string) =>
            Promise.resolve(
                String(url).includes("storefront-products")
                    ? { data: { data: { products: [product("p9", "Other Item")], total: 1 } } }
                    : { data: { data: { collection: { _id: "c2", name: "Other", slug: "other" } } } }
            )
        );
        const { rerender } = render(view(settings()));
        expect(screen.getByText("Original Perfume")).toBeInTheDocument();

        rerender(view(settings({ collection_id: "c2" })));
        await waitFor(() => expect(screen.getByText("Other Item")).toBeInTheDocument());

        rerender(view(settings()));

        await waitFor(() => expect(screen.getByText("Original Perfume")).toBeInTheDocument());
        expect(screen.getByText("Original Oud")).toBeInTheDocument();
        expect(screen.queryByText("Other Item")).not.toBeInTheDocument();
    });

    it("shows the original collection's products again after clearing the collection and choosing it again", async () => {
        const { rerender } = render(view(settings()));

        rerender(view(settings({ collection_id: "" })));
        await waitFor(() => expect(screen.queryByText("Original Perfume")).not.toBeInTheDocument());

        rerender(view(settings()));

        await waitFor(() => expect(screen.getByText("Original Perfume")).toBeInTheDocument());
    });
});
