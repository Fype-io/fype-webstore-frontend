import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Multicolumn from "../sections/Multicolumn";
import type { SparkColumnBlock, SparkMulticolumnSettings } from "../sparkConfig";

const settings = { section_heading: "Why choose us", columns_on_desktop: 4, column_alignment: "Center", background_color: "#fff", padding_top: 0, padding_bottom: 0 } as SparkMulticolumnSettings;
const column = (id: string, over: Partial<SparkColumnBlock["settings"]> = {}): SparkColumnBlock => ({
    id,
    settings: { image_url: "https://cdn.example.com/truck.png", heading: "Delivery", text: "Express delivery", link: "", ...over },
});

const imageOf = (blocks: SparkColumnBlock[]) => render(<Multicolumn settings={settings} blocks={blocks} />).container.querySelector("img")!;

describe("Multicolumn image zoom", () => {
    it("does not change an image saved before the setting existed, or at 100%", () => {
        expect(imageOf([column("a")]).getAttribute("style")).toBeNull();
        expect(imageOf([column("a", { image_zoom: 100 })]).getAttribute("style")).toBeNull();
    });

    it("zooms out and in inside the round frame (a cut-off icon can be shown whole)", () => {
        expect(imageOf([column("a", { image_zoom: 65 })]).style.transform).toBe("scale(0.65)");
        expect(imageOf([column("a", { image_zoom: 150 })]).style.transform).toBe("scale(1.5)");
    });

    it("keeps a wild saved value inside 40-200%", () => {
        expect(imageOf([column("a", { image_zoom: 5 })]).style.transform).toBe("scale(0.4)");
        expect(imageOf([column("a", { image_zoom: 900 })]).style.transform).toBe("scale(2)");
    });
});

describe("Multicolumn rows are centred", () => {
    it("3 columns in a 4-column row sit in a centred wrapping row, each one column wide", () => {
        const { container } = render(<Multicolumn settings={settings} blocks={[column("a"), column("b"), column("c")]} />);
        const row = container.querySelector('[class*="justify-center"][class*="flex-wrap"]') as HTMLElement;
        expect(row).not.toBeNull();
        expect(row.className).toContain("md:[--cols:4]");
        expect(row.children).toHaveLength(3);
        Array.from(row.children).forEach((tile) => expect(tile.className).toContain("var(--cols)"));
    });
});
