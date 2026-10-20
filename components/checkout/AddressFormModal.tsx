"use client";

import { useEffect } from "react";
import type { Address } from "@/redux/slices/userSlice";
import AddAddressPanel from "./AddAddressPanel";

interface AddressFormModalProps {
    open: boolean;
    initial?: Address | null;
    saving?: boolean;
    onClose: () => void;
    onSave: (address: Omit<Address, "_id" | "addressId">) => Promise<void>;
    defaultCountry?: string | undefined;
}

export default function AddressFormModal({ open, initial = null, saving, onClose, onSave, defaultCountry }: AddressFormModalProps) {
    useEffect(() => {
        if (!open) return;
        const html = document.documentElement;
        const body = document.body;
        const prevHtml = html.style.overflow;
        const prevBody = body.style.overflow;
        html.style.overflow = "hidden";
        body.style.overflow = "hidden";
        return () => {
            html.style.overflow = prevHtml;
            body.style.overflow = prevBody;
        };
    }, [open]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6">
            <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative w-full sm:max-w-[480px] h-[min(92vh,800px)] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden text-black">
                <AddAddressPanel
                    key={initial?.addressId ?? "new"}
                    initial={initial}
                    saving={saving}
                    onBack={onClose}
                    onSave={onSave}
                    {...(defaultCountry ? { defaultCountry } : {})}
                />
            </div>
        </div>
    );
}
