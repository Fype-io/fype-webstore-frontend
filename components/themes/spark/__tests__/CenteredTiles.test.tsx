import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import CollectionList from "../sections/CollectionList";
import type { SparkCollectionListSettings } from "../sparkConfig";
import type { CollectionSummary } from "@/types/storefront";

vi.mock("@/lib/client-api", () => ({ getApi: vi.fn() }));

const base: SparkCollectionListSettings = {
    section_heading: "Shop by category",
    source: "group",
    collection_ids: [],
    collection_group_id: "g1",
    columns_on_desktop: 4,
    collections_to_show: 12,
    goto_label: "",
    goto_link: "",
    background_color: "#fff",
    padding_top: 0,
    padding_bottom: 0,
};
const make = (n: number): CollectionSummary[] => Array.from({ length: n }, (_, i) => ({ _id: `c${i + 1}`, name: `Collection ${i + 1}`, slug: `c-${i + 1}` }));

const rowOf = (columns: number, count: number) => {
    const { container } = render(<CollectionList settings={{ ...base, columns_on_desktop: columns }} storeId="s1" initialCollections={make(count)} />);
    return container.querySelector('[class*="justify-center"][class*="flex-wrap"]') as HTMLElement;
};

describe("Collection List: an incomplete row is centred, for every columns/count combination", () => {
    for (let columns = 2; columns <= 6; columns += 1) {
        for (let count = 1; count <= columns + 3; count += 1) {
            it(`${count} tile${count === 1 ? "" : "s"} at ${columns} per row`, () => {
                const row = rowOf(columns, count);
                expect(row).not.toBeNull();
                // The row's column count per screen size is the setting (2 per row never changes with the screen).
                expect(row.className).toContain(columns === 2 ? "[--cols:2]" : `lg:[--cols:${columns}]`);
                expect(row.children).toHaveLength(count);
                // Each tile is exactly one column wide, so the last (incomplete) row is centred by the row itself.
                Array.from(row.children).forEach((tile) => expect(tile.className).toContain("var(--cols)"));
            });
        }
    }
});
