import { signToken, verifyToken } from "@/lib/signed-token";

// Signed (see lib/signed-token.ts) - it used to hold the bare shop id, which
// anyone could set by hand to skip the password page. An old unsigned value
// simply fails verification and the visitor enters the password once more.
export const STOREFRONT_UNLOCK_COOKIE = "sf_storefront_unlocked";
const UNLOCK_TOKEN_TYPE = "storefront_unlock";
const UNLOCK_TTL_SECONDS = 7 * 24 * 60 * 60;

// The theme customizer's preview token (minted by crmApp's
// POST /commerce/stores/:storeId/storefront-preview-token, typ/sid/exp claims),
// passed as ?previewToken= on the customizer iframe's URL. The middleware
// also copies a verified one into this cookie where the browser allows it
// (a cross-site iframe cookie: SameSite=None, Partitioned).
export { PREVIEW_TOKEN_PARAM } from "@/lib/editor-preview";
export const EDITOR_PREVIEW_COOKIE = "sf_editor_preview";
const PREVIEW_TOKEN_TYPE = "storefront_preview";

// Request headers only the middleware may set. It deletes whatever a client
// sent under these names before setting its own.
export const PREVIEW_TOKEN_HEADER = "x-sf-preview-token";
export const INTERNAL_REQUEST_HEADERS = [
    "x-shop-id",
    "x-store-domain",
    "x-theme-id",
    "x-editor-preview",
    PREVIEW_TOKEN_HEADER,
] as const;

async function tokenFor(token: string | null | undefined, type: string, shopId: string, secret: string | null) {
    if (!token || !secret) return null;
    const claims = await verifyToken(token, secret);
    if (!claims || claims.typ !== type || claims.sid !== shopId) return null;
    return claims;
}

/** A valid, unexpired preview token for exactly this store. */
export async function isValidPreviewToken(token: string | null | undefined, shopId: string, secret: string | null): Promise<boolean> {
    return (await tokenFor(token, PREVIEW_TOKEN_TYPE, shopId, secret)) !== null;
}

/** Seconds until a valid preview token expires (for the cookie's Max-Age), else null. */
export async function previewTokenTtl(token: string | null | undefined, shopId: string, secret: string | null): Promise<number | null> {
    const claims = await tokenFor(token, PREVIEW_TOKEN_TYPE, shopId, secret);
    return claims ? claims.exp - Math.floor(Date.now() / 1000) : null;
}

export async function isValidUnlockCookie(value: string | null | undefined, shopId: string, secret: string | null): Promise<boolean> {
    return (await tokenFor(value, UNLOCK_TOKEN_TYPE, shopId, secret)) !== null;
}

export function signUnlockCookie(shopId: string, secret: string): Promise<string> {
    return signToken({ typ: UNLOCK_TOKEN_TYPE, sid: shopId, exp: Math.floor(Date.now() / 1000) + UNLOCK_TTL_SECONDS }, secret);
}

/** Whether a request may see this password-protected store: a valid preview token or unlock cookie. */
export async function hasStorefrontAccess(
    { previewToken, unlockCookie }: { previewToken?: string | null; unlockCookie?: string | null },
    shopId: string,
    secret: string | null
): Promise<boolean> {
    return (await isValidPreviewToken(previewToken, shopId, secret)) || (await isValidUnlockCookie(unlockCookie, shopId, secret));
}
