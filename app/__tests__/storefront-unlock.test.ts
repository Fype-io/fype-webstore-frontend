// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-base-url", () => ({ getApiBaseUrl: vi.fn().mockResolvedValue("https://api.test/api/v1") }));
vi.mock("@/lib/storefront-token-secret", () => ({ getStorefrontTokenSecret: vi.fn() }));

import { POST } from "../api/storefront-unlock/route";
import { getStorefrontTokenSecret } from "@/lib/storefront-token-secret";
import { isValidUnlockCookie } from "@/lib/storefront-gate";

const SECRET = "test-storefront-token-secret-0123456789abcdef";

const unlockRequest = (password = "letmein") =>
    new NextRequest("https://mystore.fypestore.com/api/storefront-unlock", {
        method: "POST",
        headers: { host: "mystore.fypestore.com", "content-type": "application/json" },
        body: JSON.stringify({ password }),
    });

describe("POST /api/storefront-unlock", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        vi.mocked(getStorefrontTokenSecret).mockResolvedValue(SECRET);
        fetchMock.mockReset();
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("sets a signed unlock cookie, not the bare shop id", async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, data: { shopId: "STORE-1" } }), { status: 200 }));

        const res = await POST(unlockRequest());

        expect(res.status).toBe(200);
        const value = res.cookies.get("sf_storefront_unlocked")?.value;
        expect(value).toBeDefined();
        expect(value).not.toBe("STORE-1");
        expect(await isValidUnlockCookie(value, "STORE-1", SECRET)).toBe(true);
        expect(await isValidUnlockCookie(value, "STORE-2", SECRET)).toBe(false);
    });

    it("sets no cookie for a wrong password", async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: false, message: "Incorrect password" }), { status: 401 }));

        const res = await POST(unlockRequest());

        expect(res.status).toBe(401);
        expect(res.cookies.get("sf_storefront_unlocked")).toBeUndefined();
    });

    it("refuses without a secret, before checking the password", async () => {
        vi.mocked(getStorefrontTokenSecret).mockResolvedValue(null);

        const res = await POST(unlockRequest());

        expect(res.status).toBe(500);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(res.cookies.get("sf_storefront_unlocked")).toBeUndefined();
    });
});
