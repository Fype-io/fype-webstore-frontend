import { describe, it, expect } from "vitest";
import { clampTileCount, collectionListGrid, collectionsPageGrid, featuredCollectionGrid, safeHoverColor } from "../tileLayout";

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
