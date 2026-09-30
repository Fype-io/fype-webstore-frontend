import type { Metadata } from "next";
import { headers } from "next/headers";
import {
    getApiBaseUrl,
    getShopByDomain,
    getTheme,
    getPagesByLocation,
    getPageBySlug,
} from "@/lib/storefront-api";
import { loadTheme, resolveThemeSlug } from "@/lib/theme";
import ShopNotFound from "@/components/shared/ShopNotFound";
import { getRequestHost } from "@/lib/request-host";

interface CmsPageProps {
    params: Promise<{ slug: string }>;
}

async function getSharedShopData() {
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

    return { apiBaseUrl, shop, theme, navPages, footerPages };
}

export async function generateMetadata({ params }: CmsPageProps): Promise<Metadata> {
    const { slug } = await params;
    const data = await getSharedShopData();
    const storeName = data?.theme?.navbar?.title || data?.theme?.footer?.title || data?.shop?.shopName || "Store";
    if (!data) return { title: storeName };

    const page = await getPageBySlug(data.apiBaseUrl, data.shop.shopId, slug);
    return { title: page ? `${page.title} - ${storeName}` : storeName };
}

export default async function CmsPage({ params }: CmsPageProps) {
    const { slug } = await params;
    const data = await getSharedShopData();

    if (!data || !data.theme) return <ShopNotFound />;

    const { apiBaseUrl, shop, theme, navPages, footerPages } = data;
    const page = await getPageBySlug(apiBaseUrl, shop.shopId, slug);

    const themeSlug = resolveThemeSlug(theme.templateId);
    const themeModule = await loadTheme(themeSlug);
    const { Header, Footer, DynamicPage } = themeModule;

    const baseNavItems = [
        { label: "Home", href: "/" },
        { label: "Shop", href: "/products" },
    ];
    const navigationPages = navPages.filter((p) => p.isActive && p.status === "visible" && p.pageType === "generic");
    const navItems = [...baseNavItems, ...navigationPages.map((p) => ({ label: p.title, href: `/${p.slug}` }))];

    return (
        <div>
            <Header
                variant="default"
                scrollingText={theme.enableScrollingText ? theme.scrollingText : undefined}
                scorllEnabled={false}
                shopName={shop.shopName}
                navbar={theme.navbar}
                footer={theme.footer}
                navItems={navItems}
                storeId={shop.shopId}
                themeConfig={theme.themeConfig}
            />

            {page ? (
                <DynamicPage title={page.title} content={page.content} />
            ) : (
                <div className="flex justify-center items-center min-h-screen text-black/60">Page not found</div>
            )}

            <Footer footer={theme.footer} navbar={theme.navbar} footerText={theme.footerText} shopName={shop.shopName} footerPages={footerPages} themeConfig={theme.themeConfig} />
        </div>
    );
}
