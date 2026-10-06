"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SparkCartContext } from "./SparkCartContext";
import CartDrawer from "./CartDrawer";
import { consumeCartDrawerReopen } from "@/lib/cart-drawer-reopen";

interface SparkCartShellProps {
    storeId?: string;
    children: React.ReactNode;
}

export default function SparkCartShell({ storeId, children }: SparkCartShellProps) {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    // Checkout's Back button asks for the drawer to be open again on the page
    // the shopper returns to (see lib/cart-drawer-reopen.ts). Read after
    // hydration: sessionStorage doesn't exist on the server.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (consumeCartDrawerReopen()) setIsOpen(true);
    }, [pathname]);

    return (
        <SparkCartContext.Provider
            value={{
                isOpen,
                openCart: () => setIsOpen(true),
                closeCart: () => setIsOpen(false),
            }}
        >
            {children}
            {storeId ? <CartDrawer storeId={storeId} isOpen={isOpen} onClose={() => setIsOpen(false)} /> : null}
        </SparkCartContext.Provider>
    );
}
