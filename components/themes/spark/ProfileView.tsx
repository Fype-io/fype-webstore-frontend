"use client";

import { useState } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { updateUserProfile, type User } from "@/redux/slices/userSlice";

interface ProfileViewProps {
    storeId?: string;
}

function formFromUser(user: User | null) {
    return {
        firstName: user ? `${user.firstName ?? ""}${user.lastName ? " " + user.lastName : ""}`.trim() : "",
        email: user?.email || "",
        phone: user?.phone || "",
    };
}

export default function ProfileView({ storeId }: ProfileViewProps) {
    const dispatch = useAppDispatch();
    const { user, authLoading, authError } = useAppSelector((state) => state.user);
    // Start from the signed-in user: when the profile is already loaded on arrival,
    // `user` never changes afterwards, so the sync below would never fill the form.
    const [formData, setFormData] = useState(() => formFromUser(user));
    const [successMessage, setSuccessMessage] = useState("");
    const [prevUser, setPrevUser] = useState<User | null>(user);

    if (user !== prevUser) {
        setPrevUser(user);
        if (user) setFormData(formFromUser(user));
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSuccessMessage("");
        if (!storeId) return;
        try {
            await dispatch(updateUserProfile({ storeId, data: { ...formData, lastName: "" } })).unwrap();
            setSuccessMessage("Profile updated successfully!");
        } catch {
            // Error surfaced via authError
        }
    };

    return (
        <div>
            <h2 className="text-xl md:text-2xl font-bold mb-6">Profile</h2>
            <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
                {authError && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{authError}</div>}
                {successMessage && <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">{successMessage}</div>}
                <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Full name</label>
                    <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-black"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Email address</label>
                    <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-black"
                    />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Phone number</label>
                    <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        disabled
                        className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-gray-50 text-gray-400 cursor-not-allowed"
                    />
                    <p className="text-[11px] text-gray-400 mt-2 font-medium">Phone number is verified and cannot be changed.</p>
                </div>
                <button
                    type="submit"
                    disabled={authLoading}
                    className="bg-black text-white px-8 py-3 rounded-xl font-medium hover:bg-gray-900 transition-colors disabled:opacity-50 spark-font-body"
                >
                    {authLoading ? "Saving…" : "Save changes"}
                </button>
            </form>
        </div>
    );
}
