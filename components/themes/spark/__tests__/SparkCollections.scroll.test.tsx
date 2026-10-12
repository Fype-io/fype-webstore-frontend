import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SparkCollections from "../SparkCollections";
import { sparkDefaultConfig } from "../sparkConfig";
import type { CollectionTile, ShopIdentity } from "@/types/storefront";

const getApi = vi.fn();
vi.mock("@/lib/client-api", () => ({ getApi: (...args: unknown[]) => getApi(...args) }));
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => "/collections",
    useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/themes/spark/Header", () => ({ default: () => <div data-testid="header-inner" /> }));
vi.mock("@/components/themes/spark/SparkHeaderShell", () => ({ default: () => <div data-testid="header" /> }));
vi.mock("@/components/themes/spark/sections/Footer", () => ({ default: () => <div data-testid="footer" /> }));

const shop = { shopId: "s1", shopName: "YB" } as unknown as ShopIdentity;
const tile = (n: number, kind: CollectionTile["kind"] = "collection"): CollectionTile => ({ kind, _id: `${kind}-${n}`, name: `${kind} ${n}`, slug: `${kind}-${n}` });
const many = (from: number, count: number) => Array.from({ length: count }, (_, i) => tile(from + i));
const names = () => screen.queryAllByRole("heading", { level: 2 }).map((h) => h.textContent);

// A controllable IntersectionObserver: tests decide when the sentinel "comes into view".
let trigger: (() => void) | null = null;
class FakeObserver {
    constructor(callback: IntersectionObserverCallback) {
        trigger = () => callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    }
    observe() {}
    disconnect() {}
    unobserve() {}
}

beforeEach(() => {
    getApi.mockReset();
    trigger = null;
    vi.stubGlobal("IntersectionObserver", FakeObserver);
});
afterEach(() => vi.unstubAllGlobals());

const renderPage = (props: Partial<React.ComponentProps<typeof SparkCollections>>) =>
    render(<SparkCollections initialConfig={sparkDefaultConfig} shop={shop} navItems={[]} collections={[]} {...props} />);

describe("Collections page infinite scroll", () => {
    it("loads the next chunk when the end comes into view, without repeating tiles, and stops at the last page", async () => {
        getApi.mockResolvedValueOnce({ data: { data: { items: [...many(12, 1), ...many(13, 1)], pagination: { hasNextPage: false } } } });
        renderPage({ collections: [tile(1, "group"), ...many(1, 11)], hasMore: true });
        expect(names()).toHaveLength(12);

        await act(async () => trigger?.());

        await waitFor(() => expect(names()).toHaveLength(14));
        expect(getApi).toHaveBeenCalledWith("/commerce/s1/storefront/collections?page=2&limit=12");
        expect(screen.queryByTestId("collections-sentinel")).not.toBeInTheDocument();
    });

    it("drops a repeated tile if the API returns one that is already on screen", async () => {
        getApi.mockResolvedValueOnce({ data: { data: { items: [tile(1), tile(2)], pagination: { hasNextPage: false } } } });
        renderPage({ collections: [tile(1)], hasMore: true });

        await act(async () => trigger?.());

        await waitFor(() => expect(names()).toEqual(["collection 1", "collection 2"]));
    });

    it("does not ask again while a chunk is still loading, and gives up quietly on an error", async () => {
        let resolve: (v: unknown) => void = () => {};
        getApi.mockReturnValueOnce(new Promise((r) => (resolve = r)));
        renderPage({ collections: many(1, 12), hasMore: true });

        await act(async () => {
            trigger?.();
            trigger?.();
        });
        expect(getApi).toHaveBeenCalledTimes(1);
        await act(async () => resolve({ data: { data: { items: [], pagination: { hasNextPage: true } } } }));

        await waitFor(() => expect(screen.queryByTestId("collections-sentinel")).not.toBeInTheDocument());
        expect(names()).toHaveLength(12);
    });

    it("shows a group tile as a collection, linking to the group's own view", () => {
        renderPage({ collections: [tile(1, "group"), tile(1)] });

        expect(screen.getByRole("link", { name: /group 1/ })).toHaveAttribute("href", "/collections?group=group-1");
        expect(screen.getByRole("link", { name: /collection 1/ })).toHaveAttribute("href", "/collections/collection-1");
    });

    it("a group's own view shows its collections 12 at a time", async () => {
        renderPage({ collections: many(1, 30), heading: "Shop by brand", subheading: "" });
        expect(names()).toHaveLength(12);

        await act(async () => trigger?.());
        expect(names()).toHaveLength(24);
        await act(async () => trigger?.());
        expect(names()).toHaveLength(30);
        expect(screen.queryByTestId("collections-sentinel")).not.toBeInTheDocument();
        expect(getApi).not.toHaveBeenCalled();
    });

    it("falls back to a Show more button where IntersectionObserver is unavailable", () => {
        vi.stubGlobal("IntersectionObserver", undefined);
        renderPage({ collections: many(1, 30), heading: "All", subheading: "" });

        fireEvent.click(screen.getByRole("button", { name: "Show more" }));

        expect(names()).toHaveLength(24);
    });

    it("sets tiles per row up to 6, centres the name and carries the hover colour", () => {
        const config = {
            ...sparkDefaultConfig,
            page_settings: { ...sparkDefaultConfig.page_settings, collections: { ...sparkDefaultConfig.page_settings.collections, collections_per_row: "6" as const, name_hover_color: "#ff0000" } },
        };
        const { container } = renderPage({ initialConfig: config, collections: many(1, 3) });

        expect(container.querySelector(".lg\\:grid-cols-6")).not.toBeNull();
        const link = screen.getByRole("link", { name: /collection 1/ });
        expect(link.getAttribute("style")).toContain("--spark-name-hover: #ff0000");
        expect(link.querySelector("h2")!.className).toContain("text-center");
    });
});
