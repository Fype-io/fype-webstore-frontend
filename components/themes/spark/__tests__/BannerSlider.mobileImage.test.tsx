import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import BannerSlider from "../sections/BannerSlider";
import type { SparkBannerSlideBlockSettings, SparkImageBannerSettings } from "../sparkConfig";

const section: SparkImageBannerSettings = {
    banner_height: "Medium",
    background_color: "#ffffff",
    padding_top: 0,
    padding_bottom: 0,
} as SparkImageBannerSettings;

const baseSlide: SparkBannerSlideBlockSettings = {
    image_url: "https://cdn.example.com/desktop.jpg",
    image_fit: "Cover",
    overlay_color: "#000000",
    overlay_opacity: 40,
    object_position_x: 50,
    object_position_y: 50,
    appear_after: 5,
    content_horizontal_alignment: "Center",
    content_vertical_alignment: "Center",
    heading_text: "Hello",
    heading_size: "Large",
    heading_color: "#ffffff",
    text: "",
    text_style: "Subtitle",
    text_color: "#ffffff",
    button_label: "",
    button_link: "",
    button_style: "Outline",
    button_color: "#ffffff",
    button_text_color: "#000000",
};

const renderSlide = (overrides: Partial<SparkBannerSlideBlockSettings>) =>
    render(<BannerSlider settings={section} slides={[{ id: "s1", settings: { ...baseSlide, ...overrides } }]} />).container;

describe("Spark BannerSlider mobile (portrait) image", () => {
    it("serves the mobile image to phones and keeps the desktop image for wider screens", () => {
        const container = renderSlide({ mobile_image_url: "https://cdn.example.com/portrait.jpg" });

        const source = container.querySelector("picture > source");
        expect(source).toHaveAttribute("media", "(max-width: 767px)");
        expect(source).toHaveAttribute("srcset", "https://cdn.example.com/portrait.jpg");
        expect(container.querySelector("picture > img")).toHaveAttribute("src", "https://cdn.example.com/desktop.jpg");
    });

    it("renders only the desktop image when no mobile image is set (slides saved before the field)", () => {
        const container = renderSlide({});

        expect(container.querySelector("source")).toBeNull();
        expect(container.querySelectorAll("img")).toHaveLength(1);
        expect(container.querySelector("img")).toHaveAttribute("src", "https://cdn.example.com/desktop.jpg");
    });

    it("treats an empty mobile image as unset", () => {
        const container = renderSlide({ mobile_image_url: "" });

        expect(container.querySelector("source")).toBeNull();
    });

    it("encodes spaces in the mobile URL so srcset doesn't cut it short", () => {
        const container = renderSlide({ mobile_image_url: "https://cdn.example.com/my banner.jpg" });

        expect(container.querySelector("source")).toHaveAttribute("srcset", "https://cdn.example.com/my%20banner.jpg");
    });

    it("shows a mobile-only image on phones and nothing on wider screens", () => {
        const container = renderSlide({ image_url: "", mobile_image_url: "https://cdn.example.com/portrait.jpg" });

        const img = container.querySelector("img");
        expect(img).toHaveAttribute("src", "https://cdn.example.com/portrait.jpg");
        expect(img).toHaveClass("md:hidden");
        expect(container.querySelector("picture")).toBeNull();
    });

    it("renders no image when neither is set", () => {
        const container = renderSlide({ image_url: "", mobile_image_url: "" });

        expect(container.querySelector("img")).toBeNull();
    });
});
