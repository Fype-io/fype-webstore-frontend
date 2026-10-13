import { describe, it, expect, vi } from "vitest";
import { getRequestHost, getRequestOrigin } from "../request-host";

function headersWithHost(host: string | null) {
    return { get: (name: string) => (name === "host" ? host : null) };
}

describe("getRequestHost", () => {
    it.each([
        ["mixed case", "WWW.Shop.Example.COM", "www.shop.example.com"],
        ["port", "www.shop.example.com:443", "www.shop.example.com"],
        ["trailing dot", "www.shop.example.com.", "www.shop.example.com"],
        ["all together", "  WWW.Shop.Example.COM.:8080  ", "www.shop.example.com"],
        ["local dev port", "localhost:3040", "localhost"],
        ["already normal", "mystore.fypestore.com", "mystore.fypestore.com"],
    ])("normalizes %s", (_label, host, expected) => {
        expect(getRequestHost(headersWithHost(host))).toBe(expected);
    });

    it("returns an empty string when there is no Host header", () => {
        expect(getRequestHost(headersWithHost(null))).toBe("");
    });

    it("works with a real Headers instance", () => {
        expect(getRequestHost(new Headers({ host: "Shop.COM:3000" }))).toBe("shop.com");
    });
});

describe("getRequestOrigin", () => {
    it("is http://<host> outside production, keeping the port", () => {
        expect(getRequestOrigin(headersWithHost("localhost:3040"))).toBe("http://localhost:3040");
    });

    it("is https://<host> in production", () => {
        const original = process.env.NODE_ENV;
        vi.stubEnv("NODE_ENV", "production");
        try {
            expect(getRequestOrigin(headersWithHost("www.shop.example.com"))).toBe("https://www.shop.example.com");
        } finally {
            vi.unstubAllEnvs();
            expect(process.env.NODE_ENV).toBe(original);
        }
    });
});
