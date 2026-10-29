import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PaymentSummaryCard from "../PaymentSummaryCard";
import { StoreCurrencyProvider } from "@/components/shared/StoreCurrency";

const renderCard = (props: Partial<React.ComponentProps<typeof PaymentSummaryCard>>) =>
    render(
        <StoreCurrencyProvider currency="AED">
            <PaymentSummaryCard subtotal={200} tax={10} shipping={15} total={225} {...props} />
        </StoreCurrencyProvider>
    );

describe("PaymentSummaryCard - tax rows", () => {
    it("a UAE order shows one VAT row and never GST", () => {
        renderCard({ taxLabel: "VAT", taxLines: [{ type: "VAT", rate: 5, amount: 10 }] });
        expect(screen.getByText("VAT (5%)")).toBeInTheDocument();
        expect(screen.queryByText(/GST/)).not.toBeInTheDocument();
    });

    it("India shows CGST and SGST as separate rows", () => {
        renderCard({
            tax: 18,
            taxLabel: "GST",
            taxLines: [
                { type: "CGST", rate: 9, amount: 9 },
                { type: "SGST", rate: 9, amount: 9 },
            ],
        });
        expect(screen.getByText("CGST (9%)")).toBeInTheDocument();
        expect(screen.getByText("SGST (9%)")).toBeInTheDocument();
    });

    it("tax on a shipping charge rated at checkout is its own row, and the lines still add up", () => {
        renderCard({ tax: 13, taxLabel: "VAT", taxLines: [{ type: "VAT", rate: 5, amount: 10 }], shippingTax: 3 });
        expect(screen.getByText("VAT (5%)")).toBeInTheDocument();
        expect(screen.getByText("VAT on shipping")).toBeInTheDocument();
    });

    it("falls back to one total row when the lines do not add up to the tax shown, or none were sent", () => {
        renderCard({ tax: 12, taxLabel: "VAT", taxLines: [{ type: "VAT", rate: 5, amount: 10 }] });
        expect(screen.getByText("VAT")).toBeInTheDocument();
        expect(screen.queryByText("VAT (5%)")).not.toBeInTheDocument();
    });

    it("shows the discount as a deduction", () => {
        renderCard({ discount: 20, taxLabel: "VAT" });
        expect(screen.getByText("Discount")).toBeInTheDocument();
        expect(screen.getByText("-AED 20")).toBeInTheDocument();
    });
});
