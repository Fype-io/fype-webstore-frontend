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
