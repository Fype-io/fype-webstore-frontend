import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StoreCurrencyProvider, useStoreCurrency } from "../StoreCurrency";
import PaymentSummaryCard from "@/components/checkout/PaymentSummaryCard";

function Price({ amount }: { amount: number }) {
    const { format } = useStoreCurrency();
    return <span>{format(amount)}</span>;
}

describe("StoreCurrencyProvider", () => {
    it("formats in the store's currency", () => {
        render(<StoreCurrencyProvider currency="AED"><Price amount={250} /></StoreCurrencyProvider>);
        expect(screen.getByText("AED 250")).toBeInTheDocument();
    });

    it("shows INR without a provider or currency (unchanged default)", () => {
        render(<Price amount={250} />);
        expect(screen.getByText("₹250")).toBeInTheDocument();
    });

    it("the checkout summary shows a UAE store's totals in AED, paise/fils included", () => {
        render(
            <StoreCurrencyProvider currency="AED">
                <PaymentSummaryCard subtotal={100} tax={5} shipping={10} total={115.5} />
            </StoreCurrencyProvider>
        );
        expect(screen.getByText("AED 100")).toBeInTheDocument();
        expect(screen.getByText("AED 115.5")).toBeInTheDocument();
        expect(document.body.textContent).not.toContain("₹");
    });
});
