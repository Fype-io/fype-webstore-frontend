import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import {
    getApiBaseUrl,
    getShopByDomain,
    getTheme,
    getPagesByLocation,
    getBestSellers,
} from "@/lib/storefront-api";
import { loadTheme, resolveThemeSlug } from "@/lib/theme";
import ShopNotFound from "@/components/shared/ShopNotFound";
import { getRequestHost } from "@/lib/request-host";
import { currencyPrefix } from "@/lib/currency";

async function getCartPageData() {
    const headersList = await headers();
    const domain = getRequestHost(headersList);

    const apiBaseUrl = await getApiBaseUrl();
    const shop = await getShopByDomain(apiBaseUrl, domain);
    if (!shop) return null;

    const [theme, navPages, footerPages, bestSellerProducts] = await Promise.all([
        getTheme(apiBaseUrl, shop.shopId),
        getPagesByLocation(apiBaseUrl, shop.shopId, "navigation"),
        getPagesByLocation(apiBaseUrl, shop.shopId, "footer"),
        getBestSellers(apiBaseUrl, shop.shopId, 4),
    ]);

    return { shop, theme, navPages, footerPages, bestSellerProducts };
}

export async function generateMetadata(): Promise<Metadata> {
    const data = await getCartPageData();
    const storeName = data?.theme?.navbar?.title || data?.theme?.footer?.title || data?.shop?.shopName || "Store";
    return { title: `Cart - ${storeName}` };
}

export default async function CartPage() {
    const data = await getCartPageData();

    if (!data || !data.theme) return <ShopNotFound />;

    const { shop, theme, navPages, footerPages, bestSellerProducts } = data;
    const prefix = currencyPrefix(shop.settings?.currency);

    const themeSlug = resolveThemeSlug(theme.templateId);
    const themeModule = await loadTheme(themeSlug);

    // A theme with its own self-contained CartPage (e.g. Spark) owns the
    // whole page, same delegation pattern as Home — see
    // MIGRATION_RUNBOOK.md.
    if (themeModule.CartPage) {
        const ThemeCartPage = themeModule.CartPage;
        return <ThemeCartPage shop={shop} navPages={navPages} footerPages={footerPages} bestSellerProducts={bestSellerProducts} />;
    }

    const { Header, Footer, CartView } = themeModule;

    const baseNavItems = [
        { label: "Home", href: "/" },
        { label: "Shop", href: "/products" },
    ];
    const navigationPages = navPages.filter((p) => p.isActive && p.status === "visible" && p.pageType === "generic");
    const navItems = [...baseNavItems, ...navigationPages.map((p) => ({ label: p.title, href: `/${p.slug}` }))];

    return (
        <div className="min-h-screen bg-white font-display">
            <Header
                variant="default"
                scrollingText={theme.enableScrollingText ? theme.scrollingText : undefined}
                scorllEnabled={theme.enableScrollingText}
                shopName={shop.shopName}
                navbar={theme.navbar}
                footer={theme.footer}
                navItems={navItems}
                storeId={shop.shopId}
            />

            <main className="container mx-auto px-4 py-8 lg:py-12 max-w-7xl">
                <CartView storeId={shop.shopId} shopName={shop.shopName} taxLabel={shop.settings?.tax?.label} />

                {bestSellerProducts.length > 0 && (
                    <div className="mt-20">
                        <div className="text-center mb-10">
                            <h2 className="text-xl font-black uppercase tracking-[0.2em] text-black">Steal Deals</h2>
                            <p className="text-[10px] uppercase font-bold text-gray-400 mt-2">Worth adding to your bag</p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {bestSellerProducts.map((product) => (
                                <Link href={`/products/${product.productId}`} key={product.productId} className="group cursor-pointer block">
                                    <div className="aspect-[3/4] overflow-hidden bg-gray-50 rounded-sm relative mb-3">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={product.image || "/placeholder-product.png"}
                                            alt={product.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                        <div className="absolute top-2 left-2 bg-white text-[8px] font-black uppercase px-2 py-1 tracking-tighter rounded-sm shadow-sm text-red-500">
                                            Steal Deal
                                        </div>
                                    </div>
                                    <h3 className="text-[10px] font-bold uppercase tracking-tight truncate text-black">{product.name}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] font-black italic text-black">{prefix}{product.price}</span>
                                        {product.compareAtPrice && product.compareAtPrice > product.price ? (
                                            <span className="text-[8px] text-gray-400 line-through">{prefix}{product.compareAtPrice}</span>
                                        ) : null}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            <Footer footer={theme.footer} navbar={theme.navbar} footerText={theme.footerText} shopName={shop.shopName} footerPages={footerPages} />
        </div>
    );
}
