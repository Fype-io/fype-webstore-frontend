import { describe, it, expect } from "vitest";
import { linkAttrs, resolveLink } from "../resolveLink";

// One resolver for every Spark block that has a link: what a merchant typed or picked becomes a safe href.

describe("resolveLink", () => {
    it("keeps internal paths exactly as they are (the picker's links)", () => {
        for (const path of ["/about-us", "/products/aventus", "/products/PROD-12ab", "/collections/eid-gifts", "/collections?group=g1", "/faq#shipping"]) {
            expect(resolveLink(path)).toEqual({ href: path, external: false });
        }
        expect(resolveLink("/")).toEqual({ href: "/", external: false });
    });

    it("/shop and /shops mean the shop", () => {
        expect(resolveLink("/shop")).toEqual({ href: "/products", external: false });
        expect(resolveLink("/shops")).toEqual({ href: "/products", external: false });
        expect(resolveLink("/products")).toEqual({ href: "/products", external: false });
    });

    it("an address with a scheme is external and unchanged", () => {
        expect(resolveLink("https://example.com/sale")).toEqual({ href: "https://example.com/sale", external: true });
        expect(resolveLink("http://example.com")).toEqual({ href: "http://example.com", external: true });
    });

    it("an address typed without a scheme gets https:// and is external", () => {
        expect(resolveLink("www.example.com")).toEqual({ href: "https://www.example.com", external: true });
        expect(resolveLink("example.com/offer")).toEqual({ href: "https://example.com/offer", external: true });
        expect(resolveLink("//cdn.example.com/x")).toEqual({ href: "https://cdn.example.com/x", external: true });
    });

    it("keeps phone, email and anchor links", () => {
        expect(resolveLink("tel:+971500000000")).toEqual({ href: "tel:+971500000000", external: false });
        expect(resolveLink("mailto:hi@store.com")).toEqual({ href: "mailto:hi@store.com", external: false });
        expect(resolveLink("#faq")).toEqual({ href: "#faq", external: false });
    });

    it("trims spaces around what was typed", () => {
        expect(resolveLink("  /about-us  ")).toEqual({ href: "/about-us", external: false });
    });

    it("drops links that would run code when clicked, however they are spelled", () => {
        for (const bad of [
            "javascript:alert(1)",
            "JaVaScRiPt:alert(1)",
            "  javascript:alert(1)",
            "java\tscript:alert(1)",
            "java\nscript:alert(1)",
            "\u0001javascript:alert(1)",
            "data:text/html,<b>x</b>",
            "vbscript:msgbox(1)",
            "file:///etc/passwd",
        ]) {
            expect(resolveLink(bad)).toEqual({ href: "#", external: false });
        }
    });

    it("nothing typed means no link", () => {
        expect(resolveLink("")).toEqual({ href: "#", external: false });
        expect(resolveLink("   ")).toEqual({ href: "#", external: false });
        expect(resolveLink(undefined)).toEqual({ href: "#", external: false });
        expect(resolveLink(null)).toEqual({ href: "#", external: false });
    });
});

describe("linkAttrs", () => {
    it("external links open in a new tab without handing the page over", () => {
        expect(linkAttrs(resolveLink("www.example.com"))).toEqual({ href: "https://www.example.com", target: "_blank", rel: "noopener noreferrer" });
    });

    it("internal links stay in the tab", () => {
        expect(linkAttrs(resolveLink("/about-us"))).toEqual({ href: "/about-us" });
    });
});
