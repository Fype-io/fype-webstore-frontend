// Minimal HS256 JWTs over Web Crypto (no Node crypto: this runs in the
// Cloudflare Worker, middleware included). Interoperable with jsonwebtoken's
// HS256 tokens, which is how crmApp signs storefront preview tokens.
//
// Only what the storefront needs: a fixed algorithm (alg must be exactly
// HS256 - "none" or anything else is rejected), a required numeric exp, and
// a constant-time signature check (crypto.subtle.verify).

export type TokenClaims = Record<string, unknown> & { exp: number };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlEncode(bytes: Uint8Array): string {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(segment: string): Uint8Array<ArrayBuffer> | null {
    if (!/^[A-Za-z0-9_-]*$/.test(segment)) return null;
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(segment.length / 4) * 4, "=");
    try {
        const binary = atob(base64);
        const bytes = new Uint8Array(new ArrayBuffer(binary.length));
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    } catch {
        return null;
    }
}

function decodeJson(segment: string): unknown {
    const bytes = base64UrlDecode(segment);
    if (!bytes) return null;
    try {
        return JSON.parse(decoder.decode(bytes));
    } catch {
        return null;
    }
}

function hmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
    return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

export async function signToken(claims: TokenClaims, secret: string): Promise<string> {
    const header = base64UrlEncode(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
    const payload = base64UrlEncode(encoder.encode(JSON.stringify(claims)));
    const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret, "sign"), encoder.encode(`${header}.${payload}`));
    return `${header}.${payload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/** The claims of a well-formed, correctly signed, unexpired HS256 token; otherwise null. */
export async function verifyToken(token: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): Promise<TokenClaims | null> {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerSegment, payloadSegment, signatureSegment] = parts as [string, string, string];

    const header = decodeJson(headerSegment) as { alg?: unknown } | null;
    if (!header || header.alg !== "HS256") return null;

    const signature = base64UrlDecode(signatureSegment);
    if (!signature || signature.length === 0) return null;

    let valid: boolean;
    try {
        valid = await crypto.subtle.verify(
            "HMAC",
            await hmacKey(secret, "verify"),
            signature,
            encoder.encode(`${headerSegment}.${payloadSegment}`)
        );
    } catch {
        return null;
    }
    if (!valid) return null;

    const claims = decodeJson(payloadSegment) as Record<string, unknown> | null;
    if (!claims || typeof claims !== "object" || Array.isArray(claims)) return null;
    if (typeof claims.exp !== "number" || claims.exp <= nowSeconds) return null;
    return claims as TokenClaims;
}
