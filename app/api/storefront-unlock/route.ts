import { NextRequest, NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/api-base-url";
import { STOREFRONT_UNLOCK_COOKIE } from "@/lib/storefront-gate";
import { getRequestHost } from "@/lib/request-host";

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
        return NextResponse.json({ success: false, message: "Storefront is not configured" }, { status: 500 });
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
        return NextResponse.json(
            { success: false, message: json?.message || "Incorrect password" },
            { status: res.status === 401 ? 401 : res.status === 404 ? 404 : 400 }
        );
    }

    const response = NextResponse.json({ success: true, shopId: json.data.shopId });
    response.cookies.set(STOREFRONT_UNLOCK_COOKIE, json.data.shopId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
    });
    return response;
}
