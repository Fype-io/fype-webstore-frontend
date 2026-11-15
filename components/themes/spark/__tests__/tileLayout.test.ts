import { describe, it, expect } from "vitest";
import {
    CENTERED_TILE,
    centeredRow,
    clampTileCount,
    collectionListColumns,
    collectionListGrid,
    collectionsPageColumns,
    collectionsPageGrid,
    featuredCollectionColumns,
    featuredCollectionGrid,
    fitsInOnePartialRow,
    maxColumns,
    multicolumnColumns,
    productGridColumns,
    safeHoverColor,
} from "../tileLayout";

describe("tile layout helpers", () => {
    it("keeps the old Collection List looks for 2 to 4 per row and handles 5 and 6", () => {
        expect(collectionListGrid(3)).toBe("grid-cols-2 lg:grid-cols-3");
        expect(collectionListGrid(2)).toBe("grid-cols-2 lg:grid-cols-2");
        expect(collectionListGrid(4)).toBe("grid-cols-2 lg:grid-cols-4");
        expect(collectionListGrid(5)).toContain("lg:grid-cols-5");
        expect(collectionListGrid(6)).toContain("lg:grid-cols-6");
    });

    it("falls back to the default for missing, odd or out-of-range values", () => {
        expect(collectionListGrid(undefined)).toBe(collectionListGrid(3));
        expect(collectionListGrid("abc")).toBe(collectionListGrid(3));
        expect(collectionListGrid(99)).toBe(collectionListGrid(6));
        expect(collectionListGrid(1)).toBe(collectionListGrid(2));
        expect(featuredCollectionGrid(undefined)).toBe("grid-cols-2 md:grid-cols-4");
        expect(collectionsPageGrid(undefined)).toBe(collectionsPageGrid("3"));
        expect(collectionsPageGrid("9")).toBe(collectionsPageGrid("3"));
    });

    it("Collections page keeps one column on phones for 2 and 3 per row, two for denser rows", () => {
        expect(collectionsPageGrid("2")).toBe("grid-cols-1 md:grid-cols-2");
        expect(collectionsPageGrid("3")).toBe("grid-cols-1 md:grid-cols-3");
        expect(collectionsPageGrid("6")).toContain("grid-cols-2");
        expect(collectionsPageGrid("6")).toContain("lg:grid-cols-6");
    });

    it("clamps counts into range", () => {
        expect(clampTileCount(20, 2, 12, 6)).toBe(12);
        expect(clampTileCount(0, 2, 12, 6)).toBe(2);
        expect(clampTileCount(4.6, 2, 12, 6)).toBe(5);
        expect(clampTileCount(undefined, 2, 12, 6)).toBe(6);
    });

    it("only passes a plain hex colour on as the hover colour", () => {
        expect(safeHoverColor("#ff0000", "#000")).toBe("#ff0000");
        expect(safeHoverColor(" #abc ", "#000")).toBe("#abc");
        expect(safeHoverColor("red; background:url(x)", "#000")).toBe("#000");
        expect(safeHoverColor(undefined, "#2563eb")).toBe("#2563eb");
    });
});

describe("centred tile rows", () => {
    it("every section's columns match its old grid at each screen size", () => {
        expect(collectionListColumns(3)).toEqual({ base: 2, lg: 3 });
        expect(collectionListColumns(2)).toEqual({ base: 2 });
        expect(collectionListColumns(5)).toEqual({ base: 2, md: 3, lg: 5 });
        expect(collectionListColumns(6)).toEqual({ base: 2, md: 4, lg: 6 });
        expect(collectionListColumns(undefined)).toEqual(collectionListColumns(3));
        expect(featuredCollectionColumns(undefined)).toEqual({ base: 2, md: 4 });
        expect(featuredCollectionColumns(6)).toEqual({ base: 2, md: 3, lg: 6 });
        expect(collectionsPageColumns("2")).toEqual({ base: 1, md: 2 });
        expect(collectionsPageColumns("6")).toEqual({ base: 2, md: 4, lg: 6 });
        expect(collectionsPageColumns("9")).toEqual({ base: 1, md: 3 });
        expect(multicolumnColumns(4)).toEqual({ base: 1, md: 4 });
        expect(multicolumnColumns(undefined)).toEqual({ base: 1, md: 3 });
        expect(productGridColumns(3)).toEqual({ base: 2, md: 3 });
        expect(productGridColumns(4)).toEqual({ base: 2, md: 3, lg: 4 });
    });

    it("the row sets the columns per screen size and the gap; the tile is one column wide", () => {
        const row = centeredRow({ base: 2, md: 3, lg: 4 }, "1.5rem");
        expect(row).toContain("flex flex-wrap justify-center");
        expect(row).toContain("[--cols:2]");
        expect(row).toContain("md:[--cols:3]");
        expect(row).toContain("lg:[--cols:4]");
        expect(row).toContain("[--gap:1.5rem]");
        expect(centeredRow({ base: 1, md: 3 }, "2rem-3rem")).toContain("md:[--gap:3rem]");
        expect(CENTERED_TILE).toContain("var(--cols)");
        expect(CENTERED_TILE).toContain("var(--gap)");
    });

    it("works for every column count from 1 to 6", () => {
        for (let n = 1; n <= 6; n += 1) {
            const row = centeredRow({ base: n, md: n, lg: n }, "2rem");
            expect(row).toContain(`[--cols:${n}]`);
            expect(row).toContain(`md:[--cols:${n}]`);
            expect(row).toContain(`lg:[--cols:${n}]`);
        }
    });

    it("lists that load more only centre when everything fits in one incomplete row", () => {
        const cols = { base: 2, md: 3, lg: 4 };
        expect(maxColumns(cols)).toBe(4);
        expect(fitsInOnePartialRow(3, cols, false)).toBe(true);
        expect(fitsInOnePartialRow(4, cols, false)).toBe(false); // a full row: nothing to centre
        expect(fitsInOnePartialRow(7, cols, false)).toBe(false);
        expect(fitsInOnePartialRow(3, cols, true)).toBe(false); // more to load: keep the grid
        expect(fitsInOnePartialRow(0, cols, false)).toBe(false);
    });
});
