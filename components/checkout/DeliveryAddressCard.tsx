"use client";

import type { Address } from "@/redux/slices/userSlice";
import { addressDetails, addressDisplayName, addressTypeLabel } from "./checkoutUtils";
import { MapPin } from "lucide-react";

interface DeliveryAddressCardProps {
    addresses: Address[];
    selected: Address | null;
    onChange: () => void;
    onAdd: () => void;
    notServiceable?: boolean;
    tatInfo?: string | null;
    /** Set when the shopper tried to order without an address; shown as a validation error. */
    error?: string | null;
}

export default function DeliveryAddressCard({
    addresses,
    selected,
    onChange,
    onAdd,
    notServiceable,
    tatInfo,
    error,
}: DeliveryAddressCardProps) {
    const showError = !!error && !selected;
    return (
        <section
            className={`bg-white rounded-2xl border shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4 sm:p-5 flex flex-col gap-4 sm:gap-5 transition-colors ${
                showError ? "border-red-300 ring-1 ring-red-200" : "border-gray-100"
            }`}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" size={20} />
                    <h2 className="text-[16px] sm:text-lg font-bold text-gray-800 tracking-tight">Delivery Address</h2>
                </div>
                {addresses.length > 0 && (
                    <button type="button" onClick={onChange} className="text-[13px] font-semibold text-blue-600 hover:underline">
                        Change
                    </button>
                )}
            </div>

            {addresses.length === 0 || !selected ? (
                <div className="flex flex-col gap-2">
                    <button
                        type="button"
                        onClick={onAdd}
                        className={`w-full text-left text-sm font-semibold px-4 py-3 rounded-xl border border-dashed transition-colors ${
                            showError
                                ? "border-red-300 bg-red-50/40 text-red-700 hover:bg-red-50"
                                : "border-gray-300 bg-gray-50 text-gray-900 hover:bg-gray-100"
                        }`}
                    >
                        + Add delivery address
                    </button>
                    {showError && (
                        <p role="alert" className="text-[13px] text-red-600 font-medium">
                            {error}
                        </p>
                    )}
                </div>
            ) : (
                <div className="flex flex-col gap-1.5 mt-1">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 text-[15px]">{addressDisplayName(selected)}</span>
                        <span className="text-[10px] uppercase tracking-wider font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {addressTypeLabel(selected)}
                        </span>
                    </div>
                    <p className="text-[14px] text-gray-500 leading-relaxed font-medium">{addressDetails(selected)}</p>
                    {tatInfo && <p className="text-[13px] text-gray-600 font-medium mt-1">Estimated delivery: {tatInfo}</p>}
                    {notServiceable && (
                        <div className="mt-3 bg-red-50 border border-red-100 rounded-lg p-3">
                            <p className="text-xs text-red-600 font-medium">
                                {selected.postalCode
                                    ? "This pincode is not serviceable. Please change your delivery address."
                                    : "We don't deliver to this area yet. Please change your delivery address."}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
