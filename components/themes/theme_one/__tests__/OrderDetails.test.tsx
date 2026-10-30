import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Order } from "@/redux/slices/userSlice";

vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

import OrderDetail from "../OrderDetails";
import { shippingTaxLabel } from "@/utils/taxCalculator";

const order = (over: Partial<Order> = {}): Order =>
    ({
        orderId: "o-1", orderNumber: "#1003", status: "pending", paymentStatus: "unpaid", paymentMethod: "manual",
        createdAt: "2026-10-30T00:00:00Z", currency: "AED", items: [{ productId: "p", name: "Oud Perfume 100ml", price: 200, quantity: 1, subtotal: 200 }],
        subtotal: 200, tax: 12.75, shipping: 15, discount: 0, total: 227.75,
        ...over,
    }) as unknown as Order;

describe("OrderDetails: tax rows", () => {
    it("shows the items' tax at its own rate and the tax on shipping as its own row", () => {
        render(<OrderDetail storeId="S-1" order={order({ tax_lines: [{ type: "VAT", rate: 6, amount: 12.75 }], item_tax_lines: [{ type: "VAT", rate: 6, amount: 12 }], shipping_tax: 0.75 })} />);
        expect(screen.getByText("VAT (6%)")).toBeInTheDocument();
        expect(screen.getByText(/12$/)).toBeInTheDocument();
        expect(screen.getByText("VAT on shipping")).toBeInTheDocument();
        expect(screen.getByText(/0\.75$/)).toBeInTheDocument();
    });

    it("an older order without item_tax_lines keeps its combined row and adds no shipping row", () => {
        render(<OrderDetail storeId="S-1" order={order({ tax: 10.75, tax_lines: [{ type: "VAT", rate: 5, amount: 10.75 }] })} />);
        expect(screen.getByText("VAT (5%)")).toBeInTheDocument();
        expect(screen.queryByText("VAT on shipping")).not.toBeInTheDocument();
    });

    it("no tax on shipping: no shipping row", () => {
        render(<OrderDetail storeId="S-1" order={order({ tax: 10, tax_lines: [{ type: "VAT", rate: 5, amount: 10 }], item_tax_lines: [{ type: "VAT", rate: 5, amount: 10 }], shipping_tax: 0 })} />);
        expect(screen.queryByText("VAT on shipping")).not.toBeInTheDocument();
    });
});

describe("shippingTaxLabel", () => {
    it("names India's split GST and any other tax by its own name", () => {
        expect(shippingTaxLabel([{ type: "CGST" }, { type: "SGST" }])).toBe("GST on shipping");
        expect(shippingTaxLabel([{ type: "IGST" }])).toBe("GST on shipping");
        expect(shippingTaxLabel([{ type: "VAT" }])).toBe("VAT on shipping");
        expect(shippingTaxLabel([])).toBe("Tax on shipping");
    });
});
