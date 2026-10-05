import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Footer from "../sections/Footer";
import type { SparkFooterBlock, SparkThemeSettingsSocialMedia } from "../sparkConfig";

const social: SparkThemeSettingsSocialMedia = {
    facebook: "", instagram: "", x_twitter: "", linkedin: "", youtube: "", tiktok: "", snapchat: "", pinterest: "",
};
const blocks: SparkFooterBlock[] = [{ id: "t1", type: "Text", settings: { text: "<p>About us</p>" } }];
const year = new Date().getFullYear();

function renderFooter(props: { storeName?: string; footerLogoUrl?: string }) {
    return render(
        <Footer
            settings={{ background_color: "#fff", text_color: "#000", payment_icons: [] }}
            blocks={blocks}
            socialMedia={social}
            footerLogoUrl={props.footerLogoUrl ?? ""}
            footerLogoWidth={120}
            storeName={props.storeName}
        />
    );
}

describe("Spark footer store name", () => {
    it("shows the store's name as the brand and in the copyright line", () => {
        renderFooter({ storeName: "Zallo Perfumes" });
        expect(screen.getByText("Zallo Perfumes.")).toBeInTheDocument();
        expect(screen.getByText(new RegExp(`Copyright © ${year} Zallo Perfumes\\.`))).toBeInTheDocument();
        expect(document.body.textContent).not.toContain("Spark");
    });

    it("doesn't double a trailing period in the name", () => {
        renderFooter({ storeName: "Acme Inc." });
        expect(screen.getByText("Acme Inc.")).toBeInTheDocument();
        expect(document.body.textContent).not.toContain("Inc..");
    });

    it("with a footer logo, shows the logo instead of the name, and the name in the copyright", () => {
        renderFooter({ storeName: "Zallo Perfumes", footerLogoUrl: "https://cdn.example.com/logo.png" });
        expect(screen.getByAltText("Footer Logo")).toBeInTheDocument();
        expect(screen.queryByText("Zallo Perfumes.")).not.toBeInTheDocument();
        expect(screen.getByText(new RegExp(`Copyright © ${year} Zallo Perfumes\\.`))).toBeInTheDocument();
    });

    it("falls back to Spark when there's no store name (theme preset preview)", () => {
        renderFooter({ storeName: "  " });
        expect(screen.getByText("Spark.")).toBeInTheDocument();
        expect(screen.getByText(new RegExp(`Copyright © ${year} Spark\\.`))).toBeInTheDocument();
    });
});
