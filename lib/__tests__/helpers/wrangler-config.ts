import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type R2BucketConfig = { binding: string; bucket_name: string };
export type EnvConfig = { vars?: Record<string, string>; r2_buckets?: R2BucketConfig[] };
export type WranglerConfig = EnvConfig & { env?: Record<string, EnvConfig> };

// wrangler.jsonc is JSON with comments; strip them without touching "//" inside strings (URLs).
export function parseJsonc(text: string): WranglerConfig {
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

export function readWranglerConfig(): WranglerConfig {
    return parseJsonc(readFileSync(resolve(__dirname, "../../../wrangler.jsonc"), "utf8"));
}
