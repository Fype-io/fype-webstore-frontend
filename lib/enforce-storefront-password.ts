import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { PREVIEW_TOKEN_HEADER, STOREFRONT_UNLOCK_COOKIE, hasStorefrontAccess } from "@/lib/storefront-gate";
import { getStorefrontTokenSecret } from "@/lib/storefront-token-secret";
import type { ShopIdentity } from "@/types/storefront";

// The layouts' own password check, behind the middleware's (which skips it
// when the tenant lookup is unavailable). Same rule: a valid preview token
// or a valid signed unlock cookie for this store, else the password page.
export async function enforceStorefrontPassword(shop: ShopIdentity | null): Promise<void> {
    if (!shop || shop.isPublished !== false) return;

    const previewToken = (await headers()).get(PREVIEW_TOKEN_HEADER);
    const unlockCookie = (await cookies()).get(STOREFRONT_UNLOCK_COOKIE)?.value;
    if (await hasStorefrontAccess({ previewToken, unlockCookie }, shop.shopId, await getStorefrontTokenSecret())) return;

    redirect("/storefront-password");
}
