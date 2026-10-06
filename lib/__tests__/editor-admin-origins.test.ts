import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    getEditorAdminOrigins,
    parseEditorAdminOrigins,
    previewSecurityHeaders,
    resetMissingOriginsLogForTests,
} from "../editor-admin-origins";

describe("parseEditorAdminOrigins", () => {
    it("keeps origins only: no paths, no duplicates, no junk or other schemes", () => {
        expect(
            parseEditorAdminOrigins(" http://localhost:3000/ ,https://admin.example.com/x?y, https://admin.example.com, ftp://x.example, nope,, ")
        ).toEqual(["http://localhost:3000", "https://admin.example.com"]);
    });

    it("is empty when unset", () => {
        expect(parseEditorAdminOrigins(undefined)).toEqual([]);
        expect(parseEditorAdminOrigins("")).toEqual([]);
    });
});

describe("previewSecurityHeaders", () => {
    it("limits framing to the admin origins and turns the Referer off", () => {
        expect(previewSecurityHeaders(["http://localhost:3000"])).toEqual({
            "Content-Security-Policy": "frame-ancestors http://localhost:3000",
            "Referrer-Policy": "no-referrer",
        });
    });

    it("allows no framing with no origins", () => {
        expect(previewSecurityHeaders([])["Content-Security-Policy"]).toBe("frame-ancestors 'none'");
    });
});

describe("getEditorAdminOrigins: a missing value is loud outside local dev", () => {
    let error: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        resetMissingOriginsLogForTests();
        error = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        error.mockRestore();
    });

    it("logs an error when unset in production (staging and production both build with NODE_ENV=production)", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("EDITOR_ADMIN_ORIGINS", "");
        expect(await getEditorAdminOrigins()).toEqual([]);
        expect(error).toHaveBeenCalledWith(expect.stringContaining("EDITOR_ADMIN_ORIGINS is not set"));
    });

    it("logs an error when set but with no valid origin", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("EDITOR_ADMIN_ORIGINS", "not a url");
        await getEditorAdminOrigins();
        expect(error).toHaveBeenCalledWith(expect.stringContaining("has no valid origin"));
    });

    it("logs at most once a minute", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("EDITOR_ADMIN_ORIGINS", "");
        await getEditorAdminOrigins();
        await getEditorAdminOrigins();
        expect(error).toHaveBeenCalledTimes(1);
    });

    it.each(["development", "test"])("stays quiet in %s", async (nodeEnv) => {
        vi.stubEnv("NODE_ENV", nodeEnv);
        vi.stubEnv("EDITOR_ADMIN_ORIGINS", "");
        await getEditorAdminOrigins();
        expect(error).not.toHaveBeenCalled();
    });

    it("stays quiet when configured", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("EDITOR_ADMIN_ORIGINS", "https://admin.example.com");
        expect(await getEditorAdminOrigins()).toEqual(["https://admin.example.com"]);
        expect(error).not.toHaveBeenCalled();
    });
});
