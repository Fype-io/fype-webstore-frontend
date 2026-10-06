import { getCloudflareContext } from "@opennextjs/cloudflare";

// STOREFRONT_TOKEN_SECRET: the HMAC secret shared with crmApp (same variable
// name there). It signs the password unlock cookie here and verifies the
// theme customizer's preview tokens crmApp issues. A Worker secret in
// staging/production (wrangler secret put), .dev.vars or .env.local locally.
//
// Missing or shorter than 32 characters means null, and everything that needs
// it fails closed: no preview token or unlock cookie is accepted, and the
// unlock route refuses to unlock (see app/api/storefront-unlock).
const MIN_SECRET_LENGTH = 32;

export async function getStorefrontTokenSecret(): Promise<string | null> {
    let secret: string | undefined;
    try {
        const { env } = await getCloudflareContext({ async: true });
        secret = (env as { STOREFRONT_TOKEN_SECRET?: string }).STOREFRONT_TOKEN_SECRET;
    } catch {
        // next dev can run without Worker bindings in some middleware paths
    }
    secret ||= process.env.STOREFRONT_TOKEN_SECRET;
    return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null;
}
