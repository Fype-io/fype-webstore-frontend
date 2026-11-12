import { describe, it, expect } from "vitest";
import { parseEditorAdminOrigins } from "../editor-admin-origins";
import { readWranglerConfig, type EnvConfig } from "./helpers/wrangler-config";

const config = readWranglerConfig();

// A missing EDITOR_ADMIN_ORIGINS makes every verified preview send
// frame-ancestors 'none', so the theme editor shows a blank frame.
describe("wrangler.jsonc EDITOR_ADMIN_ORIGINS", () => {
    const environments: [string, EnvConfig][] = [["production (top level)", config], ...Object.entries(config.env ?? {})];

    it.each(environments)("%s has at least one valid admin origin", (_name, env) => {
        expect(parseEditorAdminOrigins(env.vars?.EDITOR_ADMIN_ORIGINS).length).toBeGreaterThan(0);
    });

    it("production allows the admin under both its old and new name", () => {
        expect(parseEditorAdminOrigins(config.vars?.EDITOR_ADMIN_ORIGINS)).toEqual(
            expect.arrayContaining(["https://ecommerce.fype.io", "https://commerce.fype.io"])
        );
    });

    it("staging allows the admin under both its old and new name", () => {
        expect(parseEditorAdminOrigins(config.env?.staging?.vars?.EDITOR_ADMIN_ORIGINS)).toEqual(
            expect.arrayContaining(["https://test-commerce.fype.io", "https://test-ecommerce.fype.io"])
        );
    });
});
