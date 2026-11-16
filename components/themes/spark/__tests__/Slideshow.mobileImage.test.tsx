import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Slideshow from "../sections/Slideshow";
import Multicolumn from "../sections/Multicolumn";
import RichText from "../sections/RichText";
import type { SparkColumnBlock, SparkMulticolumnSettings, SparkRichTextBlock, SparkRichTextSettings, SparkSlideBlock, SparkSlideshowSettings } from "../sparkConfig";

// A slide can have its own portrait image for phones, picked by the browser (each device downloads only its own).
// The blocks' links go through the shared resolver.

const settings: SparkSlideshowSettings = { style: "Full Width", color: "#fff", padding_top: 0, padding_bottom: 0 };
const slide = (over: Partial<SparkSlideBlock["settings"]> = {}): SparkSlideBlock => ({
    id: "s1",
    settings: {
        image_url: "https://cdn.example.com/desktop.jpg",
        overlay_color: "#000",
        overlay_opacity: 40,
        text: "",
        heading: "Winter",
        button_text: "Buy now",
        button_style: "Outline",
        button_color: "#fff",
        button_text_color: "#000",
        button_link: "",
        ...over,
    },
});
const renderSlide = (over?: Partial<SparkSlideBlock["settings"]>) => render(<Slideshow settings={settings} slides={[slide(over)]} />).container;

describe("Slideshow mobile image", () => {
    it("with a mobile image: a <picture> whose phone source is the portrait image and whose fallback is the desktop one", () => {
        const c = renderSlide({ mobile_image_url: "https://cdn.example.com/phone.jpg" });
        const source = c.querySelector("picture source") as HTMLSourceElement;
        expect(source.getAttribute("media")).toBe("(max-width: 767px)");
        expect(source.getAttribute("srcset")).toBe("https://cdn.example.com/phone.jpg");
        expect(c.querySelector("picture img")?.getAttribute("src")).toBe("https://cdn.example.com/desktop.jpg");
    });

    it("without one (or for a slide saved before the setting existed): no phone source, the desktop image is used everywhere", () => {
        for (const over of [{}, { mobile_image_url: "" }, { mobile_image_url: undefined }]) {
            const c = renderSlide(over);
            expect(c.querySelector("picture source")).toBeNull();
            expect(c.querySelector("picture img")?.getAttribute("src")).toBe("https://cdn.example.com/desktop.jpg");
        }
    });

    it("a space in the image address does not cut the phone image short", () => {
        const c = renderSlide({ mobile_image_url: "https://cdn.example.com/my phone.jpg" });
        expect(c.querySelector("picture source")?.getAttribute("srcset")).toBe("https://cdn.example.com/my%20phone.jpg");
    });

    it("a mobile image with no desktop image shows on phones only", () => {
        const c = renderSlide({ image_url: "", mobile_image_url: "https://cdn.example.com/phone.jpg" });
        const img = c.querySelector("img") as HTMLImageElement;
        expect(img.getAttribute("src")).toBe("https://cdn.example.com/phone.jpg");
        expect(img.className).toContain("md:hidden");
        expect(c.querySelector("picture")).toBeNull();
    });

    it("no image at all renders no image", () => {
        expect(renderSlide({ image_url: "" }).querySelector("img")).toBeNull();
    });
});

describe("Slideshow button link", () => {
    const button = (link: string) => renderSlide({ button_link: link }).querySelector("a") as HTMLAnchorElement;

    it("opens internal pages in the tab and typed addresses in a new one", () => {
        expect(button("/products/aventus").getAttribute("href")).toBe("/products/aventus");
        expect(button("/products/aventus").getAttribute("target")).toBeNull();
        expect(button("www.example.com").getAttribute("href")).toBe("https://www.example.com");
        expect(button("www.example.com").getAttribute("target")).toBe("_blank");
    });

    it("never makes a javascript: link", () => {
        expect(button("javascript:alert(1)").getAttribute("href")).toBe("#");
    });
});

describe("Other blocks use the same link rules", () => {
    const columnSettings = { section_heading: "", columns_on_desktop: 3, column_alignment: "Center", background_color: "#fff", padding_top: 0, padding_bottom: 0 } as SparkMulticolumnSettings;
    const column = (link: string): SparkColumnBlock => ({ id: "c", settings: { image_url: "", heading: "Delivery", text: "Fast", link } });
    const heading = (link: string) => render(<Multicolumn settings={columnSettings} blocks={[column(link)]} />).container.querySelector("a") as HTMLAnchorElement;

    it("Multicolumn: a typed address without https:// works, /shop means the shop, javascript: is dropped", () => {
        expect(heading("www.example.com").getAttribute("href")).toBe("https://www.example.com");
        expect(heading("www.example.com").getAttribute("target")).toBe("_blank");
        expect(heading("/shop").getAttribute("href")).toBe("/products");
        expect(heading("/collections/eid").getAttribute("href")).toBe("/collections/eid");
        expect(heading("javascript:alert(1)").getAttribute("href")).toBe("#");
    });

    const richSettings = { background_color: "#fff", padding_top: 0, padding_bottom: 0 } as unknown as SparkRichTextSettings;
    const richButton = (link: string): SparkRichTextBlock =>
        ({ id: "b", type: "Button", settings: { label: "Go", style: "Filled", button_color: "#000", button_text_color: "#fff", link } }) as unknown as SparkRichTextBlock;

    it("Rich Text button: the same rules", () => {
        const href = (link: string) => render(<RichText settings={richSettings} blocks={[richButton(link)]} />).container.querySelector("a") as HTMLAnchorElement;
        expect(href("example.com/offer").getAttribute("href")).toBe("https://example.com/offer");
        expect(href("").getAttribute("href")).toBe("#");
        expect(href("javascript:alert(1)").getAttribute("href")).toBe("#");
    });
});
