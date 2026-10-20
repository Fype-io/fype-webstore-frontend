import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DeliveryAddressCard from "../DeliveryAddressCard";
import { ADDRESS_REQUIRED_MESSAGE } from "../checkoutUtils";
import type { Address } from "@/redux/slices/userSlice";

const ADDRESS = {
    _id: "a1",
    addressId: "addr1",
    firstName: "Test",
    lastName: "User",
    phoneNumber: "9999999999",
    addressLine1: "123 Main St",
    city: "Mumbai",
    state: "MH",
    country: "IN",
    postalCode: "400001",
    isDefault: true,
} as unknown as Address;

const renderCard = (props: Partial<React.ComponentProps<typeof DeliveryAddressCard>>) =>
    render(<DeliveryAddressCard addresses={[]} selected={null} onChange={vi.fn()} onAdd={vi.fn()} {...props} />);

describe("DeliveryAddressCard - missing address validation", () => {
    it("shows a compact add button and no error until the shopper tries to order", () => {
        renderCard({});

        expect(screen.getByRole("button", { name: "+ Add delivery address" })).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows the error when there is no address", () => {
        renderCard({ error: ADDRESS_REQUIRED_MESSAGE });

        expect(screen.getByRole("alert")).toHaveTextContent(ADDRESS_REQUIRED_MESSAGE);
    });

    it("hides the error as soon as an address is selected", () => {
        renderCard({ addresses: [ADDRESS], selected: ADDRESS, error: ADDRESS_REQUIRED_MESSAGE });

        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.getByText(/123 Main St/)).toBeInTheDocument();
    });
});

describe("DeliveryAddressCard - not serviceable", () => {
    it("names the pincode for an address that has one", () => {
        renderCard({ addresses: [ADDRESS], selected: ADDRESS, notServiceable: true });
        expect(screen.getByText(/This pincode is not serviceable/)).toBeInTheDocument();
    });

    it("talks about the area for a UAE address, which has no pincode", () => {
        const uae = { ...ADDRESS, city: "Al Barsha", state: "Dubai", country: "AE", postalCode: "" } as unknown as Address;
        renderCard({ addresses: [uae], selected: uae, notServiceable: true });
        expect(screen.getByText(/We don't deliver to this area yet/)).toBeInTheDocument();
        expect(screen.queryByText(/pincode/i)).not.toBeInTheDocument();
    });
});
