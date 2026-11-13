import { describe, it, expect, vi } from "vitest";
import { act, render } from "@testing-library/react";
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

const MAIN = "https://cdn.example.com/dark-logo.png";
const GLASS = "https://cdn.example.com/white-logo.png";

const baseHeader = {
    logo_type: "Logo Image" as const,
    logo_text: "Shop",
    logo_image_url: "",
    logo_position: "Left" as const,
    menu_style: "Tabs" as const,
    navigation: [],
    sticky_header: true,
    glass_effect: true,
    glass_logo_url: GLASS,
    background_color: "#ffffff",
    foreground_color: "#111111",
};

const logoSrc = (over: Partial<typeof baseHeader>, heroOverlap = true) => {
    const { container } = render(
        <Provider store={makeStore()}>
            <Header header={{ ...baseHeader, ...over }} navItems={[]} announcementBlocks={[]} logoUrl={MAIN} heroOverlap={heroOverlap} />
        </Provider>,
    );
    return container.querySelector("a[href='/'] img")?.getAttribute("src");
};

describe("Spark header: logo in glass mode", () => {
    it("shows the glass logo while the header is transparent over the banner", () => {
        expect(logoSrc({})).toBe(GLASS);
    });

    it("goes back to the main logo once the page is scrolled and the header turns solid", () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <Header header={baseHeader} navItems={[]} announcementBlocks={[]} logoUrl={MAIN} heroOverlap />
            </Provider>,
        );
        const src = () => container.querySelector("a[href='/'] img")?.getAttribute("src");
        expect(src()).toBe(GLASS);
        act(() => {
            Object.defineProperty(window, "scrollY", { value: 200, configurable: true });
            window.dispatchEvent(new Event("scroll"));
        });
        expect(src()).toBe(MAIN);
        Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    });

    it("keeps the main logo when no glass logo is set, when glass is off, and off the home page", () => {
        expect(logoSrc({ glass_logo_url: "" })).toBe(MAIN);
        expect(logoSrc({ glass_effect: false })).toBe(MAIN);
        expect(logoSrc({}, false)).toBe(MAIN);
    });

    it("gives the glass logo its own width, and the main logo's width when none is set", () => {
        const width = (over: Partial<typeof baseHeader> & { glass_logo_width?: number }) => {
            const { container } = render(
                <Provider store={makeStore()}>
                    <Header header={{ ...baseHeader, ...over }} navItems={[]} announcementBlocks={[]} logoUrl={MAIN} logoWidth={120} heroOverlap />
                </Provider>,
            );
            return (container.querySelector("a[href='/'] img")!.parentElement as HTMLElement).style.width;
        };
        expect(width({ glass_logo_width: 180 })).toBe("180px");
        expect(width({})).toBe("120px");
    });
});
