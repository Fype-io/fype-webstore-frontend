import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProductFilters from "../ProductFilters";
import { EDITOR_PREVIEW_MARKER_ID } from "@/lib/editor-preview";

const push = vi.fn();
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push }),
    usePathname: () => "/products",
    useSearchParams: () => new URLSearchParams("sortBy=newest"),
}));
vi.mock("@/components/shared/StoreCurrency", () => ({ useStoreCurrency: () => ({ symbol: "₹" }) }));

async function search(term: string) {
    const input = screen.getByPlaceholderText("Search products...");
    await userEvent.type(input, `${term}{enter}`);
}

describe("Spark ProductFilters", () => {
    afterEach(() => {
        push.mockReset();
        document.body.innerHTML = "";
        vi.restoreAllMocks();
    });

    it("navigates with the new search params for a shopper", async () => {
        render(<ProductFilters />);
        await search("shirt");
        expect(push).toHaveBeenCalledWith("/products?sortBy=newest&search=shirt");
    });

    it("does nothing in the customizer's verified preview", async () => {
        const marker = document.createElement("span");
        marker.id = EDITOR_PREVIEW_MARKER_ID;
        marker.dataset.verified = "1";
        document.body.appendChild(marker);
        vi.spyOn(window, "parent", "get").mockReturnValue({} as Window);

        render(<ProductFilters />);
        await search("shirt");
        expect(push).not.toHaveBeenCalled();
    });
});
