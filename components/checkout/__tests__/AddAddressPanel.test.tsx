import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddAddressPanel, { toStateIso } from "../AddAddressPanel";
import { reverseGeocode } from "@/lib/reverseGeocode";
import type { Address } from "@/redux/slices/userSlice";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));
vi.mock("@/lib/reverseGeocode", () => ({ reverseGeocode: vi.fn() }));

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

describe("AddAddressPanel - UAE layout (Emirate list, area as Area)", () => {
    it("labels the emirate list Emirate and the city field Area, with UAE hints for line 1 and 2", () => {
        renderPanel({ defaultCountry: "AE" });
        expect(screen.getByPlaceholderText("Emirate")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("Area")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("Flat or villa no., building name")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("Street and a landmark")).toBeInTheDocument();
        expect(screen.queryByPlaceholderText("State")).not.toBeInTheDocument();
    });

    it("shows a field's example only while it's focused", async () => {
        const user = userEvent.setup();
        renderPanel({ defaultCountry: "AE" });
        expect(screen.queryByText(/e\.g\. Al Barsha, JLT, Ruwais/)).not.toBeInTheDocument();
        await user.click(screen.getByPlaceholderText("Area"));
        expect(screen.getByText("Your area or community, e.g. Al Barsha, JLT, Ruwais")).toBeInTheDocument();
        await user.click(screen.getByPlaceholderText("Flat or villa no., building name"));
        expect(screen.getByText("e.g. Flat 1204, Marina Tower")).toBeInTheDocument();
        expect(screen.queryByText(/Al Barsha, JLT/)).not.toBeInTheDocument();
    });

    it('lists the 7 emirates without "Emirate"', async () => {
        const user = userEvent.setup();
        renderPanel({ defaultCountry: "AE" });
        await user.click(screen.getByPlaceholderText("Emirate"));
        for (const emirate of ["Abu Dhabi", "Ajman", "Dubai", "Fujairah", "Ras al-Khaimah", "Sharjah", "Umm al-Quwain"]) {
            expect(screen.getByText(emirate)).toBeInTheDocument();
        }
        expect(screen.queryByText("Abu Dhabi Emirate")).not.toBeInTheDocument();
    });

    it("keeps other countries as they were", () => {
        renderPanel({ initial: INDIAN_ADDRESS });
        expect(screen.getByPlaceholderText("State")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("House/ Flat/ Office No.")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("Area / Street / Locality")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Mumbai")).toBeInTheDocument();
    });
});

describe("AddAddressPanel - Use current location", () => {
    beforeEach(() => {
        Object.defineProperty(navigator, "geolocation", {
            configurable: true,
            value: { getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { latitude: 25.1132, longitude: 55.2004 } }) },
        });
    });

    it("UAE: the area goes in Area, the emirate is picked, line 2 stays for the street", async () => {
        const user = userEvent.setup();
        vi.mocked(reverseGeocode).mockResolvedValue({
            country: "AE", state: "Dubai", city: "Dubai", pincode: "", area: "Al Barsha", house: "", latitude: 25.1132, longitude: 55.2004,
        });
        renderPanel({ defaultCountry: "AE" });

        await user.click(screen.getByRole("button", { name: /use current location/i }));

        await waitFor(() => expect(screen.getByPlaceholderText("Area")).toHaveValue("Al Barsha"));
        expect(screen.getByPlaceholderText("Emirate")).toHaveValue("Dubai");
        expect(screen.getByPlaceholderText("Street and a landmark")).toHaveValue("");
    });

    it("UAE: a geocoder's \"Abu Dhabi\" picks the Abu Dhabi emirate", async () => {
        const user = userEvent.setup();
        vi.mocked(reverseGeocode).mockResolvedValue({
            country: "AE", state: "Abu Dhabi", city: "Ruwais", pincode: "", area: "", house: "", latitude: 24.11, longitude: 52.73,
        });
        renderPanel({ defaultCountry: "AE" });

        await user.click(screen.getByRole("button", { name: /use current location/i }));

        await waitFor(() => expect(screen.getByPlaceholderText("Emirate")).toHaveValue("Abu Dhabi"));
        expect(screen.getByPlaceholderText("Area")).toHaveValue("Ruwais");
    });

    it("other countries: city in City and the area in line 2, as before", async () => {
        const user = userEvent.setup();
        vi.mocked(reverseGeocode).mockResolvedValue({
            country: "IN", state: "Maharashtra", city: "Mumbai", pincode: "400053", area: "Andheri", house: "", latitude: 19.1, longitude: 72.8,
        });
        renderPanel();

        await user.click(screen.getByRole("button", { name: /use current location/i }));

        await waitFor(() => expect(screen.getByPlaceholderText("City")).toHaveValue("Mumbai"));
        expect(screen.getByPlaceholderText("Area / Street / Locality")).toHaveValue("Andheri");
    });
});

describe("toStateIso", () => {
    it.each([
        ["Abu Dhabi Emirate", "AZ"],
        ["Abu Dhabi", "AZ"],
        ["Ras Al Khaimah", "RK"],
        ["Sharjah", "SH"],
        ["DU", "DU"],
        ["Nowhere", ""],
    ])("%p -> %p", (name, iso) => {
        expect(toStateIso("AE", name)).toBe(iso);
    });
});
