// @vitest-environment node
import { describe, it, expect } from "vitest";
import { signToken, verifyToken } from "../signed-token";

const SECRET = "test-storefront-token-secret-0123456789abcdef";

// Minted by crmApp's own jsonwebtoken (HS256) with SECRET - proves the
// storefront verifies exactly what the backend signs. Test-only secret.
const JSONWEBTOKEN_VALID =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXAiOiJzdG9yZWZyb250X3ByZXZpZXciLCJzaWQiOiJTVE9SRS0xIiwiZXhwIjo0MTAyNDQ0ODAwLCJpYXQiOjE3NjcyMjU2MDAsInN1YiI6InVzZXItdXVpZC0xIn0.oZX-9Hk-uwUVVCzlpn5wJKm2oVZFAe8pCVQ7VRyxqc8";
// Same, but exp 2026-01-01.
const JSONWEBTOKEN_EXPIRED =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXAiOiJzdG9yZWZyb250X3ByZXZpZXciLCJzaWQiOiJTVE9SRS0xIiwiZXhwIjoxNzY3MjI1NjAwLCJpYXQiOjE3NjcyMjUwMDAsInN1YiI6InVzZXItdXVpZC0xIn0.uIheWK2fchJ-dfyNDgm59Y1f09UXnSvXbhlajNIA3MM";

const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const now = () => Math.floor(Date.now() / 1000);

describe("signed-token", () => {
    it("verifies a token signed by jsonwebtoken (crmApp)", async () => {
        const claims = await verifyToken(JSONWEBTOKEN_VALID, SECRET);
        expect(claims).toMatchObject({ typ: "storefront_preview", sid: "STORE-1", sub: "user-uuid-1" });
    });

    it("rejects an expired jsonwebtoken token", async () => {
        expect(await verifyToken(JSONWEBTOKEN_EXPIRED, SECRET)).toBeNull();
    });

    it("round-trips its own tokens", async () => {
        const token = await signToken({ typ: "x", sid: "S", exp: now() + 60 }, SECRET);
        expect(await verifyToken(token, SECRET)).toMatchObject({ typ: "x", sid: "S" });
    });

    it("rejects the wrong secret", async () => {
        expect(await verifyToken(JSONWEBTOKEN_VALID, "another-secret-0123456789abcdef-xyz")).toBeNull();
    });

    it("rejects a tampered payload (signature no longer matches)", async () => {
        const [header, , signature] = JSONWEBTOKEN_VALID.split(".");
        const forged = `${header}.${b64url({ typ: "storefront_preview", sid: "STORE-2", exp: 4102444800 })}.${signature}`;
        expect(await verifyToken(forged, SECRET)).toBeNull();
    });

    it("rejects a tampered signature", async () => {
        // The first character, not the last: the last one's low bits are
        // base64 padding, so changing it can decode to the same bytes.
        const [header, payload, signature] = JSONWEBTOKEN_VALID.split(".") as [string, string, string];
        const tampered = `${header}.${payload}.${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
        expect(await verifyToken(tampered, SECRET)).toBeNull();
    });

    it('rejects alg "none" and any algorithm other than HS256', async () => {
        const payload = b64url({ typ: "storefront_preview", sid: "STORE-1", exp: now() + 60 });
        expect(await verifyToken(`${b64url({ alg: "none", typ: "JWT" })}.${payload}.`, SECRET)).toBeNull();
        const [, , signature] = (await signToken({ exp: now() + 60 }, SECRET)).split(".");
        expect(await verifyToken(`${b64url({ alg: "HS512", typ: "JWT" })}.${payload}.${signature}`, SECRET)).toBeNull();
    });

    it("rejects a token without a numeric exp", async () => {
        const token = await signToken({ exp: "never" as unknown as number }, SECRET);
        expect(await verifyToken(token, SECRET)).toBeNull();
    });

    it.each(["", "abc", "a.b", "a.b.c.d", "!!.!!.!!", "e30.e30.@@"])("rejects malformed input %j", async (input) => {
        expect(await verifyToken(input, SECRET)).toBeNull();
    });
});
