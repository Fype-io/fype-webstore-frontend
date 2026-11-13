"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { logout } from "@/redux/slices/userSlice";
import RequireCustomerAuth from "@/components/shared/RequireCustomerAuth";

interface AccountLayoutProps {
    title: string;
    storeId?: string;
    children: React.ReactNode;
}

const tabs = [
    { path: "/orders", label: "Orders", match: (pathname: string) => pathname === "/accounts" || pathname.startsWith("/orders") },
    { path: "/wishlist", label: "Wishlist", match: (pathname: string) => pathname.startsWith("/wishlist") },
    { path: "/addresses", label: "Addresses", match: (pathname: string) => pathname.startsWith("/addresses") },
];

export default function AccountLayout({ title: _title, storeId, children }: AccountLayoutProps) {
    const pathname = usePathname();
    const router = useRouter();
    const dispatch = useAppDispatch();
    const { user } = useAppSelector((state) => state.user);
    const firstName = user?.firstName?.trim();

    const handleSignOut = async () => {
        if (storeId) {
            await dispatch(logout({ storeId }));
        }
        router.push("/");
        router.refresh();
    };

    return (
        <RequireCustomerAuth>
        <div className="py-12 md:py-20 px-4 sm:px-6 max-w-6xl mx-auto min-h-full font-sans w-full flex-grow">
            <div className="flex items-center justify-between mb-8 pb-8 border-b border-gray-200 gap-4 min-w-0">
                <div className="flex-1 min-w-0">
                    <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-2 leading-tight">My Account</h1>
                    <p className="text-gray-500 font-medium text-sm md:text-base truncate">
                        Welcome back{firstName ? `, ${firstName}` : ""}.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleSignOut}
                    className="text-gray-400 hover:text-black transition-colors font-bold text-[10px] md:text-xs uppercase tracking-wider flex items-center gap-1.5 group shrink-0 spark-font-body"
                >
                    <span className="hidden sm:block">Sign out</span>
                    <span className="sm:hidden">Log out</span>
                    <LogOut size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
            </div>

            <div className="flex flex-col md:flex-row gap-12 lg:gap-20">
                <div className="w-full md:w-56 shrink-0">
                    <nav className="flex flex-row w-full gap-1 p-1 bg-gray-50 rounded-xl mb-4 border border-gray-100 md:flex-col md:space-y-1 md:bg-transparent md:p-0 md:border-0 md:rounded-none md:mb-0">
                        {tabs.map((tab) => {
                            const active = tab.match(pathname);
                            return (
                                <Link
                                    key={tab.path}
                                    href={tab.path}
                                    className={`flex-1 flex justify-center items-center px-2 py-2.5 sm:px-4 sm:py-3 rounded-lg text-[10px] sm:text-sm font-bold transition-all md:justify-start ${
                                        active ? "bg-white text-black shadow-sm ring-1 ring-black/5 md:bg-white" : "text-gray-500 hover:text-black"
                                    }`}
                                >
                                    <span className="truncate">{tab.label}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                <div className="flex-1 min-w-0">{children}</div>
            </div>
        </div>
        </RequireCustomerAuth>
    );
}
