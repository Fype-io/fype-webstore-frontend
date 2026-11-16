import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import CollectionBackLink from "../CollectionBackLink";
import PageTrailRecorder from "../PageTrailRecorder";
import { TRAIL_KEY, recordPage } from "@/lib/back-target";

let pathname = "/collections/wedding-formal";
let search = "";
vi.mock("next/navigation", () => ({
    usePathname: () => pathname,
    useSearchParams: () => new URLSearchParams(search),
}));

const goTo = (path: string, query = "") => {
    pathname = path;
    search = query;
    window.history.pushState({}, "", path + (query ? `?${query}` : ""));
};

beforeEach(() => {
    sessionStorage.clear();
    goTo("/collections/wedding-formal");
});

describe("Back link on a collection page", () => {
    it("starts as 'Back to Collections' (what the server renders) and keeps it when there is nothing to go back to", () => {
        render(<CollectionBackLink />);

        const link = screen.getByRole("link", { name: /Back to Collections/ });
        expect(link).toHaveAttribute("href", "/collections");
    });

    it("becomes 'Back to Home' once it knows the shopper came from the home page", async () => {
        recordPage("/");

        render(<CollectionBackLink />);

        const link = await screen.findByRole("link", { name: /Back to Home/ });
        expect(link).toHaveAttribute("href", "/");
        expect(screen.queryByRole("link", { name: /Back to Collections/ })).not.toBeInTheDocument();
    });

    it("keeps working after the shopper moves to another collection page", async () => {
        recordPage("/");
        const { rerender } = render(<CollectionBackLink />);
        await screen.findByRole("link", { name: /Back to Home/ });

        recordPage("/collections/wedding-formal");
        goTo("/collections/daily-wear");
        rerender(<CollectionBackLink />);

        const link = await screen.findByRole("link", { name: /^arrow_back\s*Back$/ });
        expect(link).toHaveAttribute("href", "/collections/wedding-formal");
    });
});

describe("Recording visits from the storefront layout", () => {
    it("records each page, including a Collections group view, and renders nothing visible", async () => {
        goTo("/");
        const { container, rerender } = render(<PageTrailRecorder />);
        goTo("/collections", "group=shop-by-occasion");
        rerender(<PageTrailRecorder />);

        await waitFor(() => expect(JSON.parse(sessionStorage.getItem(TRAIL_KEY) ?? "[]")).toEqual(["/", "/collections?group=shop-by-occasion"]));
        expect(container).toBeEmptyDOMElement();
    });
});
