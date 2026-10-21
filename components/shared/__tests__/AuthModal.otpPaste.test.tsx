import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";

const postApi = vi.fn();
const getApi = vi.fn();

vi.mock("@/lib/client-api", () => ({
    getApi: (...a: unknown[]) => getApi(...a),
    postApi: (...a: unknown[]) => postApi(...a),
    putApi: vi.fn(),
    deleteApi: vi.fn(),
    setAuthToken: vi.fn(),
    clearGuestId: vi.fn(),
    clearAuthToken: vi.fn(),
    setGuestId: vi.fn(),
    markSignedOut: vi.fn(),
    clearSignedOutSession: vi.fn(),
    getApiErrorMessage: (_e: unknown, fallback: string) => fallback,
}));
vi.mock("@/lib/tracking-api", () => ({ trackShipment: vi.fn() }));
vi.mock("@/lib/editor-preview", () => ({ isEditorPreview: () => false }));

import AuthModal from "../AuthModal";
import { makeStore } from "@/redux/store";

// Walks the real modal to the "enter the 4-digit code" step (email sign-in), the way a shopper does.
async function openOtpStep() {
    render(
        <Provider store={makeStore()}>
            <AuthModal isOpen onClose={() => {}} storeId="STORE-X" shopName="Shop" />
        </Provider>
    );
    fireEvent.change(await screen.findByPlaceholderText("Enter your email address"), { target: { value: "shopper@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /send otp/i }));
    await screen.findByText(/Enter the 4-digit code/i);
    return screen.getAllByRole("textbox") as HTMLInputElement[];
}

const paste = (el: HTMLElement, text: string) =>
    fireEvent.paste(el, { clipboardData: { getData: () => text } });

describe("OTP boxes", () => {
    beforeEach(() => {
        postApi.mockReset();
        getApi.mockReset();
        getApi.mockResolvedValue({ data: { success: true, data: { channels: ["email"] } } });
        postApi.mockImplementation(async (url: string) => {
            if (url.endsWith("/login/initiate")) return { data: { success: true, data: { attemptsLeft: 3 } } };
            return { data: { success: false, message: "Invalid OTP" } }; // verify: stop after the call, we only check what was sent
        });
    });

    it("a pasted code fills all four boxes and is verified", async () => {
        const boxes = await openOtpStep();
        paste(boxes[0]!, "4821");

        await waitFor(() => expect(boxes.map((b) => b.value)).toEqual(["4", "8", "2", "1"]));
        await waitFor(() => {
            const verify = postApi.mock.calls.find(([url]) => String(url).endsWith("/login/verify"));
            expect(verify?.[1]).toMatchObject({ otp: "4821", email: "shopper@example.com" });
        });
    });

    it("a code pasted into a later box still starts at the first, and spaces are ignored", async () => {
        const boxes = await openOtpStep();
        paste(boxes[2]!, "12 34");

        await waitFor(() => expect(boxes.map((b) => b.value)).toEqual(["1", "2", "3", "4"]));
    });

    it("an autofill that drops the whole code into one box spreads it too", async () => {
        const boxes = await openOtpStep();
        fireEvent.change(boxes[0]!, { target: { value: "9087" } });

        await waitFor(() => expect(boxes.map((b) => b.value)).toEqual(["9", "0", "8", "7"]));
    });

    it("typing digit by digit still works and verifies on the fourth", async () => {
        const boxes = await openOtpStep();
        ["1", "2", "3", "4"].forEach((d, i) => fireEvent.change(boxes[i]!, { target: { value: d } }));

        await waitFor(() => expect(boxes.map((b) => b.value)).toEqual(["1", "2", "3", "4"]));
        await waitFor(() => {
            const verify = postApi.mock.calls.find(([url]) => String(url).endsWith("/login/verify"));
            expect(verify?.[1]).toMatchObject({ otp: "1234" });
        });
    });

    it("pasting text with no digits changes nothing", async () => {
        const boxes = await openOtpStep();
        paste(boxes[0]!, "abcd");

        expect(boxes.map((b) => b.value)).toEqual(["", "", "", ""]);
    });
});
