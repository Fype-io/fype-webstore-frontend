"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requestCartDrawerReopen } from "@/lib/cart-drawer-reopen";

export default function CheckoutHeader({ title, onBack }: { title: string; onBack?: () => void }) {
    const router = useRouter();
    const backButtonClass = "p-1 -ml-1 text-black hover:bg-gray-100 rounded-full transition-colors";

    // The cart is the storefront's drawer, not a page: go back to wherever
    // the shopper opened checkout from, with the drawer open again. Landed
    // here directly (no history) - the home page, drawer open.
    const backToCart = () => {
        requestCartDrawerReopen();
        if (window.history.length > 1) router.back();
        else router.push("/");
    };

    return (
        <header className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 flex items-center gap-4 bg-white sticky top-0 z-10">
            <button
                type="button"
                onClick={onBack ?? backToCart}
                className={backButtonClass}
                aria-label={onBack ? "Back" : "Back to cart"}
            >
                <ChevronLeft className="w-6 h-6" size={24} />
            </button>
            <h1 className="text-[17px] sm:text-[19px] font-semibold text-black tracking-tight">{title}</h1>
        </header>
    );
}
