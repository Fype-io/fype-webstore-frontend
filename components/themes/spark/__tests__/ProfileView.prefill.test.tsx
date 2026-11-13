import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ProfileView from "../ProfileView";

const user = { firstName: "Rohit", lastName: "R", email: "rohit@example.com", phone: "+919800000000" };

vi.mock("@/redux/hooks", () => ({
    useAppDispatch: () => vi.fn(),
    useAppSelector: (select: (state: unknown) => unknown) => select({ user: { user, authLoading: false, authError: null } }),
}));
vi.mock("@/redux/slices/userSlice", () => ({ updateProfile: vi.fn(), updateUserProfile: vi.fn() }));

describe("Spark profile form", () => {
    it("is filled in when the shopper is already signed in on arrival", () => {
        render(<ProfileView storeId="S-1" />);
        expect(screen.getByDisplayValue("Rohit R")).toBeInTheDocument();
        expect(screen.getByDisplayValue("rohit@example.com")).toBeInTheDocument();
        expect(screen.getByDisplayValue("+919800000000")).toBeInTheDocument();
    });
});
