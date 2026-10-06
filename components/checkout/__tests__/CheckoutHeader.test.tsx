import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CheckoutHeader from "../CheckoutHeader";
import { consumeCartDrawerReopen } from "@/lib/cart-drawer-reopen";

const { mockBack, mockPush } = vi.hoisted(() => ({ mockBack: vi.fn(), mockPush: vi.fn() }));
vi.mock("next/navigation", () => ({
    useRouter: () => ({ back: mockBack, push: mockPush }),
}));

describe("CheckoutHeader", () => {
    beforeEach(() => {
        sessionStorage.clear();
        mockBack.mockClear();
        mockPush.mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("goes back to the previous page and asks for the cart drawer to reopen", async () => {
        vi.spyOn(window.history, "length", "get").mockReturnValue(3);
        render(<CheckoutHeader title="Checkout" />);

        await userEvent.click(screen.getByRole("button", { name: "Back to cart" }));

        expect(mockBack).toHaveBeenCalledTimes(1);
        expect(mockPush).not.toHaveBeenCalled();
        expect(consumeCartDrawerReopen()).toBe(true);
    });

    it("goes to the home page when checkout was opened directly (no history)", async () => {
        vi.spyOn(window.history, "length", "get").mockReturnValue(1);
        render(<CheckoutHeader title="Checkout" />);

        await userEvent.click(screen.getByRole("button", { name: "Back to cart" }));

        expect(mockPush).toHaveBeenCalledWith("/");
        expect(mockBack).not.toHaveBeenCalled();
        expect(consumeCartDrawerReopen()).toBe(true);
    });

    it("never links to the removed /cart page", () => {
        render(<CheckoutHeader title="Checkout" />);
        expect(document.querySelector('a[href="/cart"]')).toBeNull();
    });

    it("uses onBack when given, without touching history or the drawer", async () => {
        const onBack = vi.fn();
        render(<CheckoutHeader title="Select Address" onBack={onBack} />);

        await userEvent.click(screen.getByRole("button", { name: "Back" }));

        expect(onBack).toHaveBeenCalledTimes(1);
        expect(mockBack).not.toHaveBeenCalled();
        expect(mockPush).not.toHaveBeenCalled();
        expect(consumeCartDrawerReopen()).toBe(false);
    });
});
