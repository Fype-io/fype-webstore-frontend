import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import {
    getApiBaseUrl,
    getShopByDomain,
    getTheme,
    getPagesByLocation,
    getCategories,
    getAllProducts,
} from "@/lib/storefront-api";
import { loadTheme, resolveThemeSlug } from "@/lib/theme";
import ShopNotFound from "@/components/shared/ShopNotFound";
import type { ProductSortBy } from "@/types/storefront";
import { mergeSparkConfig, sparkDefaultConfig } from "@/components/themes/spark/sparkConfig";
import { getRequestHost } from "@/lib/request-host";

interface ProductsPageProps {
    searchParams: Promise<{
        category?: string;
        minPrice?: string;
        maxPrice?: string;
        sortBy?: string;
        search?: string;
        page?: string;
    }>;
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

export async function generateMetadata(): Promise<Metadata> {
    const data = await getSharedShopData();
    const storeName = data?.theme?.navbar?.title || data?.theme?.footer?.title || data?.shop?.shopName || "Store";
    return { title: `Products - ${storeName}` };
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
    const params = await searchParams;
    const data = await getSharedShopData();

    if (!data || !data.theme) return <ShopNotFound />;

    const { apiBaseUrl, shop, theme, navPages, footerPages } = data;

    const themeSlug = resolveThemeSlug(theme.templateId);
    const themeModule = await loadTheme(themeSlug);

    // Spark's own configured default only kicks in when no `?sortBy=` is
    // present yet — ProductFilters.tsx's own sort dropdown already works
    // independently of this once a merchant/visitor picks one. theme is
    // already fetched above, so this is no extra network round trip.
    const defaultSort: ProductSortBy =
        themeSlug === "spark" ? mergeSparkConfig(sparkDefaultConfig, theme.themeConfig).page_settings.shop.default_sort : "newest";

    const page = params.page ? Number(params.page) : 1;
    const [categories, { products, pagination }] = await Promise.all([
        getCategories(apiBaseUrl, shop.shopId, false),
        getAllProducts(apiBaseUrl, shop.shopId, {
            category: params.category,
            minPrice: params.minPrice ? Number(params.minPrice) : undefined,
            maxPrice: params.maxPrice ? Number(params.maxPrice) : undefined,
            sortBy: (params.sortBy as ProductSortBy) || defaultSort,
            search: params.search,
            page,
            limit: 12,
        }),
    ]);

    // A theme with its own self-contained ProductsPage (e.g. Spark) owns
    // the whole page, same delegation pattern as Home — see
    // MIGRATION_RUNBOOK.md.
    if (themeModule.ProductsPage) {
        const ThemeProductsPage = themeModule.ProductsPage;
        return (
            <ThemeProductsPage
                shop={shop}
                navPages={navPages}
                footerPages={footerPages}
                categories={categories}
                products={products}
                pagination={pagination}
                searchParams={params}
                themeConfig={theme.themeConfig}
            />
        );
    }

    const { Header, Footer, ProductCard, ProductFilters } = themeModule;

    const baseNavItems = [
        { label: "Home", href: "/" },
        { label: "Shop", href: "/products" },
    ];
    const navigationPages = navPages.filter(
        (p) => p.isActive && p.status === "visible" && p.pageType === "generic"
    );
    const navItems = [...baseNavItems, ...navigationPages.map((p) => ({ label: p.title, href: `/${p.slug}` }))];

    const globalTax = shop.settings?.tax;

    const buildPageHref = (targetPage: number) => {
        const qs = new URLSearchParams();
        if (params.category) qs.set("category", params.category);
        if (params.minPrice) qs.set("minPrice", params.minPrice);
        if (params.maxPrice) qs.set("maxPrice", params.maxPrice);
        if (params.sortBy) qs.set("sortBy", params.sortBy);
        if (params.search) qs.set("search", params.search);
        qs.set("page", String(targetPage));
        return `/products?${qs.toString()}`;
    };

    return (
        <div className="bg-white font-display text-[#333333]">
            <Header variant="default" shopName={shop.shopName} navbar={theme.navbar} footer={theme.footer} navItems={navItems} storeId={shop.shopId} />

            <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden pt-10">
                <div className="flex flex-1 justify-center">
                    <div className="flex flex-col max-w-7xl flex-1">
                        <main className="px-4 sm:px-6 lg:px-8 py-8">
                            <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                                <h2 className="text-4xl font-black tracking-tighter text-[#333333]">Products</h2>
                                <p className="text-sm text-gray-500">{pagination?.totalItems || 0} products</p>
                            </div>

                            <ProductFilters categories={categories} />

                            {products.length > 0 ? (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                        {products.map((product) => (
                                            <ProductCard key={product.productId} product={product} globalTax={globalTax} shopName={shop.shopName} storeId={shop.shopId} currency={shop.settings?.currency} />
                                        ))}
                                    </div>

                                    {pagination && pagination.totalPages > 1 && (
                                        <div className="flex items-center justify-center gap-4 mt-8">
                                            {pagination.hasPrevPage && (
                                                <Link href={buildPageHref(page - 1)} className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50">
                                                    Previous
                                                </Link>
                                            )}
                                            <span className="text-sm text-gray-500">
                                                Page {pagination.currentPage} of {pagination.totalPages}
                                            </span>
                                            {pagination.hasNextPage && (
                                                <Link href={buildPageHref(page + 1)} className="px-6 py-3 bg-black text-white rounded-lg font-semibold hover:opacity-90">
                                                    Next
                                                </Link>
                                            )}
                                        </div>
                                    )}

                                    {pagination && (
                                        <div className="text-center mt-4 text-sm text-gray-500">
                                            Showing {products.length} of {pagination.totalItems} products
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center py-16">
                                    <svg className="w-16 h-16 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <p className="text-gray-500 text-lg mb-2 mt-4">No products found</p>
                                    <p className="text-gray-400 text-sm">Try adjusting your filters or search query</p>
                                </div>
                            )}
                        </main>
                    </div>
                </div>
            </div>

            <Footer footer={theme.footer} navbar={theme.navbar} footerText={theme.footerText} shopName={shop.shopName} footerPages={footerPages} />
        </div>
    );
}
