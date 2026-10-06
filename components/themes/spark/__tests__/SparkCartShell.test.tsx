import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import SparkCartShell from "../SparkCartShell";
import { requestCartDrawerReopen } from "@/lib/cart-drawer-reopen";

vi.mock("next/navigation", () => ({
    usePathname: () => "/products/p1",
}));

// The real drawer needs the redux store; only whether the shell opens it
// matters here.
vi.mock("../CartDrawer", () => ({
    default: ({ isOpen }: { isOpen: boolean }) => <div data-testid="drawer">{isOpen ? "open" : "closed"}</div>,
}));

describe("SparkCartShell", () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    it("starts with the drawer closed", () => {
        render(<SparkCartShell storeId="STORE-1">page</SparkCartShell>);
        expect(screen.getByTestId("drawer")).toHaveTextContent("closed");
    });

    it("opens the drawer when checkout's Back button asked for it", () => {
        requestCartDrawerReopen();
        render(<SparkCartShell storeId="STORE-1">page</SparkCartShell>);
        expect(screen.getByTestId("drawer")).toHaveTextContent("open");
    });
});
