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
    it("Adapt to image: no minimum height and the image sits in normal flow at natural height", () => {
        const c = renderSlide({}, "Adapt to image");
        const img = c.querySelector("img")!;
        expect(img.className).toContain("h-auto");
        expect(img.className).not.toContain("absolute");
        expect(c.innerHTML).not.toContain("min-h-[");
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
});
