import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import CollectionList from "../sections/CollectionList";
import type { SparkCollectionListSettings } from "../sparkConfig";

const getApi = vi.fn();
vi.mock("@/lib/client-api", () => ({ getApi: (...args: unknown[]) => getApi(...args) }));

const settings = (over: Partial<SparkCollectionListSettings> = {}): SparkCollectionListSettings => ({
    section_heading: "Shop by Occasion",
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

const daily = { _id: "c1", name: "Daily Wear", slug: "daily-wear" };
const night = { _id: "c2", name: "Date Night", slug: "date-night" };
const other = { _id: "c3", name: "Other Group Item", slug: "other" };

const render_ = (s: SparkCollectionListSettings, props: { editor?: boolean } = {}) => (
    <CollectionList settings={s} storeId="s1" initialCollections={[daily, night]} isEditorPreview={props.editor ?? true} />
);

describe("Collection List in the editor: switching back to what the page was rendered with", () => {
    beforeEach(() => getApi.mockReset());

    it("shows the original group's collections again after switching to hand-picked collections and back", async () => {
        getApi.mockResolvedValue({ data: { data: { collection: other } } });
        const { rerender } = render(render_(settings()));
        expect(screen.getByRole("link", { name: /Daily Wear/ })).toBeInTheDocument();

        rerender(render_(settings({ source: "pick", collection_ids: [] })));
        await waitFor(() => expect(screen.queryByRole("link", { name: /Daily Wear/ })).not.toBeInTheDocument());

        rerender(render_(settings()));

        await waitFor(() => expect(screen.getByRole("link", { name: /Daily Wear/ })).toBeInTheDocument());
        expect(screen.getByRole("link", { name: /Date Night/ })).toBeInTheDocument();
        expect(screen.queryByText(/choose a collection group/)).not.toBeInTheDocument();
    });

    it("shows the original group's collections again after going to another group and back", async () => {
        getApi.mockResolvedValue({ data: { data: { collections: [other] } } });
        const { rerender } = render(render_(settings()));

        rerender(render_(settings({ collection_group_id: "g2" })));
        await waitFor(() => expect(screen.getByRole("link", { name: /Other Group Item/ })).toBeInTheDocument());

        rerender(render_(settings()));

        await waitFor(() => expect(screen.getByRole("link", { name: /Daily Wear/ })).toBeInTheDocument());
        expect(screen.queryByRole("link", { name: /Other Group Item/ })).not.toBeInTheDocument();
    });

    it("shows the original picked collections again after clearing the picks and putting them back", async () => {
        const { rerender } = render(
            <CollectionList settings={settings({ source: "pick", collection_group_id: "", collection_ids: ["c1", "c2"] })} storeId="s1" initialCollections={[daily, night]} isEditorPreview />
        );

        rerender(<CollectionList settings={settings({ source: "pick", collection_group_id: "", collection_ids: [] })} storeId="s1" initialCollections={[daily, night]} isEditorPreview />);
        await waitFor(() => expect(screen.queryByRole("link", { name: /Daily Wear/ })).not.toBeInTheDocument());

        rerender(<CollectionList settings={settings({ source: "pick", collection_group_id: "", collection_ids: ["c1", "c2"] })} storeId="s1" initialCollections={[daily, night]} isEditorPreview />);

        await waitFor(() => expect(screen.getByRole("link", { name: /Daily Wear/ })).toBeInTheDocument());
        expect(screen.getByRole("link", { name: /Date Night/ })).toBeInTheDocument();
    });

    it("does not let a slow answer for a group the editor already left overwrite the restored collections", async () => {
        let resolveSlow: (v: unknown) => void = () => {};
        getApi.mockReturnValueOnce(new Promise((r) => (resolveSlow = r)));
        const { rerender } = render(render_(settings()));

        rerender(render_(settings({ collection_group_id: "g2" })));
        rerender(render_(settings()));
        resolveSlow({ data: { data: { collections: [other] } } });

        await waitFor(() => expect(screen.getByRole("link", { name: /Daily Wear/ })).toBeInTheDocument());
        expect(screen.queryByRole("link", { name: /Other Group Item/ })).not.toBeInTheDocument();
    });
});
