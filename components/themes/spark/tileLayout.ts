// Layout helpers shared by the Spark sections that show collection tiles.
// Class names are written out in full (never built from a number) so Tailwind
// sees them, and an unknown or missing setting falls back to the old look.

export const clampTileCount = (value: unknown, min: number, max: number, fallback: number): number => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

// Collection List: tiles per row on desktop. Phones always show 2.
const LIST_GRID: Record<number, string> = {
    2: "grid-cols-2 lg:grid-cols-2",
    3: "grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
    6: "grid-cols-2 md:grid-cols-4 lg:grid-cols-6",
};
export const collectionListGrid = (columns: unknown): string => LIST_GRID[clampTileCount(columns, 2, 6, 3)] ?? LIST_GRID[3]!;

// Collections page: the setting is a string ("2".."6"). 2 and 3 keep the old
// single-column phone layout; denser rows use 2 columns on phones.
const PAGE_GRID: Record<string, string> = {
    "2": "grid-cols-1 md:grid-cols-2",
    "3": "grid-cols-1 md:grid-cols-3",
    "4": "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
    "5": "grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
    "6": "grid-cols-2 md:grid-cols-4 lg:grid-cols-6",
};
export const collectionsPageGrid = (perRow: unknown): string => PAGE_GRID[String(perRow)] ?? PAGE_GRID["3"]!;

// Featured Collection: products per row from tablets up. Phones always show 2.
const FEATURED_GRID: Record<number, string> = {
    2: "grid-cols-2 md:grid-cols-2",
    3: "grid-cols-2 md:grid-cols-3",
    4: "grid-cols-2 md:grid-cols-4",
    5: "grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
    6: "grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
};
export const featuredCollectionGrid = (perRow: unknown): string => FEATURED_GRID[clampTileCount(perRow, 2, 6, 4)] ?? FEATURED_GRID[4]!;

// The hover colour comes from the theme editor's colour picker; only a plain
// hex value is passed on, anything else falls back.
export const safeHoverColor = (value: unknown, fallback: string): string =>
    typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value.trim()) ? value.trim() : fallback;

// ---- Centred rows -----------------------------------------------------------------------------------
// A CSS grid always leaves an incomplete last row on the left. For tiles the merchant chose a number per row
// for, an incomplete row (3 collections in a "4 per row" list, 7 tiles at 4 per row...) is centred instead:
// a wrapping flex row with `justify-center`, where every tile is exactly one column wide. The column count
// per screen size lives in the CSS variable --cols (set on the row, one class per breakpoint) and the gap in
// --gap, so the same tile class works at every size. Class names are written out in full for Tailwind.

export interface TileColumns {
    base: number;
    md?: number;
    lg?: number;
}

const COLS_BASE: Record<number, string> = { 1: "[--cols:1]", 2: "[--cols:2]", 3: "[--cols:3]", 4: "[--cols:4]", 5: "[--cols:5]", 6: "[--cols:6]" };
const COLS_MD: Record<number, string> = { 1: "md:[--cols:1]", 2: "md:[--cols:2]", 3: "md:[--cols:3]", 4: "md:[--cols:4]", 5: "md:[--cols:5]", 6: "md:[--cols:6]" };
const COLS_LG: Record<number, string> = { 1: "lg:[--cols:1]", 2: "lg:[--cols:2]", 3: "lg:[--cols:3]", 4: "lg:[--cols:4]", 5: "lg:[--cols:5]", 6: "lg:[--cols:6]" };

export type TileGap = "1.5rem" | "2rem" | "2rem-3rem";
const GAPS: Record<TileGap, string> = {
    "1.5rem": "[--gap:1.5rem]",
    "2rem": "[--gap:2rem]",
    "2rem-3rem": "[--gap:2rem] md:[--gap:3rem]",
};

/** Classes for the row that holds the tiles (add the row gap, e.g. `gap-y-12`, yourself). */
export const centeredRow = (columns: TileColumns, gap: TileGap): string =>
    [
        "flex flex-wrap justify-center gap-x-[var(--gap)]",
        COLS_BASE[clampTileCount(columns.base, 1, 6, 2)],
        columns.md !== undefined ? COLS_MD[clampTileCount(columns.md, 1, 6, 3)] : "",
        columns.lg !== undefined ? COLS_LG[clampTileCount(columns.lg, 1, 6, 4)] : "",
        GAPS[gap],
    ]
        .filter(Boolean)
        .join(" ");

/** One tile's width: a column of the row (the 0.1px keeps rounding from pushing the last tile onto a new line). */
export const CENTERED_TILE = "min-w-0 w-[calc((100%_-_(var(--cols)_-_1)_*_var(--gap))_/_var(--cols)_-_0.1px)]";

// Columns per screen size for each section: the same counts as the grids above.
export const collectionListColumns = (columns: unknown): TileColumns => {
    const n = clampTileCount(columns, 2, 6, 3);
    return n === 5 ? { base: 2, md: 3, lg: 5 } : n === 6 ? { base: 2, md: 4, lg: 6 } : n === 2 ? { base: 2 } : { base: 2, lg: n };
};
export const featuredCollectionColumns = (perRow: unknown): TileColumns => {
    const n = clampTileCount(perRow, 2, 6, 4);
    return n === 5 ? { base: 2, md: 3, lg: 5 } : n === 6 ? { base: 2, md: 3, lg: 6 } : { base: 2, md: n };
};
export const collectionsPageColumns = (perRow: unknown): TileColumns => {
    switch (String(perRow)) {
        case "2": return { base: 1, md: 2 };
        case "4": return { base: 2, md: 3, lg: 4 };
        case "5": return { base: 2, md: 3, lg: 5 };
        case "6": return { base: 2, md: 4, lg: 6 };
        default: return { base: 1, md: 3 };
    }
};
export const multicolumnColumns = (columns: unknown): TileColumns => ({ base: 1, md: clampTileCount(columns, 2, 4, 3) });
// The Collection page keeps the columns its grid always had (2 / 3 / 4 from tablet width: it goes straight to 4, unlike Shop).
export const collectionPageColumns = (perRow: unknown): TileColumns => {
    const n = clampTileCount(perRow, 2, 4, 4);
    return n === 2 ? { base: 2 } : { base: 2, md: n };
};
// Shop: 2 / 3 (from md) / 4 (3 from md, 4 from lg).
export const productGridColumns = (perRow: unknown): TileColumns => {
    const n = clampTileCount(perRow, 2, 4, 4);
    return n === 2 ? { base: 2 } : n === 3 ? { base: 2, md: 3 } : { base: 2, md: 3, lg: 4 };
};

/** The most tiles any screen size shows in a row. */
export const maxColumns = (c: TileColumns): number => Math.max(c.base, c.md ?? 0, c.lg ?? 0);

/**
 * Lists that load more as you scroll or page through (Shop, Collections page): centring only when everything
 * there is fits in one incomplete row, otherwise tiles would jump as more load or between pages.
 */
export const fitsInOnePartialRow = (shown: number, columns: TileColumns, moreToLoad: boolean): boolean =>
    !moreToLoad && shown > 0 && shown < maxColumns(columns);
