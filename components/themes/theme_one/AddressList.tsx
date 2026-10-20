"use client";

import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { fetchAddresses, addAddress, updateAddress, deleteAddress, type Address } from "@/redux/slices/userSlice";
import AddressCard from "./AddressCard";
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

    const handleAddAddress = async (addressData: Omit<Address, "_id" | "addressId">) => {
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

    const handleUpdateAddress = async (addressData: Omit<Address, "_id" | "addressId">) => {
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

    const handleEditClick = (address: Address) => {
        setEditingAddress(address);
    };

    const handleAddNewClick = () => {
        setCreateOpen(true);
    };

    if (addressesLoading && addresses.length === 0) {
        return (
            <div className="flex justify-center items-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-black border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (addresses.length === 0) {
        return (
            <div className="space-y-4">
                <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                    <span className="material-symbols-outlined text-6xl text-gray-400 mb-4">location_on</span>
                    <p className="text-gray-600 mb-4 font-semibold">No addresses saved yet</p>
                    <button onClick={handleAddNewClick} className="px-8 py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition shadow-lg shadow-black/10">
                        Add Delivery Address
                    </button>
                </div>
                <AddressFormModal open={createOpen} saving={saving} onClose={() => setCreateOpen(false)} onSave={handleAddAddress} defaultCountry={defaultCountry} />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div />
                <button
                    onClick={handleAddNewClick}
                    className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-xl text-xs font-semibold hover:bg-gray-800 transition-all shadow-lg shadow-black/10 active:scale-95"
                >
                    <span className="material-symbols-outlined text-base">add</span>
                    Add New Address
                </button>
            </div>

            <div className="grid grid-cols-1 gap-0">
                {addresses.map((address) => (
                    <AddressCard
                        key={address.addressId}
                        address={address}
                        isSelected={selectionMode && selectedAddressId === (address._id || address.addressId)}
                        onSelect={selectionMode ? onAddressSelect : undefined}
                        onEdit={handleEditClick}
                        onDelete={() => handleDeleteAddress(address.addressId)}
                    />
                ))}
            </div>

            {selectionMode && (
                <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-600 text-center">Click on an address to select it for delivery</p>
                </div>
            )}

            <AddressFormModal open={createOpen} saving={saving} onClose={() => setCreateOpen(false)} onSave={handleAddAddress} defaultCountry={defaultCountry} />
            <AddressFormModal
                open={!!editingAddress}
                initial={editingAddress}
                saving={saving}
                onClose={() => setEditingAddress(null)}
                onSave={handleUpdateAddress}
            />
        </div>
    );
}
