"use client";

import type { SparkFooterBlock, SparkFooterSettings, SparkThemeSettingsSocialMedia } from "../sparkConfig";

interface FooterProps {
    settings: SparkFooterSettings;
    // Already filtered for hidden, in the merchant's chosen order.
    blocks: SparkFooterBlock[];
    navItems?: Array<{ label: string; href: string }>;
    socialMedia: SparkThemeSettingsSocialMedia;
    footerLogoUrl: string;
    footerLogoWidth: number;
    // Store name for the copyright line; falls back to the theme name.
    shopName?: string;
    isEditorPreview?: boolean;
    activeBlockId?: string | null;
    onBlockClick?: (kind: "text" | "menu", id: string) => void;
}

const XLogo = ({ size = 18 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
);

// Hand-styled badge spans (no real payment-provider icon assets) — same
// convention as the reference's Footer.tsx, matched case-insensitively.
const PAYMENT_BADGES: Record<string, React.ReactNode> = {
    visa: <span className="h-6 px-2.5 bg-white rounded flex items-center justify-center border border-gray-200 shadow-sm text-[10px] font-extrabold text-blue-900 tracking-wider select-none">VISA</span>,
    mastercard: (
        <span className="h-6 px-2.5 bg-white rounded flex items-center justify-center border border-gray-200 shadow-sm select-none">
            <span className="flex -space-x-1">
                <span className="w-3 h-3 rounded-full bg-red-500 opacity-90 block" />
                <span className="w-3 h-3 rounded-full bg-yellow-500 opacity-90 block" />
            </span>
        </span>
    ),
    amex: <span className="h-6 px-2.5 bg-white rounded flex items-center justify-center border border-gray-200 shadow-sm text-[10px] font-bold text-blue-700 italic select-none">AMEX</span>,
    paypal: <span className="h-6 px-2.5 bg-white rounded flex items-center justify-center border border-gray-200 shadow-sm text-[10px] font-black text-blue-900 italic select-none">PayPal</span>,
    "apple pay": <span className="h-6 px-2.5 bg-white rounded flex items-center justify-center border border-gray-200 shadow-sm text-[10px] font-bold text-gray-900 select-none">Pay</span>,
    "google pay": (
        <span className="h-6 px-2.5 bg-white rounded flex items-center justify-center border border-gray-200 shadow-sm text-[10px] font-bold text-gray-800 select-none">
            <span className="text-blue-500">G</span>Pay
        </span>
    ),
    discover: <span className="h-6 px-2.5 bg-white rounded flex items-center justify-center border border-gray-200 shadow-sm text-[10px] font-bold text-orange-600 select-none">DISCOVER</span>,
    upi: <span className="h-6 px-2.5 bg-white rounded flex items-center justify-center border border-gray-200 shadow-sm text-[10px] font-black text-emerald-700 tracking-wider select-none">UPI</span>,
    "samsung pay": <span className="h-6 px-2.5 bg-white rounded flex items-center justify-center border border-gray-200 shadow-sm text-[10px] font-black text-blue-950 select-none">SAMSUNG pay</span>,
    tabby: <span className="h-6 px-2.5 bg-emerald-300 text-emerald-950 rounded flex items-center justify-center border border-emerald-300 shadow-sm text-[10px] font-black tracking-tight select-none">tabby</span>,
    tamara: <span className="h-6 px-2.5 bg-amber-100 text-amber-950 rounded flex items-center justify-center border border-amber-200 shadow-sm text-[10px] font-bold tracking-tight select-none">tamara</span>,
};

function resolveFooterMenuItem(item: string, navItems: Array<{ label: string; href: string }> = []) {
    const lowerItem = item.toLowerCase();
    if (lowerItem === "home") return { label: "Home", href: "/" };
    if (lowerItem === "shop") return { label: "Shop", href: "/products" };
    if (lowerItem === "collections") return { label: "Collections", href: "/collections" };
    if (lowerItem.startsWith("page:")) {
        const [pagePart, ...titleParts] = item.split("|");
        const slug = pagePart.slice(5);
        const serverItem = navItems.find((entry) => entry.href === `/${slug}`);
        return { label: titleParts.join("|") || serverItem?.label || slug, href: serverItem?.href || `/${slug}` };
    }
    const serverItem = navItems.find((entry) => entry.label.toLowerCase() === lowerItem);
    if (serverItem) return serverItem;
    return { label: item, href: `/${item.toLowerCase().replace(/\s+/g, "-")}` };
}

// Full port of Fype-E-Commerce-UI's sections/Footer.tsx (read-only design
// reference, commit dc33eb4 — the commit that first added a real Footer
// section). Fixed singleton like Header, not a Body instance — see
// sparkConfig.ts's SparkSectionsConfig comment.
export default function Footer({
    settings,
    blocks,
    navItems = [],
    socialMedia,
    footerLogoUrl,
    footerLogoWidth,
    shopName,
    isEditorPreview = false,
    activeBlockId = null,
    onBlockClick,
}: FooterProps) {
    const socialLinks: Array<{ url: string; icon: React.ReactNode }> = [
        { url: socialMedia.x_twitter, icon: <XLogo size={18} /> },
        { url: socialMedia.facebook, icon: <FacebookIcon /> },
        { url: socialMedia.instagram, icon: <InstagramIcon /> },
        { url: socialMedia.linkedin, icon: <LinkedinIcon /> },
        { url: socialMedia.youtube, icon: <YoutubeIcon /> },
    ].filter((l) => l.url);

    const wrapBlock = (kind: "text" | "menu", id: string, label: string, className: string, children: React.ReactNode) => {
        if (!isEditorPreview) return <div className={className}>{children}</div>;
        const isActive = activeBlockId === id;
        return (
            <div
                id={`spark-block-${id}`}
                className={`relative group/block cursor-pointer transition-all ${className} ${
                    isActive ? "ring-2 ring-blue-500 rounded p-2 -m-2 z-20" : "hover:ring-1 hover:ring-blue-400 rounded p-2 -m-2 z-20"
                }`}
                onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onBlockClick?.(kind, id);
                }}
            >
                <div
                    className={`absolute -top-5 left-0 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 whitespace-nowrap z-30 transition-opacity ${
                        isActive ? "opacity-100" : "opacity-0 group-hover/block:opacity-100"
                    }`}
                >
                    {label}
                </div>
                {children}
            </div>
        );
    };

    const paymentIcons = settings.payment_icons ?? [];

    return (
        <footer className="relative py-20 px-6" style={{ backgroundColor: settings.background_color, color: settings.text_color }}>
            <div className="absolute top-0 left-0 right-0 h-px bg-current opacity-10" />
            <div className="max-w-7xl mx-auto">
                {footerLogoUrl && (
                    <div className="mb-12 flex items-center shrink-0 overflow-hidden" style={{ width: `${footerLogoWidth}px` }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={footerLogoUrl} alt="Footer Logo" className="w-full h-auto max-h-16 object-contain" />
                    </div>
                )}
                <div className="grid gap-12 mb-20 grid-cols-2 md:grid-cols-5">
                    {blocks.map((block) => {
                        if (block.type === "Text") {
                            return (
                                <div key={block.id} className="col-span-2">
                                    {wrapBlock(
                                        "text",
                                        block.id,
                                        "Text",
                                        "",
                                        <>
                                            {!footerLogoUrl && (
                                                <div className="text-2xl font-black tracking-tighter mb-6">Spark.</div>
                                            )}
                                            <div className="max-w-sm mb-8 text-base leading-relaxed opacity-80" dangerouslySetInnerHTML={{ __html: block.settings.text }} />
                                            {socialLinks.length > 0 && (
                                                <div className="flex flex-wrap gap-4">
                                                    {socialLinks.map((l, i) => (
                                                        <a
                                                            key={i}
                                                            href={l.url}
                                                            className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-900 hover:bg-gray-100 transition-colors shadow-sm"
                                                        >
                                                            {l.icon}
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        }

                        if (block.type === "Menu") {
                            return (
                                <div key={block.id}>
                                    {wrapBlock(
                                        "menu",
                                        block.id,
                                        "Menu",
                                        "",
                                        <>
                                            <h4 className="font-bold mb-6 text-lg">{block.settings.heading}</h4>
                                            <ul className="space-y-4 opacity-80">
                                                {block.settings.menu_items.map((item, i) => {
                                                    const link = resolveFooterMenuItem(item, navItems);
                                                    return (
                                                        <li key={i}>
                                                            <a href={link.href} className="hover:opacity-70 transition-opacity">
                                                                {link.label}
                                                            </a>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </>
                                    )}
                                </div>
                            );
                        }

                        return null;
                    })}
                </div>

                <hr className="border-t border-current opacity-20 mb-8" />
                <div className="flex items-center justify-between gap-6 text-sm opacity-80 flex-col md:flex-row">
                    <p>
                        Copyright © {new Date().getFullYear()} {shopName?.trim() || "Spark"}.{" "}
                        <a href="https://www.fype.io" target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity">
                            Powered by Fype
                        </a>
                    </p>
                    {paymentIcons.length > 0 && (
                        <div className="flex flex-wrap gap-2.5 items-center">
                            {paymentIcons.map((name) => {
                                const badge = PAYMENT_BADGES[name.toLowerCase()];
                                return badge ? <span key={name}>{badge}</span> : null;
                            })}
                        </div>
                    )}
                </div>
            </div>
        </footer>
    );
}

function FacebookIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z" />
        </svg>
    );
}

function InstagramIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
    );
}

function LinkedinIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.59 0 4.25 2.36 4.25 5.44v6.3zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z" />
        </svg>
    );
}

function YoutubeIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z" />
        </svg>
    );
}
