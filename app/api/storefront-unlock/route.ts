import { NextRequest, NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/api-base-url";
import { STOREFRONT_UNLOCK_COOKIE, signUnlockCookie } from "@/lib/storefront-gate";
import { getStorefrontTokenSecret } from "@/lib/storefront-token-secret";
import { getRequestHost } from "@/lib/request-host";
import { shopperErrorMessage } from "@/lib/shopper-error";

const UNLOCK_UNAVAILABLE = "This store can't be opened right now. Please try again later.";

export async function POST(request: NextRequest) {
    const body = (await request.json().catch(() => null)) as { password?: string; returnTo?: string } | null;
    const password = body?.password;

    if (!password || typeof password !== "string") {
        return NextResponse.json({ success: false, message: "Password is required" }, { status: 400 });
    }

    const domain = getRequestHost(request.headers);

    let apiBaseUrl: string;
    try {
        apiBaseUrl = await getApiBaseUrl();
    } catch {
        return NextResponse.json({ success: false, message: UNLOCK_UNAVAILABLE }, { status: 500 });
    }
    // Without it the cookie couldn't be signed (or verified), so don't even
    // check the password.
    const secret = await getStorefrontTokenSecret();
    if (!secret) {
        return NextResponse.json({ success: false, message: UNLOCK_UNAVAILABLE }, { status: 500 });
    }

    const res = await fetch(`${apiBaseUrl}/commerce/shops/unlock-storefront`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, password }),
    });

    const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
        data?: { shopId?: string };
    } | null;

    if (!res.ok || !json?.data?.shopId) {
        // A wrong password (401) says so; a server fault never shows its own text to the shopper.
        const fallback = res.status >= 500 ? UNLOCK_UNAVAILABLE : "Incorrect password";
        return NextResponse.json(
            { success: false, message: shopperErrorMessage(res.status, json, fallback) },
            { status: res.status === 401 ? 401 : res.status === 404 ? 404 : 400 }
        );
    }

    const response = NextResponse.json({ success: true, shopId: json.data.shopId });
    response.cookies.set(STOREFRONT_UNLOCK_COOKIE, await signUnlockCookie(json.data.shopId, secret), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
    });
    return response;
}
