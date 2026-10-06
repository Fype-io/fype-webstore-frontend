// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
    headers: new Map<string, string>(),
    cookies: new Map<string, string>(),
}));

vi.mock("next/headers", () => ({
    headers: async () => ({ get: (name: string) => state.headers.get(name) ?? null }),
    cookies: async () => ({
        get: (name: string) => (state.cookies.has(name) ? { name, value: state.cookies.get(name)! } : undefined),
    }),
}));

vi.mock("next/navigation", () => ({
    redirect: vi.fn((url: string) => {
        throw new Error(`REDIRECT:${url}`);
    }),
}));

vi.mock("@/lib/storefront-token-secret", () => ({
    getStorefrontTokenSecret: vi.fn(),
}));

import { enforceStorefrontPassword } from "../enforce-storefront-password";
import { isVerifiedEditorPreview } from "../editor-preview-server";
import { getStorefrontTokenSecret } from "@/lib/storefront-token-secret";
import { signToken } from "@/lib/signed-token";
import { signUnlockCookie } from "@/lib/storefront-gate";
import type { ShopIdentity } from "@/types/storefront";

const SECRET = "test-storefront-token-secret-0123456789abcdef";
const shop = { shopId: "STORE-1", isPublished: false } as ShopIdentity;
const now = () => Math.floor(Date.now() / 1000);
const previewToken = (claims: Record<string, unknown> = {}) =>
    signToken({ typ: "storefront_preview", sid: "STORE-1", exp: now() + 600, ...claims }, SECRET);

// The layouts' own check - it runs even when the middleware couldn't (tenant
// lookup unavailable), so it must apply the same rules by itself.
describe("enforceStorefrontPassword", () => {
    beforeEach(() => {
        state.headers.clear();
        state.cookies.clear();
        vi.mocked(getStorefrontTokenSecret).mockResolvedValue(SECRET);
    });

    it("does nothing for a published store", async () => {
        await expect(enforceStorefrontPassword({ ...shop, isPublished: true })).resolves.toBeUndefined();
    });

    it("redirects to the password page with nothing to show", async () => {
        await expect(enforceStorefrontPassword(shop)).rejects.toThrow("REDIRECT:/storefront-password");
    });

    it("ignores the old x-editor-preview header", async () => {
        state.headers.set("x-editor-preview", "1");
        await expect(enforceStorefrontPassword(shop)).rejects.toThrow("REDIRECT:/storefront-password");
    });

    it("lets a valid forwarded preview token through", async () => {
        state.headers.set("x-sf-preview-token", await previewToken());
        await expect(enforceStorefrontPassword(shop)).resolves.toBeUndefined();
    });

    it.each([
        ["expired", { exp: now() - 1 }],
        ["for another store", { sid: "STORE-2" }],
        ["of another type", { typ: "storefront_unlock" }],
    ])("redirects for a preview token %s", async (_label, claims) => {
        state.headers.set("x-sf-preview-token", await previewToken(claims));
        await expect(enforceStorefrontPassword(shop)).rejects.toThrow("REDIRECT:/storefront-password");
    });

    it("lets a signed unlock cookie through", async () => {
        state.cookies.set("sf_storefront_unlocked", await signUnlockCookie("STORE-1", SECRET));
        await expect(enforceStorefrontPassword(shop)).resolves.toBeUndefined();
    });

    it("redirects for the old unsigned unlock cookie", async () => {
        state.cookies.set("sf_storefront_unlocked", "STORE-1");
        await expect(enforceStorefrontPassword(shop)).rejects.toThrow("REDIRECT:/storefront-password");
    });

    it("redirects when no secret is configured", async () => {
        state.cookies.set("sf_storefront_unlocked", await signUnlockCookie("STORE-1", SECRET));
        vi.mocked(getStorefrontTokenSecret).mockResolvedValue(null);
        await expect(enforceStorefrontPassword(shop)).rejects.toThrow("REDIRECT:/storefront-password");
    });
});

describe("isVerifiedEditorPreview", () => {
    beforeEach(() => {
        state.headers.clear();
        vi.mocked(getStorefrontTokenSecret).mockResolvedValue(SECRET);
    });

    it("is true only for a valid token for this store", async () => {
        expect(await isVerifiedEditorPreview("STORE-1")).toBe(false);
        state.headers.set("x-sf-preview-token", await previewToken());
        expect(await isVerifiedEditorPreview("STORE-1")).toBe(true);
        expect(await isVerifiedEditorPreview("STORE-2")).toBe(false);
    });
});
