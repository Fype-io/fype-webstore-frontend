import { NextResponse, type NextRequest } from "next/server";
import { resolveTenant } from "@/lib/tenant";
import {
    EDITOR_PREVIEW_COOKIE,
    INTERNAL_REQUEST_HEADERS,
    PREVIEW_TOKEN_HEADER,
    PREVIEW_TOKEN_PARAM,
    STOREFRONT_UNLOCK_COOKIE,
    hasStorefrontAccess,
    previewTokenTtl,
} from "@/lib/storefront-gate";
import { getEditorAdminOrigins, previewSecurityHeaders } from "@/lib/editor-admin-origins";
import { getStorefrontTokenSecret } from "@/lib/storefront-token-secret";
import { getRequestHost } from "@/lib/request-host";

// Paths that are never password-gated. The theme customizer's iframe gets past
// the gate with a signed preview token (see lib/storefront-gate.ts), not with
// ?editorPreview=1, which anyone could add.
function skipPasswordGate(pathname: string): boolean {
    return (
        pathname.startsWith("/storefront-password") ||
        pathname.startsWith("/api/") ||
        pathname.startsWith("/theme-preview")
    );
}

// Routes that don't belong to a store: the store-independent theme preset
// preview (themes.fypestore.com) and API routes, which return their own errors.
function isStoreIndependentPath(pathname: string): boolean {
    return pathname.startsWith("/theme-preview") || pathname.startsWith("/api/");
}

// Returned directly (no redirect, so no loop) when no store owns the host.
// no-store: a custom domain that goes active must not keep serving this.
function storeNotFoundResponse(): Response {
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Store not found</title>
<style>
body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:0 24px;text-align:center;font-family:system-ui,-apple-system,sans-serif;background:#fafafa;color:#000}
h1{margin:0;font-size:24px}
p{margin:0;max-width:24rem;color:rgba(0,0,0,.6)}
</style>
</head>
<body>
<h1>Store not found</h1>
<p>We couldn't find a store for this domain. Double-check the URL, or contact the store owner if you think this is a mistake.</p>
</body>
</html>`;
    return new Response(html, {
        status: 404,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
}

export async function middleware(request: NextRequest) {
    const domain = getRequestHost(request.headers);

    const lookup = await resolveTenant(domain);

    if (lookup.status === "not_found" && !isStoreIndependentPath(request.nextUrl.pathname)) {
        return storeNotFoundResponse();
    }

    // unavailable (API down, nothing in KV) carries on as before: pages do their own lookup.
    const tenant = lookup.status === "found" ? lookup.tenant : null;

    // Never trust a client-sent copy of the headers set below: the layouts
    // read them as the middleware's word.
    const requestHeaders = new Headers(request.headers);
    for (const name of INTERNAL_REQUEST_HEADERS) requestHeaders.delete(name);
    if (tenant) {
        requestHeaders.set("x-shop-id", tenant.shopId);
        requestHeaders.set("x-store-domain", tenant.storeDomain);
        requestHeaders.set("x-theme-id", tenant.themeId);
    }

    // A preview token from the URL (the customizer iframe) or the cookie. It's
    // forwarded unverified: the layouts verify it against their own shop
    // lookup too (lib/editor-preview-server.ts), which also covers the
    // tenant-unavailable case where this middleware can't.
    const queryPreviewToken = request.nextUrl.searchParams.get(PREVIEW_TOKEN_PARAM);
    const previewToken = queryPreviewToken || request.cookies.get(EDITOR_PREVIEW_COOKIE)?.value;
    if (previewToken) requestHeaders.set(PREVIEW_TOKEN_HEADER, previewToken);

    const secret = tenant && (previewToken || tenant.isPublished === false) ? await getStorefrontTokenSecret() : null;

    if (tenant && tenant.isPublished === false && !skipPasswordGate(request.nextUrl.pathname)) {
        const allowed = await hasStorefrontAccess(
            { previewToken, unlockCookie: request.cookies.get(STOREFRONT_UNLOCK_COOKIE)?.value },
            tenant.shopId,
            secret
        );
        if (!allowed) {
            // Same redirect whatever was wrong with a token: nothing says why.
            const url = request.nextUrl.clone();
            const returnParams = new URLSearchParams(request.nextUrl.search);
            returnParams.delete(PREVIEW_TOKEN_PARAM);
            const returnSearch = returnParams.toString();
            const returnTo = `${request.nextUrl.pathname}${returnSearch ? `?${returnSearch}` : ""}`;
            url.pathname = "/storefront-password";
            url.search = "";
            if (returnTo && returnTo !== "/") {
                url.searchParams.set("return_to", returnTo);
            }
            return NextResponse.redirect(url);
        }
    }

    const response = NextResponse.next({ request: { headers: requestHeaders } });

    // A URL that carries a token never sends it on in a Referer.
    if (queryPreviewToken) response.headers.set("Referrer-Policy", "no-referrer");

    // A verified preview may only be framed by the admin app.
    const previewTtl = tenant && previewToken ? await previewTokenTtl(previewToken, tenant.shopId, secret) : null;
    if (previewTtl !== null && previewTtl > 0) {
        for (const [name, value] of Object.entries(previewSecurityHeaders(await getEditorAdminOrigins()))) {
            response.headers.set(name, value);
        }

        // Keep a verified URL token as a cookie too, for requests that don't
        // carry it (the client strips it from the address once the page has
        // loaded - lib/editor-preview.ts). The customizer iframe is
        // cross-site, so this is a third-party cookie: SameSite=None +
        // Partitioned, and some browsers (Safari) drop it anyway - the admin
        // puts a fresh token on every iframe URL it loads, so nothing depends
        // on it.
        if (queryPreviewToken) {
            response.cookies.set(EDITOR_PREVIEW_COOKIE, queryPreviewToken, {
                httpOnly: true,
                secure: true,
                sameSite: "none",
                partitioned: true,
                path: "/",
                maxAge: previewTtl,
            });
        }
    }

    return response;
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
