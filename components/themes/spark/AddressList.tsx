"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { fetchAddresses, addAddress, updateAddress, deleteAddress, type Address } from "@/redux/slices/userSlice";
import AddressFormModal from "@/components/checkout/AddressFormModal";

interface AddressListProps {
    storeId: string;
    selectionMode?: boolean;
    selectedAddressId?: string;
    onAddressSelect?: (address: Address) => void;
    // ISO country a new address starts in (the store's courier decides, see lib/shipment-provider).
    defaultCountry?: string | undefined;
}

export default function AddressList({ storeId, selectionMode = false, selectedAddressId, onAddressSelect, defaultCountry }: AddressListProps) {
    const dispatch = useAppDispatch();
    const { addresses, addressesLoading } = useAppSelector((state) => state.user);
    const [createOpen, setCreateOpen] = useState(false);
    const [editingAddress, setEditingAddress] = useState<Address | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (storeId) dispatch(fetchAddresses({ storeId }));
    }, [dispatch, storeId]);

    const handleCreate = async (addressData: Omit<Address, "_id" | "addressId">) => {
        setSaving(true);
        try {
            await dispatch(addAddress({ storeId, address: addressData })).unwrap();
            setCreateOpen(false);
            if (selectionMode && addresses.length === 0) {
                const newAddresses = await dispatch(fetchAddresses({ storeId })).unwrap();
                if (newAddresses.length > 0 && onAddressSelect) onAddressSelect(newAddresses[0]);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleUpdate = async (addressData: Omit<Address, "_id" | "addressId">) => {
        if (!editingAddress) return;
        setSaving(true);
        try {
            await dispatch(updateAddress({ storeId, addressId: editingAddress.addressId, address: addressData })).unwrap();
            setEditingAddress(null);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAddress = async (addressId: string) => {
        if (confirm("Are you sure you want to delete this address?")) {
            await dispatch(deleteAddress({ storeId, addressId }));
        }
    };

    if (addressesLoading && addresses.length === 0) {
        return (
            <div className="flex justify-center items-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-black border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl md:text-2xl font-bold">Saved Addresses</h2>
                <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="flex items-center gap-1.5 text-[10px] md:text-xs uppercase tracking-wider font-bold bg-black text-white px-3 py-2 rounded-lg hover:opacity-90 transition-opacity spark-font-body"
                >
                    <Plus size={14} /> Add New
                </button>
            </div>

            {addresses.length === 0 ? (
                <p className="text-gray-500">No addresses saved yet.</p>
            ) : (
                <div className="flex flex-col gap-4">
                    {addresses.map((address) => {
                        const name = `${address.firstName || ""} ${address.lastName || ""}`.trim() || "Address";
                        const selected = selectionMode && selectedAddressId === (address._id || address.addressId);
                        return (
                            <div
                                key={address.addressId}
                                onClick={() => onAddressSelect?.(address)}
                                className={`rounded-xl p-5 relative bg-white flex flex-col md:flex-row justify-between md:items-start gap-4 ${
                                    address.isDefault || selected ? "border border-black shadow-sm" : "border border-gray-200"
                                } ${onAddressSelect ? "cursor-pointer" : ""}`}
                            >
                                <div>
                                    {address.isDefault && (
                                        <div className="inline-flex items-center px-2 py-1 rounded-md text-[9px] font-bold tracking-wider uppercase bg-black text-white mb-3">Default</div>
                                    )}
                                    <h3 className="font-bold text-base mb-1">{name}</h3>
                                    <p className="text-gray-500 text-sm mb-3 max-w-sm">
                                        {address.addressLine1}
                                        {address.addressLine2 ? `, ${address.addressLine2}` : ""}
                                        <br />
                                        {address.city}, {address.state} {address.postalCode}
                                        <br />
                                        {address.country}
                                    </p>
                                    <p className="text-sm font-medium text-gray-900">{address.phoneNumber}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingAddress(address);
                                        }}
                                        className="text-xs font-bold uppercase tracking-wider text-black bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-md transition-colors spark-font-body"
                                    >
                                        Edit
                                    </button>
                                    {!address.isDefault && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteAddress(address.addressId);
                                            }}
                                            className="text-xs font-bold uppercase tracking-wider text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md transition-colors spark-font-body"
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <AddressFormModal open={createOpen} saving={saving} onClose={() => setCreateOpen(false)} onSave={handleCreate} defaultCountry={defaultCountry} />
            <AddressFormModal
                open={!!editingAddress}
                initial={editingAddress}
                saving={saving}
                onClose={() => setEditingAddress(null)}
                onSave={handleUpdate}
            />
        </div>
    );
}
