import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import CollectionList from "../sections/CollectionList";
import type { SparkCollectionListSettings } from "../sparkConfig";

const getApi = vi.fn();
vi.mock("@/lib/client-api", () => ({ getApi: (...args: unknown[]) => getApi(...args) }));

const settings = (over: Partial<SparkCollectionListSettings> = {}): SparkCollectionListSettings => ({
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
    ...over,
});

const amouage = { _id: "c1", name: "Amouage", slug: "amouage", thumbnailUrl: "https://cdn.example.com/amouage.png" };
const creed = { _id: "c2", name: "Creed", slug: "creed" };

describe("Spark CollectionList with a collection group", () => {
    beforeEach(() => getApi.mockReset());

    it("shows the group's collections (server-rendered set) as links to their pages", () => {
        render(<CollectionList settings={settings()} storeId="s1" initialCollections={[amouage, creed]} />);

        expect(screen.getByRole("link", { name: /Amouage/ })).toHaveAttribute("href", "/collections/amouage");
        expect(screen.getByRole("link", { name: /Creed/ })).toHaveAttribute("href", "/collections/creed");
        expect(getApi).not.toHaveBeenCalled();
    });

    it("re-fetches the new group's collections when the group changes live in the editor", async () => {
        getApi.mockResolvedValue({ data: { data: { collections: [creed] } } });
        const { rerender } = render(<CollectionList settings={settings()} storeId="s1" initialCollections={[amouage]} />);

        rerender(<CollectionList settings={settings({ collection_group_id: "g2" })} storeId="s1" initialCollections={[amouage]} />);

        await waitFor(() => expect(screen.getByRole("link", { name: /Creed/ })).toBeInTheDocument());
        expect(getApi).toHaveBeenCalledWith("/commerce/s1/storefront/collection-groups/g2");
        expect(screen.queryByRole("link", { name: /Amouage/ })).not.toBeInTheDocument();
    });

    it("renders nothing for real customers when the chosen group has no collections", () => {
        const { container } = render(<CollectionList settings={settings()} storeId="s1" initialCollections={[]} />);

        expect(container).toBeEmptyDOMElement();
    });

    it("still resolves hand-picked collections when source is missing (older saved configs)", async () => {
        getApi.mockImplementation((url: string) => Promise.resolve({ data: { data: { collection: String(url).endsWith("/c2") ? creed : amouage } } }));
        const { rerender } = render(<CollectionList settings={settings({ source: undefined, collection_group_id: undefined, collection_ids: ["c1"] })} storeId="s1" initialCollections={[amouage]} />);

        rerender(<CollectionList settings={settings({ source: undefined, collection_group_id: undefined, collection_ids: ["c2"] })} storeId="s1" initialCollections={[amouage]} />);

        await waitFor(() => expect(screen.getByRole("link", { name: /Creed/ })).toBeInTheDocument());
        expect(getApi).toHaveBeenCalledWith("/commerce/s1/products/collections/c2");
    });
});
