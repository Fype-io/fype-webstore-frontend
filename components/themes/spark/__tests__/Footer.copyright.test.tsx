import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Footer from "../sections/Footer";
import type { SparkThemeSettingsSocialMedia } from "../sparkConfig";

const renderFooter = (shopName?: string) =>
    render(
        <Footer
            settings={{ background_color: "#fff", text_color: "#000", payment_icons: [] }}
            blocks={[]}
            socialMedia={{} as SparkThemeSettingsSocialMedia}
            footerLogoUrl=""
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
});
