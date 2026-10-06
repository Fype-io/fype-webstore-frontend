import type { Metadata } from "next";
import { headers } from "next/headers";
import {
    getApiBaseUrl,
    getShopByDomain,
    getTheme,
    getPagesByLocation,
    getAllPages,
    getProductDetails,
} from "@/lib/storefront-api";
import { loadTheme, resolveThemeSlug } from "@/lib/theme";
import ShopNotFound from "@/components/shared/ShopNotFound";
import { getRequestHost } from "@/lib/request-host";
import { isVerifiedEditorPreview } from "@/lib/editor-preview-server";

interface ProductDetailsPageProps {
    params: Promise<{ productId: string }>;
}

const PLACEHOLDER_PRODUCT_IMAGE =
    "https://i0.wp.com/mikeyarce.com/wp-content/uploads/2021/09/woocommerce-placeholder.png?ssl=1";

// Same isEditorPreview-gated placeholder convention as the Collection Page
// route — a store with zero real products couldn't preview/customize the
// Product Detail page at all otherwise (getProductDetails returns null,
// today's `product ? ... : "Product not found"` branch has no layout to
// design against). Never constructed for real customer traffic.
function placeholderProductDetail() {
    return {
        productId: "placeholder-product",
        name: "Sample Product",
        description: "",
        images: [PLACEHOLDER_PRODUCT_IMAGE],
        hasVariants: false,
        continueSellWhenOutOfStock: false,
        skuCode: "",
        barCode: "",
        price: { price: 0, compareAtPrice: 0, taxApplied: false, taxRate: undefined },
        display: {},
        inventory: { available: 0, continueSelling: false },
    };
}

async function getSharedShopData() {
    const headersList = await headers();
    const domain = getRequestHost(headersList);

    const apiBaseUrl = await getApiBaseUrl();
    const shop = await getShopByDomain(apiBaseUrl, domain);
    if (!shop) return null;

    const [theme, navPages, footerPages, allPages] = await Promise.all([
        getTheme(apiBaseUrl, shop.shopId),
        getPagesByLocation(apiBaseUrl, shop.shopId, "navigation"),
        getPagesByLocation(apiBaseUrl, shop.shopId, "footer"),
        getAllPages(apiBaseUrl, shop.shopId),
    ]);

    return { apiBaseUrl, shop, theme, navPages, footerPages, allPages };
}

export async function generateMetadata({ params }: ProductDetailsPageProps): Promise<Metadata> {
    const { productId } = await params;
    const data = await getSharedShopData();
    const storeName = data?.theme?.navbar?.title || data?.theme?.footer?.title || data?.shop?.shopName || "Store";
    if (!data) return { title: storeName };

    const { product } = await getProductDetails(data.apiBaseUrl, data.shop.shopId, productId);
    return { title: product ? `${product.name} - ${storeName}` : `Product Details - ${storeName}` };
}

export default async function ProductDetailsPage({ params }: ProductDetailsPageProps) {
    const { productId } = await params;
    const data = await getSharedShopData();

    if (!data || !data.theme) return <ShopNotFound />;

    const { apiBaseUrl, shop, theme, navPages, footerPages, allPages } = data;
    const fetched = await getProductDetails(apiBaseUrl, shop.shopId, productId);

    // Real customer traffic sees "Product not found" exactly as before
    // (handled inside ThemeProductDetailsPage/ProductDetailsView below) when
    // productId doesn't resolve. The editor iframe instead gets a
    // synthesized placeholder so a store with zero real products can still
    // customize the Product Detail page's layout — same convention as the
    // Collection Page route's placeholder fallback.
    const usePlaceholder = !fetched.product && (await isVerifiedEditorPreview(shop.shopId));
    const product = usePlaceholder ? placeholderProductDetail() : fetched.product;
    const variants = usePlaceholder ? [] : fetched.variants;
    const variantOptions = usePlaceholder ? null : fetched.variantOptions;
    const relatedProducts = usePlaceholder ? [] : fetched.relatedProducts;

    const themeSlug = resolveThemeSlug(theme.templateId);
    const themeModule = await loadTheme(themeSlug);

    // A theme with its own self-contained ProductDetailsPage (e.g. Spark)
    // owns the whole page, same delegation pattern as Home — see
    // MIGRATION_RUNBOOK.md.
    if (themeModule.ProductDetailsPage) {
        const ThemeProductDetailsPage = themeModule.ProductDetailsPage;
        return (
            <ThemeProductDetailsPage
                shop={shop}
                navPages={navPages}
                footerPages={footerPages}
                allPages={allPages}
                product={product}
                variants={variants}
                variantOptions={variantOptions}
                relatedProducts={relatedProducts}
                themeConfig={theme.themeConfig}
            />
        );
    }

    const { Header, Footer, ProductDetailsView } = themeModule;

    const baseNavItems = [
        { label: "Home", href: "/" },
        { label: "Shop", href: "/products" },
    ];
    const navigationPages = navPages.filter((p) => p.isActive && p.status === "visible" && p.pageType === "generic");
    const navItems = [...baseNavItems, ...navigationPages.map((p) => ({ label: p.title, href: `/${p.slug}` }))];

    return (
        <div>
            <Header variant="default" shopName={shop.shopName} navbar={theme.navbar} footer={theme.footer} navItems={navItems} storeId={shop.shopId} />

            {product ? (
                <ProductDetailsView
                    product={product}
                    variants={variants}
                    variantOptions={variantOptions}
                    relatedProducts={relatedProducts}
                    globalTax={shop.settings?.tax}
                    shopName={shop.shopName}
                    storeId={shop.shopId}
                />
            ) : (
                <div className="flex justify-center items-center min-h-screen text-black/60">Product not found</div>
            )}

            <Footer footer={theme.footer} navbar={theme.navbar} footerText={theme.footerText} shopName={shop.shopName} footerPages={footerPages} />
        </div>
    );
}
