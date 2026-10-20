import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AddAddressPanel from "../AddAddressPanel";
import type { Address } from "@/redux/slices/userSlice";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

// The address form's starting country: a Jeebly (UAE) store passes
// defaultCountry "AE", so a new address starts as a UAE one (optional postal
// code, +971 phone); an address being edited keeps its own country.

const renderPanel = (props: Partial<React.ComponentProps<typeof AddAddressPanel>> = {}) =>
    render(<AddAddressPanel onBack={vi.fn()} onSave={vi.fn()} {...props} />);

const INDIAN_ADDRESS = {
    addressId: "addr1",
    firstName: "Test",
    lastName: "User",
    phoneNumber: "+919999999999",
    addressLine1: "123 Main St",
    addressLine2: "Andheri",
    city: "Mumbai",
    state: "Maharashtra",
    country: "IN",
    postalCode: "400001",
    isDefault: true,
} as unknown as Address;

describe("AddAddressPanel - starting country", () => {
    it("starts a new address in the UAE when the store says so: postal code optional, +971 phone", () => {
        renderPanel({ defaultCountry: "AE" });
        expect(screen.getByPlaceholderText("Postal code (optional)")).toBeInTheDocument();
        // The phone's country code is an input's value.
        expect(screen.getByDisplayValue("+971")).toBeInTheDocument();
    });

    it("leaves a new address without a country otherwise, asking for a pincode", () => {
        renderPanel();
        expect(screen.getByPlaceholderText("Pincode")).toBeInTheDocument();
        expect(screen.queryByDisplayValue("+971")).not.toBeInTheDocument();
    });

    it("keeps an edited address's own country, even in a UAE store", () => {
        renderPanel({ defaultCountry: "AE", initial: INDIAN_ADDRESS });
        expect(screen.getByPlaceholderText("Pincode")).toBeInTheDocument();
        expect(screen.getByDisplayValue("400001")).toBeInTheDocument();
    });
});
