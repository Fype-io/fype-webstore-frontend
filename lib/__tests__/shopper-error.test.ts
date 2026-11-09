import { describe, it, expect, vi } from "vitest";
import { AxiosError, type AxiosResponse } from "axios";

vi.mock("../client-store-context", () => ({ getCurrentStoreId: () => "store-1" }));

import { shopperErrorMessage, TOO_MANY_REQUESTS_MESSAGE } from "../shopper-error";
import { getApiErrorMessage } from "../client-api";

const FALLBACK = "Couldn't load your cart. Please try again.";

describe("shopperErrorMessage", () => {
    it("4xx with our own code: the backend's message (something the shopper can fix)", () => {
        expect(shopperErrorMessage(400, { code: "INSUFFICIENT_STOCK", message: "Only 2 left in stock" }, FALLBACK)).toBe("Only 2 left in stock");
        expect(shopperErrorMessage(400, { code: "OTP_VERIFICATION_FAILED", message: "Invalid OTP. 2 attempts left" }, FALLBACK)).toBe(
            "Invalid OTP. 2 attempts left"
        );
    });

    it("4xx without a code (not one of our messages): the fallback", () => {
        expect(shopperErrorMessage(400, { message: "Unexpected token } in JSON at position 10" }, FALLBACK)).toBe(FALLBACK);
        expect(shopperErrorMessage(404, { message: "Store not found" }, FALLBACK)).toBe(FALLBACK);
    });

    it("5xx: the fallback, even with a code", () => {
        expect(shopperErrorMessage(500, { message: "Cast to ObjectId failed for value \"x\" at path \"_id\"" }, FALLBACK)).toBe(FALLBACK);
        expect(shopperErrorMessage(500, { code: "TRACKING_FAILED", message: "Failed to fetch tracking details" }, FALLBACK)).toBe(FALLBACK);
        expect(shopperErrorMessage(503, { code: "ECONNREFUSED", message: "connect ECONNREFUSED 10.0.0.5:6379" }, FALLBACK)).toBe(FALLBACK);
    });

    it("5xx OTP_SEND_FAILED keeps its message: the login form reads 'try again later' for its cooldown", () => {
        expect(shopperErrorMessage(500, { code: "OTP_SEND_FAILED", message: "Too many attempts. Please try again later." }, FALLBACK)).toBe(
            "Too many attempts. Please try again later."
        );
    });

    it("the backend's INTERNAL_ERROR (a hidden raw error): the screen's own fallback", () => {
        expect(shopperErrorMessage(500, { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." }, FALLBACK)).toBe(FALLBACK);
        expect(shopperErrorMessage(400, { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." }, FALLBACK)).toBe(FALLBACK);
    });

    it("429: our coded message, else a friendly 'too many requests'", () => {
        expect(shopperErrorMessage(429, { code: "RATE_LIMITED", message: "Too many searches. Please wait a minute and try again." }, FALLBACK)).toBe(
            "Too many searches. Please wait a minute and try again."
        );
        expect(shopperErrorMessage(429, { message: "Rate limit exceeded" }, FALLBACK)).toBe(TOO_MANY_REQUESTS_MESSAGE);
    });

    it("no status (network error) or an odd body: the fallback", () => {
        expect(shopperErrorMessage(undefined, undefined, FALLBACK)).toBe(FALLBACK);
        expect(shopperErrorMessage(400, "<html>Bad Gateway</html>", FALLBACK)).toBe(FALLBACK);
        expect(shopperErrorMessage(400, { code: "X", message: "   " }, FALLBACK)).toBe(FALLBACK);
    });
});

describe("getApiErrorMessage", () => {
    const axiosError = (status: number, data: unknown) =>
        new AxiosError("Request failed", "ERR_BAD_RESPONSE", undefined, undefined, { status, data } as AxiosResponse);

    it("uses the rule above for an API error", () => {
        expect(getApiErrorMessage(axiosError(400, { code: "ITEM_NOT_FOUND", message: "Item not found in cart" }), FALLBACK)).toBe("Item not found in cart");
        expect(getApiErrorMessage(axiosError(500, { message: "E11000 duplicate key error" }), FALLBACK)).toBe(FALLBACK);
    });

    it("a network error (no response) or a non-API error: the fallback, never axios's own text", () => {
        expect(getApiErrorMessage(new AxiosError("Network Error", "ERR_NETWORK"), FALLBACK)).toBe(FALLBACK);
        expect(getApiErrorMessage(new Error("Request failed with status code 500"), FALLBACK)).toBe(FALLBACK);
    });
});
