import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Footer from "../sections/Footer";
import type { SparkThemeSettingsSocialMedia } from "../sparkConfig";

const textBlock = { id: "t1", type: "Text" as const, settings: { text: "<p>About us</p>" } };

const renderFooter = (shopName?: string, footerLogoUrl = "") =>
    render(
        <Footer
            settings={{ background_color: "#fff", text_color: "#000", payment_icons: [] }}
            blocks={[textBlock]}
            socialMedia={{} as SparkThemeSettingsSocialMedia}
            footerLogoUrl={footerLogoUrl}
            footerLogoWidth={100}
            shopName={shopName}
        />
    );

const year = new Date().getFullYear();

describe("Spark Footer copyright line", () => {
    it("shows the store name", () => {
        renderFooter("Aadhi Naturals");
        expect(screen.getByText(new RegExp(`Copyright © ${year} Aadhi Naturals\\.`))).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Powered by Fype" })).toBeInTheDocument();
    });

    it("falls back to Spark when no name is given", () => {
        renderFooter();
        expect(screen.getByText(new RegExp(`Copyright © ${year} Spark\\.`))).toBeInTheDocument();
    });

    it("falls back to Spark for a whitespace-only name", () => {
        renderFooter("   ");
        expect(screen.getByText(new RegExp(`Copyright © ${year} Spark\\.`))).toBeInTheDocument();
    });

    describe("wordmark above the footer text", () => {
        it("shows the store name when there is no footer logo", () => {
            renderFooter("Aadhi Naturals");
            expect(screen.getByText("Aadhi Naturals", { selector: "div.text-2xl" })).toBeInTheDocument();
        });

        it("falls back to Spark. without a name", () => {
            renderFooter();
            expect(screen.getByText("Spark.", { selector: "div.text-2xl" })).toBeInTheDocument();
        });

        it("is hidden when a footer logo is set", () => {
            renderFooter("Aadhi Naturals", "https://img.test/logo.png");
            expect(screen.queryByText("Aadhi Naturals", { selector: "div.text-2xl" })).not.toBeInTheDocument();
        });
    });
});
