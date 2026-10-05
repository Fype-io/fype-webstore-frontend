import { loadTheme } from "@/lib/theme";
import type { ThemeSlug } from "./registry";
import type { GridProduct } from "./theme_one/ProductGrid";
import type { Category, Page, ShopIdentity, StorefrontProduct, ThemeCustomization, ThemeSections } from "@/types/storefront";

// The actual "given resolved data, render the themed Home page" logic —
// shared by the real per-store route (app/(storefront)/page.tsx, fed by a
// real domain-resolved shop+theme) and the store-independent theme preset
// preview route (app/theme-preview/[templateId]/page.tsx, fed by fully
// static demo data). Neither caller needs to know how a theme composes
// itself — that's entirely this component's + the registry's job.
export interface ThemedHomeProps {
    themeSlug: ThemeSlug;
    shop: ShopIdentity;
    theme: ThemeCustomization;
    navPages: Page[];
    footerPages: Page[];
    newInProducts: StorefrontProduct[];
    bestSellerProducts: StorefrontProduct[];
    categories: Category[];
}

function formatProductsForGrid(products: StorefrontProduct[]): GridProduct[] {
    return products.map((product) => ({
        id: product.productId,
        productId: product.productId,
        name: product.name,
        price: product.price,
        maxPrice: product.maxPrice,
        compareAtPrice: product.compareAtPrice,
        hasVariants: product.hasVariants,
        taxApplied: product.taxApplied,
        taxRate: product.taxRate,
        hasDiscount: product.hasDiscount,
        discountPercentage: product.discountPercentage,
        imageUrl:
            product.image ||
            product.images?.[0] ||
            "https://i0.wp.com/mikeyarce.com/wp-content/uploads/2021/09/woocommerce-placeholder.png?ssl=1",
    }));
}

export default async function ThemedHome({
    themeSlug,
    shop,
    theme,
    navPages,
    footerPages,
    newInProducts,
    bestSellerProducts,
    categories,
}: ThemedHomeProps) {
    const themeModule = await loadTheme(themeSlug);

    // A theme that implements its own self-contained HomePage (e.g. Spark)
    // owns its entire Home rendering, including its own Header/Footer — the
    // generic theme_one-specific section-switching below doesn't apply to it
    // at all. theme_one itself doesn't export HomePage (deliberately not
    // retrofitted — see MIGRATION_RUNBOOK.md Phase 4), so it always falls
    // through to the existing logic.
    if (themeModule.HomePage) {
        const HomePageComponent = themeModule.HomePage;
        return (
            <HomePageComponent
                shop={shop}
                navPages={navPages}
                footerPages={footerPages}
                newInProducts={newInProducts}
                bestSellerProducts={bestSellerProducts}
                categories={categories}
                themeConfig={theme.themeConfig}
            />
        );
    }

    const { Header, Footer, Hero, ProductGrid, Collections } = themeModule;

    const baseNavItems = [
        { label: "Home", href: "/" },
        { label: "Shop", href: "/products" },
    ];
    const navigationPages = navPages.filter(
        (page) => page.isActive && page.status === "visible" && page.pageType === "generic"
    );
    const navItems = [...baseNavItems, ...navigationPages.map((page) => ({ label: page.title, href: `/${page.slug}` }))];

    const sections = theme.sections;
    const isSectionEnabled = (sectionName: keyof ThemeSections) => sections[sectionName]?.enabled ?? true;
    const sortedSections = Object.entries(sections).sort(([, a], [, b]) => (a?.order || 0) - (b?.order || 0));

    const formattedCollections = categories.map((category) => ({
        id: category.slug,
        name: category.name,
        imageUrl: category.banner?.imageUrl,
    }));

    const globalTax = shop.settings?.tax;

    return (
        <div className="bg-white font-display text-black">
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

            <main className="grow" style={{ paddingTop: theme.enableScrollingText ? "40px" : "0px" }}>
                {sortedSections.map(([key, section]) => {
                    if (!section?.enabled) return null;

                    switch (key) {
                        case "heroBanner":
                            return <Hero key={key} slides={section.images} />;

                        case "newInStore":
                            return newInProducts.length > 0 ? (
                                <ProductGrid
                                    key={key}
                                    products={formatProductsForGrid(newInProducts)}
                                    title={section.title}
                                    globalTax={globalTax}
                                    currency={shop.settings?.currency}
                                />
                            ) : null;

                        case "categories":
                            return formattedCollections.length > 0 ? (
                                <Collections key={key} collections={formattedCollections} />
                            ) : null;

                        case "bestSellers":
                            return bestSellerProducts.length > 0 ? (
                                <ProductGrid
                                    key={key}
                                    products={formatProductsForGrid(bestSellerProducts)}
                                    title={section.title}
                                    globalTax={globalTax}
                                    currency={shop.settings?.currency}
                                />
                            ) : null;

                        case "footerSection":
                            return null;

                        default:
                            return null;
                    }
                })}
            </main>

            {isSectionEnabled("footerSection") && (
                <Footer
                    footer={theme.footer}
                    navbar={theme.navbar}
                    footerText={theme.footerText}
                    shopName={shop.shopName}
                    footerPages={footerPages}
                />
            )}
        </div>
    );
}
