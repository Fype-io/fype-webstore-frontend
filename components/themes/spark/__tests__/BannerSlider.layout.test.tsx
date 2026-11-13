import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import BannerSlider from "../sections/BannerSlider";
import type { SparkBannerSlideBlockSettings, SparkImageBannerSettings } from "../sparkConfig";

const section = { banner_height: "Medium", background_color: "#fff", padding_top: 0, padding_bottom: 0 } as SparkImageBannerSettings;

const baseSlide = {
    image_url: "https://cdn.example.com/desktop.jpg",
    image_fit: "Cover",
    overlay_color: "#000",
    overlay_opacity: 40,
    object_position_x: 50,
    object_position_y: 50,
    appear_after: 5,
    content_horizontal_alignment: "Center",
    content_vertical_alignment: "Center",
    heading_text: "Hello",
    heading_size: "Large",
    heading_color: "#fff",
    text: "the new standard",
    text_style: "Subtitle",
    text_color: "#fff",
    button_label: "",
    button_link: "",
    button_style: "Outline",
    button_color: "#fff",
    button_text_color: "#000",
} as SparkBannerSlideBlockSettings;

const renderSlide = (o: Partial<SparkBannerSlideBlockSettings>, height: SparkImageBannerSettings["banner_height"] = "Medium") =>
    render(<BannerSlider settings={{ ...section, banner_height: height }} slides={[{ id: "s1", settings: { ...baseSlide, ...o } }]} />).container;

describe("Spark BannerSlider layout", () => {
    it("Adapt to image: no minimum height; image and text share one grid cell so the text can't be clipped", () => {
        const c = renderSlide({}, "Adapt to image");
        const img = c.querySelector("img")!;
        expect(img.className).not.toContain("absolute");
        expect(c.innerHTML).not.toContain("min-h-[");
        expect(c.querySelector(".grid")).not.toBeNull();
        expect(c.querySelector("h2")!.parentElement!.className).toContain("row-start-1");
    });

    it("Adapt to image still serves the phone image to phones", () => {
        const c = renderSlide({ mobile_image_url: "https://cdn.example.com/portrait.jpg" }, "Adapt to image");
        expect(c.querySelector("picture > source")).toHaveAttribute("srcset", "https://cdn.example.com/portrait.jpg");
    });

    it("Adapt to image keeps room for the header on any alignment", () => {
        const c = renderSlide({}, "Adapt to image");
        expect((c.querySelector("h2")!.parentElement as HTMLElement).style.paddingTop).toContain("--spark-header-h");
    });

    it("fixed heights still use minimum heights and cover-style absolute images", () => {
        const c = renderSlide({});
        expect(c.innerHTML).toContain("min-h-[550px]");
        expect(c.querySelector("img")!.className).toContain("absolute");
    });

    it("Top alignment clears the header via --spark-header-h", () => {
        const c = renderSlide({ content_vertical_alignment: "Top" });
        expect(c.innerHTML).toContain("var(--spark-header-h");
    });

    it("Subtitle style no longer forces uppercase, so lower/capitalised text shows as typed", () => {
        const c = renderSlide({});
        const text = c.querySelector(".spark-font-subheading")!;
        expect(text.className).not.toContain("uppercase");
    });

    describe("Original Size: as tall as the image, never taller than the banner height", () => {
        it("puts the image in flow at its own size, with a maximum height instead of a minimum", () => {
            const c = renderSlide({ image_fit: "Original Size" }, "Medium");
            const img = c.querySelector("img")!;
            expect(img.className).toContain("w-auto");
            expect(img.className).toContain("max-w-none");
            expect(img.className).not.toContain("object-none");
            expect(c.innerHTML).toContain("max-h-[550px]");
            expect(c.innerHTML).toContain("lg:max-h-[650px]");
            expect(c.innerHTML).not.toContain("min-h-[");
        });

        it("uses the chosen banner height as the maximum (Small and Large)", () => {
            expect(renderSlide({ image_fit: "Original Size" }, "Small").innerHTML).toContain("max-h-[400px]");
            expect(renderSlide({ image_fit: "Original Size" }, "Large").innerHTML).toContain("lg:max-h-[850px]");
        });

        it("keeps the text inside the same cell, below the header padding", () => {
            const c = renderSlide({ image_fit: "Original Size" }, "Large");
            expect(c.querySelector("h2")!.parentElement!.className).toContain("row-start-1");
            expect((c.querySelector("h2")!.parentElement as HTMLElement).style.paddingTop).toContain("--spark-header-h");
        });

        it("without an image keeps the Medium-sized placeholder box", () => {
            const c = renderSlide({ image_fit: "Original Size", image_url: "" }, "Large");
            expect(c.innerHTML).toContain("min-h-[550px]");
        });

        it("the other fits on a fixed height are unchanged", () => {
            for (const fit of ["Cover", "Contain", "Stretch"] as const) {
                const c = renderSlide({ image_fit: fit }, "Medium");
                expect(c.innerHTML).toContain("min-h-[550px]");
                expect(c.querySelector("img")!.className).toContain("absolute");
            }
        });
    });

    describe("Match image reserves its height before the image loads", () => {
        const layer = (c: HTMLElement) => c.querySelector("picture")!.parentElement as HTMLElement;

        it("uses the saved desktop size", () => {
            const l = layer(renderSlide({ image_width: 2400, image_height: 1000 }, "Adapt to image"));
            expect(l.className).toContain("spark-match-ar");
            expect(l.style.getPropertyValue("--spark-ar-d")).toBe("2400 / 1000");
        });

        it("also uses the phone image's own shape when there is a phone image", () => {
            const l = layer(
                renderSlide(
                    { image_width: 2400, image_height: 1000, mobile_image_url: "https://cdn.example.com/m.jpg", mobile_image_width: 1080, mobile_image_height: 1440 },
                    "Adapt to image",
                ),
            );
            expect(l.className).toContain("spark-match-ar");
            expect(l.style.getPropertyValue("--spark-ar-m")).toBe("1080 / 1440");
        });

        it("does not guess when a size is missing (older slides): the banner takes its height from the loaded image", () => {
            expect(layer(renderSlide({}, "Adapt to image")).className).not.toContain("spark-match-ar");
            expect(
                layer(renderSlide({ image_width: 2400, image_height: 1000, mobile_image_url: "https://cdn.example.com/m.jpg" }, "Adapt to image")).className,
            ).not.toContain("spark-match-ar");
        });
    });

    it("shows text that was pasted with another page's formatting like typed text (inline styles dropped)", () => {
        const c = renderSlide({
            heading_text: `<span style="font-family: 'Times New Roman'; font-size: 13px; letter-spacing: -1px">Smell like you mean it</span>`,
            text: `<p style="font-size:10px">the new standard</p>`,
        });
        const h2 = c.querySelector("h2")!;
        expect(h2.innerHTML).toBe("Smell like you mean it");
        expect(h2.querySelector("[style]")).toBeNull();
        expect(c.querySelector(".spark-font-subheading")!.querySelector("[style]")).toBeNull();
    });
});
