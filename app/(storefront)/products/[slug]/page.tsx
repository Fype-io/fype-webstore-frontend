import type { ReactNode } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { permanentRedirect } from "next/navigation";
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
import { getRequestHost, getRequestOrigin } from "@/lib/request-host";
import { isVerifiedEditorPreview } from "@/lib/editor-preview-server";
import { productHref, VARIANT_PARAM } from "@/lib/product-url";
import { buildProductJsonLd, jsonLdScript, metaDescription } from "@/lib/product-seo";
import { storeCurrencyCode } from "@/lib/currency";
import { calculateProductTax } from "@/utils/taxCalculator";

type SearchParams = Record<string, string | string[] | undefined>;

interface ProductDetailsPageProps {
    // The URL segment: the product's slug, or (older links) its PROD- id.
    params: Promise<{ slug: string }>;
    searchParams: Promise<SearchParams>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

/** The query string to carry over when redirecting, e.g. "?variant=VAR-1&utm_source=x"; empty when there is none. */
function queryString(searchParams: SearchParams): string {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
        for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, v);
    }
    const text = query.toString();
    return text ? `?${text}` : "";
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
    const { slug } = await params;
    const data = await getSharedShopData();
    const storeName = data?.theme?.navbar?.title || data?.theme?.footer?.title || data?.shop?.shopName || "Store";
    if (!data) return { title: storeName };

    const { product } = await getProductDetails(data.apiBaseUrl, data.shop.shopId, slug);
    if (!product) return { title: `Product Details - ${storeName}` };

    const title = `${product.name} - ${storeName}`;
    const description = metaDescription(product.description) || undefined;
    const allowIndexing = data.shop.settings?.seo?.allowIndexing !== false;
    // The canonical URL is the product's own page: never the id link or a ?variant= address.
    const canonical = `${getRequestOrigin(await headers())}${productHref(product)}`;
    const images = product.images?.[0] ? [{ url: product.images[0] }] : undefined;

    return {
        title,
        description,
        alternates: { canonical },
        openGraph: { title, description, url: canonical, siteName: storeName, type: "website", images },
        twitter: { card: images ? "summary_large_image" : "summary", title, description, images: images?.map((image) => image.url) },
        robots: { index: allowIndexing, follow: allowIndexing },
    };
}

export default async function ProductDetailsPage({ params, searchParams }: ProductDetailsPageProps) {
    const { slug } = await params;
    const query = await searchParams;
    const data = await getSharedShopData();

    if (!data || !data.theme) return <ShopNotFound />;

    const { apiBaseUrl, shop, theme, navPages, footerPages, allPages } = data;
    const fetched = await getProductDetails(apiBaseUrl, shop.shopId, slug);

    // An id link (/products/PROD-xxx, made before slugs existed) or a differently-cased slug
    // goes to the product's slug URL for good, keeping the query string (?variant=, utm_...).
    // Never inside the theme customizer's verified preview: the editor's frame must keep its path.
    if (fetched.product?.slug && fetched.product.slug !== slug && !(await isVerifiedEditorPreview(shop.shopId))) {
        permanentRedirect(`${productHref(fetched.product)}${queryString(query)}`);
    }

    // Real customer traffic sees "Product not found" exactly as before
    // (handled inside ThemeProductDetailsPage/ProductDetailsView below) when
    // the URL segment doesn't resolve. The editor iframe instead gets a
    // synthesized placeholder so a store with zero real products can still
    // customize the Product Detail page's layout — same convention as the
    // Collection Page route's placeholder fallback.
    const usePlaceholder = !fetched.product && (await isVerifiedEditorPreview(shop.shopId));
    const product = usePlaceholder ? placeholderProductDetail() : fetched.product;
    const variants = usePlaceholder ? [] : fetched.variants;
    const variantOptions = usePlaceholder ? null : fetched.variantOptions;
    const relatedProducts = usePlaceholder ? [] : fetched.relatedProducts;

    // Structured data for search engines; never for the editor's placeholder product.
    let structuredData: ReactNode = null;
    if (fetched.product && !usePlaceholder) {
        const detail = fetched.product;
        const variantPrices = detail.hasVariants ? variants.map((variant) => variant.price ?? 0) : [];
        const shown = (amount: number) =>
            Number(calculateProductTax(amount, shop.settings?.tax, { applied: detail.price.taxApplied, rate: detail.price.taxRate, effectiveRate: detail.price.effectiveTaxRate }).displayPrice);
        const lowest = variantPrices.length ? Math.min(...variantPrices) : detail.price.price;
        const highest = variantPrices.length ? Math.max(...variantPrices) : detail.price.price;
        const jsonLd = buildProductJsonLd({
            product: detail,
            variants,
            url: `${getRequestOrigin(await headers())}${productHref(detail)}`,
            currency: storeCurrencyCode(shop.settings?.currency),
            price: shown(lowest),
            maxPrice: shown(highest),
            description: metaDescription(detail.description),
        });
        structuredData = <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />;
    }

    const themeSlug = resolveThemeSlug(theme.templateId);
    const themeModule = await loadTheme(themeSlug);

    // The variant named in the address (?variant=<variantId>); the theme ignores an id that isn't one of this product's.
    const initialVariantId = firstValue(query[VARIANT_PARAM]) || undefined;

    // A theme with its own self-contained ProductDetailsPage (e.g. Spark)
    // owns the whole page, same delegation pattern as Home — see
    // MIGRATION_RUNBOOK.md.
    if (themeModule.ProductDetailsPage) {
        const ThemeProductDetailsPage = themeModule.ProductDetailsPage;
        return (
            <>
                {structuredData}
                <ThemeProductDetailsPage
                    shop={shop}
                    navPages={navPages}
                    footerPages={footerPages}
                    allPages={allPages}
                    product={product}
                    variants={variants}
                    variantOptions={variantOptions}
                    relatedProducts={relatedProducts}
                    {...(initialVariantId ? { initialVariantId } : {})}
                    themeConfig={theme.themeConfig}
                />
            </>
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
            {structuredData}
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
