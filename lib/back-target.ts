// Where the Back link on a collection page should go. A page can't read the
// browser's history, so the storefront keeps its own short list of the pages a
// shopper visited in this tab (paths only, in sessionStorage: it is gone when
// the tab closes). The Back link points at the page before the current one.
//
// Arriving at the page before the latest one is treated as the shopper going
// back (browser Back button, or the Back link itself), so the list follows the
// real history instead of growing in circles.
export const TRAIL_KEY = "sf:page-trail";
const MAX_PAGES = 20;

export interface BackTarget {
    href: string;
    label: string;
}

function readTrail(): string[] {
    try {
        const raw = sessionStorage.getItem(TRAIL_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) && parsed.every((page) => typeof page === "string") ? parsed : [];
    } catch {
        return [];
    }
}

export function recordPage(path: string): void {
    const trail = readTrail();
    if (trail.at(-1) === path) return;
    if (trail.length >= 2 && trail.at(-2) === path) trail.pop();
    else trail.push(path);
    try {
        sessionStorage.setItem(TRAIL_KEY, JSON.stringify(trail.slice(-MAX_PAGES)));
    } catch {
        // Storage blocked (private mode etc.) - the Back link keeps its default.
    }
}

// Only store pages worth returning to, and only paths on this store (never a
// full URL or another site), so the link can't be pointed anywhere else.
function describeTarget(path: string): BackTarget | null {
    if (!path.startsWith("/") || path.startsWith("//")) return null;
    let url: URL;
    try {
        url = new URL(path, "http://store.local");
    } catch {
        return null;
    }
    if (url.origin !== "http://store.local") return null;

    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    const href = pathname + url.search;
    if (pathname === "/") return { href, label: "Back to Home" };
    if (pathname === "/collections") return { href, label: "Back to Collections" };
    if (pathname === "/products") return { href, label: "Back to Shop" };
    if (pathname.startsWith("/collections/") || pathname.startsWith("/products/")) return { href, label: "Back" };
    return null;
}

// `currentPath` is the page the link is on. It may or may not be recorded yet
// (effects of the page and of the recorder run in either order), so both are handled.
export function resolveBackTarget(currentPath: string): BackTarget | null {
    const trail = readTrail();
    const previous = trail.at(-1) === currentPath ? trail.at(-2) : trail.at(-1);
    if (!previous || previous === currentPath) return null;
    return describeTarget(previous);
}
