"use client";

import Footer from "./sections/Footer";
import { sparkConfigFromStorefrontChrome } from "./storefrontChromeConfig";
import type { FooterCustomization, NavbarCustomization, Page } from "@/types/storefront";

interface StorefrontChromeFooterProps {
    footer?: FooterCustomization;
    navbar?: NavbarCustomization;
    footerText?: string;
    shopName?: string;
    footerPages: Page[];
    themeConfig?: Record<string, unknown>;
}

export default function StorefrontChromeFooter({ shopName, navbar, footerPages, themeConfig }: StorefrontChromeFooterProps) {
    const config = sparkConfigFromStorefrontChrome(shopName, navbar?.logoUrl, themeConfig);
    const { footer } = config.sections;
    const navItems = footerPages.map((page) => ({ label: page.title, href: `/${page.slug}` }));
    if (footer.hidden) return <></>;

    return (
        <Footer
            settings={footer.settings}
            blocks={footer.blocks.filter((b) => !b.hidden)}
            navItems={navItems}
            socialMedia={config.theme_settings.social_media}
            footerLogoUrl={config.theme_settings.logo.footer_logo_url}
            footerLogoWidth={config.theme_settings.logo.footer_logo_width}
            shopName={shopName}
        />
    );
}
