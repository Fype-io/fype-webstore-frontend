import { headers } from "next/headers";
import { PREVIEW_TOKEN_HEADER, isValidPreviewToken } from "@/lib/storefront-gate";
import { getStorefrontTokenSecret } from "@/lib/storefront-token-secret";

// Server side: is this request the theme customizer's verified preview of
// this store? True only for a valid preview token (forwarded by the
// middleware from ?previewToken= or its cookie) for exactly shopId.
// ?editorPreview=1 on its own means nothing any more.
export async function isVerifiedEditorPreview(shopId: string): Promise<boolean> {
    const token = (await headers()).get(PREVIEW_TOKEN_HEADER);
    if (!token) return false;
    return isValidPreviewToken(token, shopId, await getStorefrontTokenSecret());
}
