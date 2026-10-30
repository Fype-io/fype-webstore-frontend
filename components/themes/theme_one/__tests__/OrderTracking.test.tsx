import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import OrderTracking, { trackingReference } from "../OrderTracking";

describe("trackingReference", () => {
    it("shows the order number as it is - it already has the store's # prefix", () => {
        expect(trackingReference("#1000", true)).toEqual({ text: "#1000", label: "Order Number" });
    });

    it("shows an order number with any other prefix unchanged", () => {
        expect(trackingReference("FY-1000", true)).toEqual({ text: "FY-1000", label: "Order Number" });
    });

    it("prefixes an AWB with # and labels it as one", () => {
        expect(trackingReference("7X1234567", false)).toEqual({ text: "#7X1234567", label: "AWB Number" });
    });
});

// The popup itself, with no tracking events (so it shows the steps or an end card).
const mockState = { user: { trackingData: { status: "", events: [] }, trackingLoading: false, trackingError: null } };
vi.mock("@/redux/hooks", () => ({
    useAppDispatch: () => vi.fn(),
    useAppSelector: (selector: (state: unknown) => unknown) => selector(mockState),
}));

const renderPopup = (orderStatus: string) =>
    render(<OrderTracking storeId="s1" trackingNumber="#1000" isOrderNumber orderStatus={orderStatus} onClose={() => {}} />);
const activeStep = (container: HTMLElement) => container.querySelector("[data-active]")?.getAttribute("data-step");

describe("OrderTracking steps", () => {
    it("marks Out for Delivery as the current step", () => {
        const { container } = renderPopup("out_for_delivery");
        expect(activeStep(container)).toBe("out_for_delivery");
        expect(screen.queryByText(/Delivery attempt failed/)).toBeNull();
    });

    it("a failed delivery attempt: Out for Delivery, with the failure note", () => {
        const { container } = renderPopup("delivery_failed");
        expect(activeStep(container)).toBe("out_for_delivery");
        expect(screen.getByText("Delivery attempt failed – the courier will try again")).toBeInTheDocument();
    });

    it.each([
        ["rto_in_progress", "Returning To The Seller"],
        ["rto_complete", "Returned To The Seller"],
        ["return_pending", "Return Requested"],
        ["partially_returned", "Some Items Returned"],
    ])("%s shows its card instead of the steps", (status, label) => {
        const { container } = renderPopup(status);
        expect(screen.getByTestId("tracking-end-card")).toHaveTextContent(label);
        expect(container.querySelector("[data-step]")).toBeNull();
    });
});
