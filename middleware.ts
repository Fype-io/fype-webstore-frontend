import { NextResponse, type NextRequest } from "next/server";
import { resolveTenant } from "@/lib/tenant";
import { STOREFRONT_UNLOCK_COOKIE } from "@/lib/storefront-gate";
import { getRequestHost } from "@/lib/request-host";

function skipPasswordGate(request: NextRequest): boolean {
    const pathname = request.nextUrl.pathname;
    if (
        pathname.startsWith("/storefront-password") ||
        pathname.startsWith("/api/") ||
        pathname.startsWith("/theme-preview")
    ) {
        return true;
    }
    // Theme customizer iframe always loads with this flag — never prompt there.
    return request.nextUrl.searchParams.get("editorPreview") === "1";
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

    const requestHeaders = new Headers(request.headers);
    if (tenant) {
        requestHeaders.set("x-shop-id", tenant.shopId);
        requestHeaders.set("x-store-domain", tenant.storeDomain);
        requestHeaders.set("x-theme-id", tenant.themeId);
    }
    if (request.nextUrl.searchParams.get("editorPreview") === "1") {
        requestHeaders.set("x-editor-preview", "1");
    }

    if (tenant && tenant.isPublished === false && !skipPasswordGate(request)) {
        const unlocked = request.cookies.get(STOREFRONT_UNLOCK_COOKIE)?.value === tenant.shopId;
        if (!unlocked) {
            const url = request.nextUrl.clone();
            const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
            url.pathname = "/storefront-password";
            url.search = "";
            if (returnTo && returnTo !== "/") {
                url.searchParams.set("return_to", returnTo);
            }
            return NextResponse.redirect(url);
        }
    }

    return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
