import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import ContactForm from "../sections/ContactForm";
import type { SparkContactFormSettings } from "../sparkConfig";

// The form used to set an error on a failed send but never render it, so the shopper saw nothing happen.

vi.mock("@/lib/client-store-context", () => ({ getCurrentStoreId: vi.fn(() => "store-1") }));
vi.mock("@/lib/client-api", async () => {
    const { shopperErrorMessage } = await import("@/lib/shopper-error");
    const axios = (await import("axios")).default;
    return {
        postApi: vi.fn(),
        getApiErrorMessage: (error: unknown, fallback: string) =>
            axios.isAxiosError(error) ? shopperErrorMessage(error.response?.status, error.response?.data, fallback) : fallback,
    };
});

import { postApi } from "@/lib/client-api";

const settings: SparkContactFormSettings = {
    heading: "Contact us",
    subtext: "",
    fields: ["Name", "Email", "Message"],
    submit_button_label: "Send",
    success_message: "Thanks, we got your message",
    background_color: "#fff",
    padding_top: 0,
    padding_bottom: 0,
};

const fillAndSend = async () => {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Name"), "Asha");
    await user.type(screen.getByLabelText("Email"), "asha@example.com");
    await user.type(screen.getByLabelText("Message"), "Do you ship to Dubai?");
    await user.click(screen.getByRole("button", { name: "Send" }));
};

const serverError = (status: number, data: object) =>
    new AxiosError("Request failed", "ERR_BAD_RESPONSE", undefined, undefined, { status, data } as AxiosResponse);

describe("Contact form errors", () => {
    beforeEach(() => vi.mocked(postApi).mockReset());

    it("shows a shopper-safe message when sending fails, never the server's text", async () => {
        vi.mocked(postApi).mockRejectedValueOnce(serverError(500, { message: "No store email configured on server" }));
        render(<ContactForm settings={settings} />);

        await fillAndSend();

        expect(await screen.findByRole("alert")).toHaveTextContent("Unable to send your message. Please try again.");
        expect(screen.queryByText(/configured on server/)).not.toBeInTheDocument();
        // the shopper's text stays so they can retry
        expect(screen.getByLabelText("Message")).toHaveValue("Do you ship to Dubai?");
    });

    it("disables the button while sending, and shows the success message once sent", async () => {
        type Sent = Awaited<ReturnType<typeof postApi>>;
        let finish: (value: Sent) => void = () => {};
        vi.mocked(postApi).mockReturnValue(new Promise<Sent>((resolve) => (finish = resolve)));
        render(<ContactForm settings={settings} />);

        await fillAndSend();
        expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

        finish({ data: { success: true } } as Sent);
        expect(await screen.findByText("Thanks, we got your message")).toBeInTheDocument();
        expect(postApi).toHaveBeenCalledTimes(1);
    });

    it("clears the error on the next attempt", async () => {
        vi.mocked(postApi).mockRejectedValueOnce(serverError(500, {})).mockResolvedValueOnce({ data: { success: true } } as never);
        render(<ContactForm settings={settings} />);

        await fillAndSend();
        expect(await screen.findByRole("alert")).toBeInTheDocument();

        await userEvent.setup().click(screen.getByRole("button", { name: "Send" }));
        await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
        expect(await screen.findByText("Thanks, we got your message")).toBeInTheDocument();
    });
});
