import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// The "Complete your profile" popup: every page, for a signed-in shopper whose
// account has no name (production: an email-login customer who closed the old name
// step stayed nameless, and their order's courier booking had no name). Rendered
// through the real Providers (session restore from the profile) and, for the sign-in
// case, the real AuthModal. Only the network (client-api) and the router are mocked.

const postApi = vi.fn();
const getApi = vi.fn();
const auth = { token: "tok" as string | null, signedOut: false };
const editorPreview = { on: false };
const refresh = vi.fn();

vi.mock("@/lib/client-api", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/client-api")>()),
    getApi: (...a: unknown[]) => getApi(...a),
    postApi: (...a: unknown[]) => postApi(...a),
    getAuthToken: () => auth.token,
    isSignedOutSession: () => auth.signedOut,
    setAuthToken: vi.fn(),
    clearAuthToken: vi.fn(),
    markSignedOut: vi.fn(),
    clearSignedOutSession: vi.fn(),
    clearGuestId: vi.fn(),
    getApiErrorMessage: (_e: unknown, fallback: string) => fallback,
}));
vi.mock("@/lib/tracking-api", () => ({ trackShipment: vi.fn() }));
vi.mock("@/lib/editor-preview", () => ({ isEditorPreview: () => editorPreview.on }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }) }));

import Providers from "../Providers";
import AuthModal from "../AuthModal";

const STORE = "STORE-X";
const customer = (over: Record<string, unknown> = {}) => ({
    customerId: "CUST-1", firstName: "", lastName: "", email: "shopper@example.com", phone: undefined,
    isEmailVerified: true, isPhoneVerified: false, ...over,
});

function mockApi(profile: Record<string, unknown> | null) {
    getApi.mockImplementation(async (url: string) => {
        if (url.endsWith("/profile")) {
            if (!profile) throw new Error("401");
            return { data: { success: true, data: { customer: profile } } };
        }
        if (url.includes("/platform")) return { data: { success: true, data: { channels: ["email"] } } };
        if (url.includes("wishlist")) return { data: { success: true, data: { wishlist: [] } } };
        return { data: { success: true, data: { cart: [], items: [] } } };
    });
}

const renderSite = (children: React.ReactNode = <p>Shop page</p>) =>
    render(<Providers storeId={STORE}>{children}</Providers>);

const dialog = () => screen.queryByRole("dialog", { name: "Complete your profile" });
const saveButton = () => screen.getByRole("button", { name: "Save" });

beforeEach(() => {
    postApi.mockReset();
    getApi.mockReset();
    refresh.mockReset();
    auth.token = "tok";
    auth.signedOut = false;
    editorPreview.on = false;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
});

describe("when the popup shows", () => {
    it("shows for a signed-in shopper whose account has no name", async () => {
        mockApi(customer());
        renderSite();
        expect(await screen.findByRole("dialog", { name: "Complete your profile" })).toBeInTheDocument();
        expect(screen.getByText("Signed in as shopper@example.com")).toBeInTheDocument();
    });

    it("treats a name of only spaces as missing", async () => {
        mockApi(customer({ firstName: "   " }));
        renderSite();
        expect(await screen.findByRole("dialog", { name: "Complete your profile" })).toBeInTheDocument();
    });

    it("doesn't show when the account has a name", async () => {
        mockApi(customer({ firstName: "Ameer" }));
        renderSite();
        await waitFor(() => expect(getApi).toHaveBeenCalledWith(expect.stringMatching(/\/profile$/), expect.anything()));
        await screen.findByText("Shop page");
        expect(dialog()).not.toBeInTheDocument();
    });

    it("doesn't show for a signed-out shopper", async () => {
        auth.token = null;
        mockApi(null);
        renderSite();
        await screen.findByText("Shop page");
        expect(dialog()).not.toBeInTheDocument();
    });

    it("doesn't show in the theme editor preview", async () => {
        editorPreview.on = true;
        mockApi(customer());
        renderSite();
        await screen.findByText("Shop page");
        expect(dialog()).not.toBeInTheDocument();
    });
});

describe("the popup", () => {
    it("has no close button, and clicking outside doesn't close it", async () => {
        mockApi(customer());
        renderSite();
        const popup = await screen.findByRole("dialog", { name: "Complete your profile" });
        expect(screen.queryByRole("button", { name: /close/i })).not.toBeInTheDocument();
        fireEvent.click(popup);
        expect(dialog()).toBeInTheDocument();
    });

    it("saves the name with the phone left empty, and goes away", async () => {
        mockApi(customer());
        postApi.mockResolvedValue({ data: { success: true, data: { customer: customer({ firstName: "Ameer", lastName: "Ali" }) } } });
        renderSite();
        await screen.findByRole("dialog", { name: "Complete your profile" });

        expect(saveButton()).toBeDisabled();
        fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "  Ameer   Ali " } });
        expect(saveButton()).toBeEnabled();
        fireEvent.click(saveButton());

        await waitFor(() => expect(dialog()).not.toBeInTheDocument());
        const [url, body] = postApi.mock.calls.find(([u]) => String(u).endsWith("/complete-registration"))!;
        expect(url).toBe(`/customer/${STORE}/complete-registration`);
        expect(body).toEqual({ firstName: "Ameer", lastName: "Ali", email: "" });
    });

    it("for a phone sign-in, the email is optional but must be valid when typed", async () => {
        mockApi(customer({ email: undefined, phone: "+971501234567" }));
        postApi.mockResolvedValue({ data: { success: true, data: { customer: customer({ firstName: "Ameer" }) } } });
        renderSite();
        await screen.findByRole("dialog", { name: "Complete your profile" });
        expect(screen.getByText("Signed in as +971501234567")).toBeInTheDocument();
        expect(screen.queryByText(/Phone Number/)).not.toBeInTheDocument();

        fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "Ameer" } });
        fireEvent.change(screen.getByLabelText(/Email Address/), { target: { value: "not-an-email" } });
        expect(saveButton()).toBeDisabled();
        fireEvent.change(screen.getByLabelText(/Email Address/), { target: { value: "ameer@example.com" } });
        fireEvent.click(saveButton());

        await waitFor(() => expect(dialog()).not.toBeInTheDocument());
        const [, body] = postApi.mock.calls.find(([u]) => String(u).endsWith("/complete-registration"))!;
        expect(body).toEqual({ firstName: "Ameer", lastName: "", email: "ameer@example.com" });
    });

    it("shows the backend's error and stays open", async () => {
        mockApi(customer({ email: undefined, phone: "+971501234567" }));
        postApi.mockResolvedValue({ data: { success: false, message: "Email already registered with another account" } });
        renderSite();
        await screen.findByRole("dialog", { name: "Complete your profile" });

        fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "Ameer Ali" } });
        fireEvent.change(screen.getByLabelText(/Email Address/), { target: { value: "taken@example.com" } });
        fireEvent.click(saveButton());

        expect(await screen.findByText("Email already registered with another account")).toBeInTheDocument();
        expect(dialog()).toBeInTheDocument();
        expect(saveButton()).toBeEnabled();
    });

    it("Sign out signs the shopper out and closes it", async () => {
        mockApi(customer());
        postApi.mockResolvedValue({ data: { success: true } });
        renderSite();
        await screen.findByRole("dialog", { name: "Complete your profile" });

        fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

        await waitFor(() => expect(dialog()).not.toBeInTheDocument());
        expect(postApi).toHaveBeenCalledWith(`/customer/${STORE}/logout`, {}, { withCredentials: true });
        expect(refresh).toHaveBeenCalled();
    });
});

describe("signing in", () => {
    it("a new customer's sign-in closes the login popup, then asks for the name", async () => {
        auth.token = null;
        mockApi(null);
        postApi.mockImplementation(async (url: string) => {
            if (url.endsWith("/login/initiate")) return { data: { success: true, data: { attemptsLeft: 3 } } };
            if (url.endsWith("/login/verify")) {
                return { data: { success: true, data: { customer: customer(), isNew: true, requiresRegistration: true } } };
            }
            return { data: { success: true } };
        });
        const onClose = vi.fn();
        renderSite(<AuthModal isOpen onClose={onClose} storeId={STORE} shopName="Shop" />);

        fireEvent.change(await screen.findByPlaceholderText("Enter your email address"), { target: { value: "shopper@example.com" } });
        fireEvent.click(screen.getByRole("button", { name: /send otp/i }));
        await screen.findByText(/Enter the 4-digit code/i);
        const boxes = screen.getAllByRole("textbox") as HTMLInputElement[];
        ["1", "2", "3", "4"].forEach((d, i) => fireEvent.change(boxes[i]!, { target: { value: d } }));

        expect(await screen.findByRole("dialog", { name: "Complete your profile" })).toBeInTheDocument();
        expect(screen.queryByPlaceholderText("Enter your full name")).toBeInTheDocument(); // the popup's field, once
        expect(screen.getAllByPlaceholderText("Enter your full name")).toHaveLength(1);
        await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 3000 });
    });
});
