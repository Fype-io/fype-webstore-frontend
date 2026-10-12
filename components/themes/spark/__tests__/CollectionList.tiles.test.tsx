import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CollectionList from "../sections/CollectionList";
import type { SparkCollectionListSettings } from "../sparkConfig";
import type { CollectionSummary } from "@/types/storefront";

vi.mock("@/lib/client-api", () => ({ getApi: vi.fn() }));

const base: SparkCollectionListSettings = {
    section_heading: "Shop by brand",
    source: "group",
    collection_ids: [],
    collection_group_id: "g1",
    columns_on_desktop: 3,
    goto_label: "",
    goto_link: "",
    background_color: "#fff",
    padding_top: 0,
    padding_bottom: 0,
};

const make = (n: number): CollectionSummary[] => Array.from({ length: n }, (_, i) => ({ _id: `c${i + 1}`, name: `Brand ${i + 1}`, slug: `brand-${i + 1}` }));
const tiles = () => screen.queryAllByRole("heading", { level: 3 });

describe("Collection List tiles", () => {
    it("draws 6 tiles by default (also for sections saved before the setting) and offers View all for the rest", () => {
        render(<CollectionList settings={base} storeId="s1" initialCollections={make(9)} />);

        expect(tiles()).toHaveLength(6);
        expect(screen.getByRole("link", { name: /View all/ })).toHaveAttribute("href", "/collections?group=g1");
    });

    it("honours Collections to Show, including the 2 to 12 range", () => {
        const { unmount } = render(<CollectionList settings={{ ...base, collections_to_show: 2 }} storeId="s1" initialCollections={make(9)} />);
        expect(tiles()).toHaveLength(2);
        unmount();

        render(<CollectionList settings={{ ...base, collections_to_show: 12 }} storeId="s1" initialCollections={make(9)} />);
        expect(tiles()).toHaveLength(9);
        expect(screen.queryByRole("link", { name: /View all/ })).not.toBeInTheDocument();
    });

    it("shows no View all button when everything fits, and keeps the header link only if a label was set", () => {
        const { unmount } = render(<CollectionList settings={base} storeId="s1" initialCollections={make(4)} />);
        expect(screen.queryByRole("link", { name: /View all/ })).not.toBeInTheDocument();
        unmount();

        render(<CollectionList settings={{ ...base, goto_label: "See everything" }} storeId="s1" initialCollections={make(4)} />);
        expect(screen.getByRole("link", { name: /See everything/ })).toBeInTheDocument();
    });

    it("a pick list with more picks than tiles also gets View all, pointing at all collections", () => {
        const pick = { ...base, source: "pick" as const, collection_group_id: "", collection_ids: make(8).map((c) => c._id) };
        render(<CollectionList settings={pick} storeId="s1" initialCollections={make(6)} />);

        expect(tiles()).toHaveLength(6);
        expect(screen.getByRole("link", { name: /View all/ })).toHaveAttribute("href", "/collections");
    });

    it("View all uses the merchant's label and link when set, and replaces the header link rather than doubling it", () => {
        render(<CollectionList settings={{ ...base, goto_label: "More brands", goto_link: "/pages/brands" }} storeId="s1" initialCollections={make(9)} />);

        const links = screen.getAllByRole("link", { name: /More brands/ });
        expect(links).toHaveLength(1);
        expect(links[0]).toHaveAttribute("href", "/pages/brands");
    });

    it("hides the names when asked, and otherwise centres them with the hover colour on the tile", () => {
        const { unmount } = render(<CollectionList settings={{ ...base, show_collection_name: false }} storeId="s1" initialCollections={make(3)} />);
        expect(tiles()).toHaveLength(0);
        unmount();

        render(<CollectionList settings={{ ...base, name_hover_color: "#ff0000" }} storeId="s1" initialCollections={make(3)} />);
        const heading = screen.getAllByRole("heading", { level: 3 })[0]!;
        expect(heading.className).toContain("text-center");
        expect(heading.className).toContain("spark-tile-name");
        expect(heading.closest("a")!.getAttribute("style")).toContain("--spark-name-hover: #ff0000");
    });

    it("uses the old blue hover when none is saved, and ignores an unsafe colour", () => {
        const { unmount } = render(<CollectionList settings={base} storeId="s1" initialCollections={make(2)} />);
        expect(screen.getAllByRole("heading", { level: 3 })[0]!.closest("a")!.getAttribute("style")).toContain("#2563eb");
        unmount();

        render(<CollectionList settings={{ ...base, name_hover_color: "javascript:alert(1)" }} storeId="s1" initialCollections={make(2)} />);
        expect(screen.getAllByRole("heading", { level: 3 })[0]!.closest("a")!.getAttribute("style")).toContain("#2563eb");
    });

    it("sets the tiles per row", () => {
        const { container } = render(<CollectionList settings={{ ...base, columns_on_desktop: 5 }} storeId="s1" initialCollections={make(6)} />);

        expect(container.querySelector(".lg\\:grid-cols-5")).not.toBeNull();
    });
});
