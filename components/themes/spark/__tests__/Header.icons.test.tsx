import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/shared/AuthModal", () => ({ default: () => null }));
vi.mock("@/lib/client-store-context", () => ({ getCurrentStoreId: () => "STORE-X" }));
vi.mock("../SparkCartContext", () => ({
    useSparkCart: () => ({ openCart: vi.fn() }),
    cartTotalCount: (cart: { count?: number } | null | undefined) => cart?.count ?? 0,
}));

import Header from "../Header";
import { makeStore } from "@/redux/store";

const header = {
    logo_type: "Text Only" as const,
    logo_text: "Shop",
    logo_image_url: "",
    logo_position: "Left" as const,
    menu_style: "Drawer" as const,
    navigation: [],
    sticky_header: false,
    glass_effect: false,
    background_color: "#ffffff",
    foreground_color: "#111111",
};

const renderHeader = () =>
    render(
        <Provider store={makeStore()}>
            <Header header={header} navItems={[]} announcementBlocks={[]} />
        </Provider>
    );

describe("Spark header icons (top right)", () => {
    it("search, account and cart are the same kind of icon in the same fixed box, so they line up", () => {
        renderHeader();
        const controls = [
            screen.getByRole("link", { name: "Search" }),
            screen.getByRole("button", { name: "Sign in" }),
            screen.getByRole("button", { name: "Open cart" }),
        ];

        for (const control of controls) {
            // one SVG icon each (20px), no icon-font glyph that would sit on the text baseline
            const svgs = control.querySelectorAll("svg");
            expect(svgs).toHaveLength(1);
            expect(svgs[0]!.getAttribute("width")).toBe("20");
            expect(svgs[0]!.getAttribute("height")).toBe("20");
            expect(control.querySelector(".material-symbols-outlined")).toBeNull();
        }

        // identical box: fixed size, icon centred
        const classes = controls.map((c) => c.className);
        expect(new Set(classes).size).toBe(1);
        expect(classes[0]).toContain("h-6");
        expect(classes[0]).toContain("w-6");
        expect(classes[0]).toContain("items-center");
        expect(classes[0]).toContain("justify-center");
    });
});
