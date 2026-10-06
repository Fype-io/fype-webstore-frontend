import { describe, it, expect } from "vitest";
import { AxiosError, type AxiosResponse } from "axios";
import { orderErrorMessage } from "../checkout-errors";

const apiError = (data: { code?: string; message?: string }) =>
    new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, { status: 400, data } as AxiosResponse);

describe("orderErrorMessage", () => {
    it("COD refused because the store has no logistics app: says to refresh, not a bare error", () => {
        const message = orderErrorMessage(
            apiError({ code: "COD_REQUIRES_LOGISTICS", message: "Cash on delivery isn't available for this store." }),
            "Failed to create order"
        );
        expect(message).toBe(
            "Cash on delivery isn't available for this store. This store's payment options have changed. Please refresh the page to see how you can pay."
        );
    });

    it('"Order now" refused (the store now offers a way to pay): says to refresh', () => {
        expect(orderErrorMessage(apiError({ code: "ORDER_NOW_NOT_AVAILABLE", message: "Choose a payment method to place this order." }), "x")).toBe(
            "This store's payment options have changed. Please refresh the page to see how you can pay."
        );
    });

    it("keeps the backend message for other codes (the COD minimum carries the amount)", () => {
        expect(orderErrorMessage(apiError({ code: "COD_MIN_ORDER_NOT_MET", message: "Cash on delivery is available for orders of ₹500 or more." }), "x")).toBe(
            "Cash on delivery is available for orders of ₹500 or more."
        );
        expect(orderErrorMessage(apiError({}), "Failed to create order")).toBe("Failed to create order");
        expect(orderErrorMessage(new Error("network"), "Failed to create order")).toBe("Failed to create order");
    });
});
