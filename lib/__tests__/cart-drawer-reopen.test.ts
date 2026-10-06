import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { consumeCartDrawerReopen, requestCartDrawerReopen } from "../cart-drawer-reopen";

describe("cart drawer reopen flag", () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("is false when nothing was requested", () => {
        expect(consumeCartDrawerReopen()).toBe(false);
    });

    it("is true once after a request, then false", () => {
        requestCartDrawerReopen();
        expect(consumeCartDrawerReopen()).toBe(true);
        expect(consumeCartDrawerReopen()).toBe(false);
    });

    it("expires after 10 seconds and is cleared anyway", () => {
        vi.useFakeTimers();
        requestCartDrawerReopen();
        vi.advanceTimersByTime(10_000);
        expect(consumeCartDrawerReopen()).toBe(false);
        expect(sessionStorage.length).toBe(0);
    });

    it("never throws when storage is blocked", () => {
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        expect(() => requestCartDrawerReopen()).not.toThrow();
        expect(consumeCartDrawerReopen()).toBe(false);
    });
});
