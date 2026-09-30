import type { Metadata } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import { getApiBaseUrl, getShopByDomain } from "@/lib/storefront-api";
import { resolveActiveGateways } from "@/hooks/useActiveGateways";
import ShopNotFound from "@/components/shared/ShopNotFound";
import CheckoutView from "@/components/checkout/CheckoutView";
import { getRequestHost } from "@/lib/request-host";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
    const headersList = await headers();
    const domain = getRequestHost(headersList);

    const apiBaseUrl = await getApiBaseUrl();
    const shop = await getShopByDomain(apiBaseUrl, domain);

    if (!shop) return <ShopNotFound />;

    const activeLogistics = shop.settings?.logistics?.active ?? ["manualShipping"];
    const hasDeliveryApp =
        (activeLogistics.includes("dtdc") && !!shop.settings?.logistics?.dtdc?.enabled) ||
        (activeLogistics.includes("delhivery") && !!shop.settings?.logistics?.delhivery?.enabled);
    const hasManualShipping = !hasDeliveryApp && !!shop.settings?.logistics?.manualShipping;
    const activeGateways = resolveActiveGateways(shop);

    return (
        <>
            {/* Each gateway's script loads independently, gated on its own
                membership in activeGateways - Stripe's SDK (loaded internally by
                useStripeAdapter via @stripe/stripe-js) never waits on this tag,
                and this tag never waits on Stripe. */}
            {activeGateways.includes("razorpay") && <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />}
            <CheckoutView
                storeId={shop.shopId}
                shopName={shop.shopName}
                hasDeliveryApp={hasDeliveryApp}
                hasManualShipping={hasManualShipping}
                activeGateways={activeGateways}
                stripePublishableKey={shop.settings?.payment?.stripe?.publishableKey}
            />
        </>
    );
}
