// One place that turns a link a merchant picked or typed in the theme editor into something safe to put in an
// <a href>. Every Spark block that has a link uses it, so a link means the same in all of them.
//
// - Internal paths (/products/<slug>, /collections/<slug>, /<page>) are kept as they are; "/shop" means the shop.
// - Addresses typed without a scheme (www.site.com, site.com/offer, //cdn.site.com) get https:// and open in a new tab.
// - tel:, mailto: and #anchors are kept.
// - javascript:, data:, vbscript: and file: links are dropped (they would run when a shopper clicks them).

export interface ResolvedLink {
    href: string;
    external: boolean;
}

const NO_LINK: ResolvedLink = { href: "#", external: false };
const UNSAFE_SCHEME = /^(javascript|data|vbscript|file):/i;

export function resolveLink(value: string | null | undefined): ResolvedLink {
    const href = String(value ?? "").trim();
    if (!href) return NO_LINK;

    // Browsers ignore tabs, new lines and spaces inside a scheme ("java\nscript:"), so look at it without them.
    // eslint-disable-next-line no-control-regex
    if (UNSAFE_SCHEME.test(href.replace(/[\u0000- \u007f]/g, ""))) return NO_LINK;

    if (href === "/shop" || href === "/shops") return { href: "/products", external: false };

    const external = /^(https?:\/\/|\/\/|www\.)/i.test(href) || /^[\w-]+(?:\.[\w-]+)+(?:\/|$)/i.test(href);
    if (!external) return { href, external: false };
    if (/^https?:\/\//i.test(href)) return { href, external: true };
    return { href: `https://${href.replace(/^\/\//, "")}`, external: true };
}

/** The attributes of an <a> for a resolved link: external links open in a new tab, safely. */
export function linkAttrs(link: ResolvedLink): { href: string; target?: string; rel?: string } {
    return link.external ? { href: link.href, target: "_blank", rel: "noopener noreferrer" } : { href: link.href };
}
