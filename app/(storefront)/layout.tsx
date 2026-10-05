import type { Metadata } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import { loadTheme, resolveThemeSlug } from "@/lib/theme";
import { getApiBaseUrl, getShopByDomain, getTheme } from "@/lib/storefront-api";
import { enforceStorefrontPassword } from "@/lib/enforce-storefront-password";
import Providers from "@/components/shared/Providers";
import EditorPreviewNavigationLock from "@/components/shared/EditorPreviewNavigationLock";
import { getRequestHost } from "@/lib/request-host";

// Same validation the SPA used (App.tsx) before building either script — only
// a plausible pixel/container id ever gets interpolated into injected JS.
const META_PIXEL_ID_PATTERN = /^\d{10,20}$/;
const GTM_CONTAINER_ID_PATTERN = /^GTM-[A-Z0-9]{4,10}$/;

export async function generateMetadata(): Promise<Metadata> {
    const headersList = await headers();
    const domain = getRequestHost(headersList);
    const apiBaseUrl = await getApiBaseUrl();
    const shop = await getShopByDomain(apiBaseUrl, domain);

    if (!shop) {
        return {};
    }

    const storeTheme = await getTheme(apiBaseUrl, shop.shopId);
    const themeConfig = storeTheme?.themeConfig as any;
    const faviconUrl = themeConfig?.theme_settings?.logo?.favicon_url;

    return {
        icons: faviconUrl
            ? {
                  icon: faviconUrl,
              }
            : undefined,
    };
}

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
    const headersList = await headers();
    const domain = getRequestHost(headersList);
    const headerThemeId = headersList.get("x-theme-id");

    const apiBaseUrl = await getApiBaseUrl();
    const shop = await getShopByDomain(apiBaseUrl, domain);
    await enforceStorefrontPassword(shop);
    // The live Theme document's templateId (not shop.themeId, which is that
    // document's own instance id, e.g. "THEME-xxx") is the real registry
    // slug — see ThemeCustomization.templateId. Without this, the outer
    // chrome (BottomNav for theme_one, Spark's plain wrapper) could resolve
    // a different theme than the page content inside it does.
    const storeTheme = shop ? await getTheme(apiBaseUrl, shop.shopId) : null;

    const themeSlug = resolveThemeSlug(storeTheme?.templateId ?? headerThemeId);
    const themeModule = await loadTheme(themeSlug);
    const ThemeLayout = themeModule.Layout;

    const marketing = shop?.settings?.marketing;
    const metaPixelId = marketing?.metaPixel?.enabled ? marketing.metaPixel.pixelId : undefined;
    const gtmContainerId = marketing?.googleTagManager?.enabled ? marketing.googleTagManager.containerId : undefined;
    const showMetaPixel = !!metaPixelId && META_PIXEL_ID_PATTERN.test(metaPixelId);
    const showGtm = !!gtmContainerId && GTM_CONTAINER_ID_PATTERN.test(gtmContainerId);

    return (
        <>
            {showGtm && (
                <Script id="storefront-gtm" strategy="afterInteractive">
                    {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;
                    j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
                    f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmContainerId}');`}
                </Script>
            )}
            {showMetaPixel && (
                <Script id="storefront-meta-pixel" strategy="afterInteractive">
                    {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
                    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
                    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
                    (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
                    fbq('init','${metaPixelId}');`}
                </Script>
            )}
            <Providers storeId={shop?.shopId} currency={shop?.settings?.currency}>
                <EditorPreviewNavigationLock />
                <ThemeLayout shopName={shop?.shopName} storeId={shop?.shopId}>
                    {children}
                </ThemeLayout>
            </Providers>
        </>
    );
}
