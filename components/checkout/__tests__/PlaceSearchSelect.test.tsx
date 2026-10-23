import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlaceSearchSelect } from "../ui/PlaceSearchSelect";
import { suggestPlaces } from "@/lib/placeSuggest";

vi.mock("@/lib/placeSuggest", () => ({ suggestPlaces: vi.fn() }));

// The address form's City (or, for the UAE, Area) field: Google's suggestions
// from the backend, list only while they're on; free text when they're off or fail.

const KOCHI = { name: "Kochi", secondary: "Kerala, India", placeId: "p-kochi" };
const KOLLAM = { name: "Kollam", secondary: "Kerala, India", placeId: "p-kollam" };

/** The field with its value kept in state, as the form does; the value is shown below it. */
function Harness({ initial = "", onChange = vi.fn() }: { initial?: string; onChange?: (v: string) => void }) {
    const [value, setValue] = useState(initial);
    return (
        <>
            <PlaceSearchSelect
                kind="city"
                country="IN"
                state="KL"
                value={value}
                onChange={(v) => {
                    setValue(v);
                    onChange(v);
                }}
                placeholder="City"
            />
            <output data-testid="committed">{value}</output>
            <button type="button">elsewhere</button>
        </>
    );
}

const listOn = (suggestions = [KOCHI, KOLLAM]) =>
    vi.mocked(suggestPlaces).mockImplementation(async (q) => ({ available: true, suggestions: q.q ? suggestions : [] }));

beforeEach(() => {
    vi.mocked(suggestPlaces).mockReset();
});

describe("PlaceSearchSelect - suggestions on (list only)", () => {
    it("asks once whether suggestions are on, without a query", async () => {
        listOn();
        render(<Harness />);
        await waitFor(() => expect(suggestPlaces).toHaveBeenCalledWith({ kind: "city", country: "IN" }));
    });

    it("searches the state's cities as the shopper types, and keeps the picked one", async () => {
        const user = userEvent.setup();
        listOn();
        render(<Harness />);
        await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());

        await user.type(screen.getByPlaceholderText("City"), "ko");

        expect(await screen.findByText("Kollam")).toBeInTheDocument();
        expect(suggestPlaces).toHaveBeenLastCalledWith({ kind: "city", country: "IN", state: "KL", city: undefined, q: "ko" });
        expect(screen.getAllByText("Kerala, India")).toHaveLength(2);

        await user.click(screen.getByText("Kollam"));

        expect(screen.getByTestId("committed")).toHaveTextContent("Kollam");
        expect(screen.getByPlaceholderText("City")).toHaveValue("Kollam");
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("text typed but not picked is not kept: the field goes back to the last value", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        listOn();
        render(<Harness initial="Kochi" onChange={onChange} />);
        await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());

        await user.clear(screen.getByPlaceholderText("City"));
        await user.type(screen.getByPlaceholderText("City"), "Kochii");
        await user.click(screen.getByRole("button", { name: "elsewhere" }));

        expect(screen.getByPlaceholderText("City")).toHaveValue("Kochi");
        expect(screen.getByTestId("committed")).toHaveTextContent("Kochi");
        expect(onChange).not.toHaveBeenCalled();
    });

    it("says so when nothing matches", async () => {
        const user = userEvent.setup();
        listOn([]);
        render(<Harness />);
        await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());

        await user.type(screen.getByPlaceholderText("City"), "zzq");

        expect(await screen.findByText(/no cities found/i)).toBeInTheDocument();
    });

    it("doesn't search under 2 characters", async () => {
        const user = userEvent.setup();
        listOn();
        render(<Harness />);
        await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());

        await user.type(screen.getByPlaceholderText("City"), "k");
        await new Promise((r) => setTimeout(r, 400));

        expect(suggestPlaces).toHaveBeenCalledTimes(1); // only the probe
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("falls back to free text when a search fails, keeping what was typed", async () => {
        const user = userEvent.setup();
        vi.mocked(suggestPlaces)
            .mockResolvedValueOnce({ available: true, suggestions: [] })
            .mockRejectedValue(new Error("Request failed with status code 500"));
        render(<Harness />);
        await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());

        await user.type(screen.getByPlaceholderText("City"), "Kochi");

        await waitFor(() => expect(screen.getByTestId("committed")).toHaveTextContent("Kochi"));
        expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });
});

describe("PlaceSearchSelect - suggestions off (free text)", () => {
    it("keeps whatever is typed when the server has no key", async () => {
        const user = userEvent.setup();
        vi.mocked(suggestPlaces).mockResolvedValue({ available: false, suggestions: [] });
        render(<Harness />);
        await waitFor(() => expect(suggestPlaces).toHaveBeenCalled());

        await user.type(screen.getByPlaceholderText("City"), "Kochi");
        await user.click(screen.getByRole("button", { name: "elsewhere" }));

        expect(screen.getByTestId("committed")).toHaveTextContent("Kochi");
        expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
        expect(suggestPlaces).toHaveBeenCalledTimes(1);
    });

    it("free text when the probe itself fails", async () => {
        const user = userEvent.setup();
        vi.mocked(suggestPlaces).mockRejectedValue(new Error("Network Error"));
        render(<Harness />);
        await waitFor(() => expect(suggestPlaces).toHaveBeenCalled());

        await user.type(screen.getByPlaceholderText("City"), "Kochi");

        expect(screen.getByTestId("committed")).toHaveTextContent("Kochi");
    });
});
