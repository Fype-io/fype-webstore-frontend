import { Suspense } from "react";
import { headers } from "next/headers";
import { getApiBaseUrl, getShopByDomain } from "@/lib/storefront-api";
import StorefrontPasswordForm from "./StorefrontPasswordForm";
import "../(checkout)/checkout.css";
import { getRequestHost } from "@/lib/request-host";

export default async function StorefrontPasswordPage() {
    const headersList = await headers();
    const domain = getRequestHost(headersList);
    const apiBaseUrl = await getApiBaseUrl();
    const shop = await getShopByDomain(apiBaseUrl, domain);

    return (
        <div className="checkout-shell min-h-screen flex items-center justify-center bg-gray-100 p-6">
            <Suspense fallback={<div className="text-sm text-gray-500">Loading…</div>}>
                <StorefrontPasswordForm shopName={shop?.shopName} />
            </Suspense>
        </div>
    );
}
