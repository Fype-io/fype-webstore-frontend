import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render } from "@testing-library/react";
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

// Chrome keeps painting the old image while a <picture> re-picks in place
// (until the new one has fully downloaded), so the slider remounts it instead.
describe("Spark BannerSlider never shows the desktop image while the portrait loads", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const stubMatchMedia = () => {
        const listeners = new Set<() => void>();
        vi.stubGlobal("matchMedia", (query: string) => ({
            media: query,
            matches: false,
            addEventListener: (_: string, fn: () => void) => listeners.add(fn),
            removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
        }));
        return () => listeners.forEach((fn) => fn());
    };

    it("remounts the picture when the screen crosses the mobile breakpoint", () => {
        const crossBreakpoint = stubMatchMedia();
        const container = renderSlide({ mobile_image_url: "https://cdn.example.com/portrait.jpg" });
        const before = container.querySelector("picture");

        act(() => crossBreakpoint());

        expect(container.querySelector("picture")).not.toBe(before);
    });

    it("remounts the picture when the mobile image changes", () => {
        const slide = (mobile: string) => [{ id: "s1", settings: { ...baseSlide, mobile_image_url: mobile } }];
        const { container, rerender } = render(<BannerSlider settings={section} slides={slide("")} />);
        const before = container.querySelector("picture");

        rerender(<BannerSlider settings={section} slides={slide("https://cdn.example.com/portrait.jpg")} />);

        expect(container.querySelector("picture")).not.toBe(before);
    });

    it("keeps the same picture across unrelated re-renders", () => {
        const slides = [{ id: "s1", settings: { ...baseSlide, mobile_image_url: "https://cdn.example.com/portrait.jpg" } }];
        const { container, rerender } = render(<BannerSlider settings={section} slides={slides} />);
        const before = container.querySelector("picture");

        rerender(<BannerSlider settings={section} slides={[{ ...slides[0], settings: { ...slides[0].settings, heading_text: "Changed" } }]} />);

        expect(container.querySelector("picture")).toBe(before);
    });

    describe("background download of every slide's images", () => {
        const stubImage = () => {
            const loaded: string[] = [];
            vi.stubGlobal(
                "Image",
                class {
                    set src(url: string) {
                        loaded.push(url);
                    }
                }
            );
            return loaded;
        };
        const slides = [
            { id: "s1", settings: { ...baseSlide, mobile_image_url: "https://cdn.example.com/portrait.jpg" } },
            { id: "s2", settings: { ...baseSlide, image_url: "https://cdn.example.com/second.jpg", mobile_image_url: "" } },
        ];

        it("happens in the editor preview, skipping empty images", () => {
            const loaded = stubImage();
            render(<BannerSlider settings={section} slides={slides} isEditorPreview />);

            expect(loaded).toEqual(["https://cdn.example.com/desktop.jpg", "https://cdn.example.com/portrait.jpg", "https://cdn.example.com/second.jpg"]);
        });

        it("never happens for real shoppers", () => {
            const loaded = stubImage();
            render(<BannerSlider settings={section} slides={slides} />);

            expect(loaded).toEqual([]);
        });
    });
});
