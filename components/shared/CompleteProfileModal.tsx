"use client";

// Shown, on every page, to a signed-in shopper whose account has no name - after a
// first sign-in, and again on any later visit until they add one (closing the tab or
// reloading doesn't skip it). Sign-in itself (AuthModal) no longer asks for the name;
// this is the one place that does. It can't be closed: the shopper adds a name or
// signs out. Shared across all themes, like AuthModal.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { PhoneInput } from "@/components/checkout/ui/PhoneInput";
import { splitName } from "@/components/checkout/checkoutUtils";
import { useAppDispatch } from "@/redux/hooks";
import { completeRegistration, logout, type User } from "@/redux/slices/userSlice";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** PhoneInput reports just the country code ("+971") while the number is empty. */
const isPhoneEmpty = (value: string) => /^\+?\d{0,3}$/.test(value.replace(/\s/g, ""));

interface CompleteProfileModalProps {
    storeId: string;
    user: User;
}

export default function CompleteProfileModal({ storeId, user }: CompleteProfileModalProps) {
    const dispatch = useAppDispatch();
    const router = useRouter();

    const hasEmail = Boolean(user.email?.trim());
    const hasPhone = Boolean(user.phone?.trim());

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [isPhoneValid, setIsPhoneValid] = useState(false);
    const [saving, setSaving] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const [error, setError] = useState("");

    // The contact they didn't sign in with is optional; checked only when filled in.
    const emailEntered = !hasEmail && email.trim() !== "";
    const phoneEntered = !hasPhone && !isPhoneEmpty(phone);
    const emailOk = !emailEntered || EMAIL_RE.test(email.trim());
    const phoneOk = !phoneEntered || isPhoneValid;
    const busy = saving || signingOut;
    const canSave = Boolean(name.trim()) && emailOk && phoneOk && !busy;

    const handleSave = async () => {
        if (!canSave) return;
        setError("");
        setSaving(true);
        try {
            const { firstName, lastName } = splitName(name);
            await dispatch(
                completeRegistration({
                    storeId,
                    registrationData: {
                        firstName,
                        lastName,
                        // The backend ignores an empty value and keeps what the account has.
                        email: emailEntered ? email.trim() : "",
                        ...(phoneEntered ? { phone: phone.replace(/\s/g, "") } : {}),
                    },
                })
            ).unwrap();
            // The account now has a name: Providers stops rendering this.
        } catch (err: unknown) {
            setError(typeof err === "string" ? err : "Couldn't save your name. Please try again.");
            setSaving(false);
        }
    };

    const handleSignOut = async () => {
        setSigningOut(true);
        await dispatch(logout({ storeId }));
        router.refresh();
    };

    const signedInAs = hasEmail && hasPhone ? `${user.email} · ${user.phone}` : hasEmail ? user.email : user.phone;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="complete-profile-title"
            className="fixed inset-0 z-[80] flex flex-col sm:flex-row items-end sm:items-center justify-center font-sans bg-black/40 sm:p-4"
        >
            <div className="bg-white w-full sm:max-w-[440px] rounded-t-[32px] sm:rounded-2xl shadow-2xl z-10 relative flex flex-col mt-auto sm:mt-0 max-h-[95vh] overflow-y-auto">
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-4 mb-2 sm:hidden shrink-0" />

                <div className="px-5 sm:px-8 pt-2 sm:pt-8 pb-4 shrink-0">
                    <h1 id="complete-profile-title" className="text-[20px] sm:text-[22px] font-bold text-gray-900 leading-tight tracking-tight">
                        Complete your profile
                    </h1>
                    <p className="text-[14px] text-gray-500 mt-1 font-medium">Add your name to finish setting up your account.</p>
                </div>

                <div className="px-5 sm:px-8 pb-6 sm:pb-8 flex flex-col">
                    <div className="flex flex-col gap-3 sm:gap-4 mb-5 sm:mb-6">
                        <div>
                            <label htmlFor="complete-profile-name" className="block text-[13px] font-semibold text-gray-700 mb-1.5 sm:mb-2">
                                Full Name
                            </label>
                            <input
                                id="complete-profile-name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") void handleSave();
                                }}
                                placeholder="Enter your full name"
                                autoComplete="name"
                                autoFocus
                                disabled={busy}
                                className="w-full bg-white border border-gray-200 rounded-[12px] px-4 h-[44px] text-[15px] sm:text-[14px] text-gray-900 outline-none focus:border-gray-900 transition-all shadow-sm"
                            />
                        </div>

                        {!hasEmail && (
                            <div>
                                <label htmlFor="complete-profile-email" className="block text-[13px] font-semibold text-gray-700 mb-1.5 sm:mb-2">
                                    Email Address <span className="font-normal text-gray-400">(optional)</span>
                                </label>
                                <input
                                    id="complete-profile-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email address"
                                    autoComplete="email"
                                    disabled={busy}
                                    className={`w-full bg-white border rounded-[12px] px-4 h-[44px] text-[15px] sm:text-[14px] text-gray-900 outline-none focus:border-gray-900 transition-all shadow-sm ${
                                        emailOk ? "border-gray-200" : "border-red-300 bg-red-50/10"
                                    }`}
                                />
                            </div>
                        )}

                        {!hasPhone && (
                            <div>
                                <label className="block text-[13px] font-semibold text-gray-700 mb-1.5 sm:mb-2">
                                    Phone Number <span className="font-normal text-gray-400">(optional)</span>
                                </label>
                                <div className={busy ? "opacity-70 pointer-events-none" : ""}>
                                    <PhoneInput value={phone} onChange={setPhone} onValidityChange={setIsPhoneValid} />
                                </div>
                            </div>
                        )}

                        {signedInAs && <p className="text-[13px] text-gray-500">Signed in as {signedInAs}</p>}
                    </div>

                    {error && (
                        <p className="text-[13px] text-red-600 font-medium mb-3 flex items-start gap-1.5">
                            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </p>
                    )}

                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!canSave}
                        className={`w-full h-[44px] rounded-[12px] flex items-center justify-center gap-2 font-bold text-[15px] transition-all duration-200 ${
                            canSave
                                ? "bg-[#191919] hover:bg-black text-white shadow-[0_12px_36px_rgba(0,0,0,0.2)] active:scale-[0.98]"
                                : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                        }`}
                    >
                        {saving ? "Saving..." : "Save"}
                    </button>

                    <button
                        type="button"
                        onClick={handleSignOut}
                        disabled={busy}
                        className="mt-4 self-center text-[13px] font-medium text-gray-500 hover:text-gray-800 hover:underline disabled:text-gray-300 disabled:no-underline"
                    >
                        {signingOut ? "Signing out..." : "Sign out"}
                    </button>
                </div>
            </div>
        </div>
    );
}
