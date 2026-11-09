import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { parseEditorAdminOrigins } from "../editor-admin-origins";

// wrangler.jsonc is JSON with comments; strip them without touching "//" inside strings (URLs).
type EnvConfig = { vars?: Record<string, string> };
type WranglerConfig = EnvConfig & { env?: Record<string, EnvConfig> };

function parseJsonc(text: string): WranglerConfig {
    let out = "";
    let inString = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        const next = text[i + 1];
        if (inString) {
            out += c;
            if (c === "\\") out += text[++i];
            else if (c === '"') inString = false;
        } else if (c === '"') {
            inString = true;
            out += c;
        } else if (c === "/" && next === "/") {
            while (i < text.length && text[i] !== "\n") i++;
            out += "\n";
        } else if (c === "/" && next === "*") {
            i += 2;
            while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
            i++;
        } else {
            out += c;
        }
    }
    return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1")) as WranglerConfig;
}

const config = parseJsonc(readFileSync(resolve(__dirname, "../../wrangler.jsonc"), "utf8"));

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
