import type { Metadata } from "next";
import { headers } from "next/headers";
import { getApiBaseUrl, getShopByDomain, getTheme, getPagesByLocation } from "@/lib/storefront-api";
import { loadTheme, resolveThemeSlug } from "@/lib/theme";
import ShopNotFound from "@/components/shared/ShopNotFound";
import { getRequestHost } from "@/lib/request-host";

async function getPageData() {
    const headersList = await headers();
    const domain = getRequestHost(headersList);

    const apiBaseUrl = await getApiBaseUrl();
    const shop = await getShopByDomain(apiBaseUrl, domain);
    if (!shop) return null;

    const [theme, navPages, footerPages] = await Promise.all([
        getTheme(apiBaseUrl, shop.shopId),
        getPagesByLocation(apiBaseUrl, shop.shopId, "navigation"),
        getPagesByLocation(apiBaseUrl, shop.shopId, "footer"),
    ]);

    return { shop, theme, navPages, footerPages };
}

export async function generateMetadata(): Promise<Metadata> {
    const data = await getPageData();
    const storeName = data?.theme?.navbar?.title || data?.theme?.footer?.title || data?.shop?.shopName || "Store";
    return { title: `My Profile - ${storeName}` };
}

export default async function ProfilePage() {
    const data = await getPageData();

    if (!data || !data.theme) return <ShopNotFound />;

    const { shop, theme, navPages, footerPages } = data;

    const themeSlug = resolveThemeSlug(theme.templateId);
    const themeModule = await loadTheme(themeSlug);
    const { Header, Footer, AccountLayout, ProfileView } = themeModule;

    const baseNavItems = [
        { label: "Home", href: "/" },
        { label: "Shop", href: "/products" },
    ];
    const navigationPages = navPages.filter((p) => p.isActive && p.status === "visible" && p.pageType === "generic");
    const navItems = [...baseNavItems, ...navigationPages.map((p) => ({ label: p.title, href: `/${p.slug}` }))];

    return (
        <div className="min-h-screen flex flex-col bg-white text-black font-sans">
            <Header
                variant="default"
                scrollingText={theme.enableScrollingText ? theme.scrollingText : undefined}
                scorllEnabled={theme.enableScrollingText}
                shopName={shop.shopName}
                navbar={theme.navbar}
                footer={theme.footer}
                navItems={navItems}
                storeId={shop.shopId}
                themeConfig={theme.themeConfig}
            />

            <AccountLayout title="My Profile" storeId={shop.shopId}>
                <ProfileView storeId={shop.shopId} />
            </AccountLayout>

            <Footer footer={theme.footer} navbar={theme.navbar} footerText={theme.footerText} shopName={shop.shopName} footerPages={footerPages} themeConfig={theme.themeConfig} />
        </div>
    );
}
