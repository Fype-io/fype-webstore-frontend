import { headers } from "next/headers";
import { getApiBaseUrl, getShopByDomain } from "@/lib/storefront-api";
import { enforceStorefrontPassword } from "@/lib/enforce-storefront-password";
import Providers from "@/components/shared/Providers";
import "./checkout.css";
import { getRequestHost } from "@/lib/request-host";

// Minimal shell, deliberately not routed through the theme registry — checkout
// is one canonical flow shared by every theme/store. Branding lives in the
// Generic-UI checkout header (back + title), not a second store chrome bar.
export default async function CheckoutLayout({ children }: { children: React.ReactNode }) {
    const headersList = await headers();
    const domain = getRequestHost(headersList);

    const apiBaseUrl = await getApiBaseUrl();
    const shop = await getShopByDomain(apiBaseUrl, domain);
    await enforceStorefrontPassword(shop);

    return (
        <Providers storeId={shop?.shopId} currency={shop?.settings?.currency}>
            <div className="checkout-shell min-h-screen flex flex-col bg-gray-100">{children}</div>
        </Providers>
    );
}
