import { getCloudflareContext } from "@opennextjs/cloudflare";

// EDITOR_ADMIN_ORIGINS: the admin app origin(s) allowed to frame a verified
// preview and exchange editor messages with it, comma-separated - e.g.
// "http://localhost:3000" locally. A Worker var per environment
// (wrangler.jsonc / dashboard), .dev.vars or .env.local locally.
//
// Unset or no valid entry: none. A verified preview then gets
// frame-ancestors 'none' and its editor ignores every message - fail closed.
export function parseEditorAdminOrigins(raw: string | undefined | null): string[] {
    if (!raw) return [];
    const origins = new Set<string>();
    for (const entry of raw.split(",")) {
        const value = entry.trim();
        if (!value) continue;
        try {
            const url = new URL(value);
            if (url.protocol === "https:" || url.protocol === "http:") origins.add(url.origin);
        } catch {
            // not a URL - ignored
        }
    }
    return [...origins];
}

// Missing outside local dev/tests is a misconfiguration that silently breaks
// the customizer (frame-ancestors 'none'), so say so - at most once a minute
// per isolate, since it's checked on every verified preview request.
const MISSING_LOG_INTERVAL_MS = 60_000;
let lastMissingLogAt = -Infinity;

function reportMissing(raw: string | undefined): void {
    const env = process.env.NODE_ENV;
    if (env === "development" || env === "test") return;
    const now = Date.now();
    if (now - lastMissingLogAt < MISSING_LOG_INTERVAL_MS) return;
    lastMissingLogAt = now;
    console.error(
        raw
            ? "[editor-preview] EDITOR_ADMIN_ORIGINS has no valid origin - the theme customizer can't frame or talk to the storefront"
            : "[editor-preview] EDITOR_ADMIN_ORIGINS is not set - the theme customizer can't frame or talk to the storefront"
    );
}

export async function getEditorAdminOrigins(): Promise<string[]> {
    let raw: string | undefined;
    try {
        const { env } = await getCloudflareContext({ async: true });
        raw = (env as { EDITOR_ADMIN_ORIGINS?: string }).EDITOR_ADMIN_ORIGINS;
    } catch {
        // next dev can run without Worker bindings in some middleware paths
    }
    raw ||= process.env.EDITOR_ADMIN_ORIGINS;
    const origins = parseEditorAdminOrigins(raw);
    if (origins.length === 0) reportMissing(raw);
    return origins;
}

/** Test-only: forget the last "missing" log so the next one is printed. */
export function resetMissingOriginsLogForTests(): void {
    lastMissingLogAt = -Infinity;
}

/** The headers every verified preview response carries. */
export function previewSecurityHeaders(adminOrigins: string[]): Record<string, string> {
    return {
        "Content-Security-Policy": `frame-ancestors ${adminOrigins.length > 0 ? adminOrigins.join(" ") : "'none'"}`,
        "Referrer-Policy": "no-referrer",
    };
}
