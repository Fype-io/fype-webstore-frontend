"use client";

// Shared across all themes, not per-theme — sign-in is one consistent flow
// regardless of which theme a store is running (same reasoning as checkout).
// Visual reference: Fype-Generic-UI /sign-in (SignInPage).

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Mail, Phone, Send, X } from "lucide-react";
import { PhoneInput } from "@/components/checkout/ui/PhoneInput";
import { splitName } from "@/components/checkout/checkoutUtils";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { sendOTP, verifyOTP, completeRegistration, clearAuthError, getPlatform } from "@/redux/slices/userSlice";
import { isEditorPreview } from "@/lib/editor-preview";

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    storeId?: string;
    shopName?: string;
    platformName?: string;
}

type Step = "selection" | "input" | "otp" | "profile" | "success";
type Method = "email" | "phone";
type Channel = "email" | "whatsapp" | "sms";

function hasEmailChannel(channels: string[]) {
    return channels.includes("email");
}

function hasPhoneChannel(channels: string[]) {
    return channels.includes("whatsapp") || channels.includes("sms");
}

function phoneApiChannel(channels: string[]): Channel {
    if (channels.includes("whatsapp")) return "whatsapp";
    return "sms";
}

function phoneDeliveryCopy(channels: string[]) {
    const wa = channels.includes("whatsapp");
    const sms = channels.includes("sms");
    if (wa && sms) return "SMS or WhatsApp";
    if (wa) return "WhatsApp";
    return "SMS";
}

export default function AuthModal({ isOpen, onClose, storeId, shopName = "Store" }: AuthModalProps) {
    const dispatch = useAppDispatch();
    const { authLoading, authError, isAuthenticated, user, authChannels } = useAppSelector((state) => state.user);

    const [step, setStep] = useState<Step>("selection");
    const [method, setMethod] = useState<Method | null>(null);
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [isPhoneValid, setIsPhoneValid] = useState(false);
    const [name, setName] = useState("");
    const [otp, setOtp] = useState(["", "", "", ""]);
    const [localError, setLocalError] = useState("");
    const [resendCooldown, setResendCooldown] = useState(0);
    const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);

    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const verifyingRef = useRef(false);

    const emailEnabled = hasEmailChannel(authChannels);
    const phoneEnabled = hasPhoneChannel(authChannels);
    const multipleMethods = emailEnabled && phoneEnabled;
    const selectedChannel: Channel = method === "email" ? "email" : phoneApiChannel(authChannels);
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const displayError = localError || authError;

    const resetForm = (nextStep: Step, nextMethod: Method | null) => {
        setStep(nextStep);
        setMethod(nextMethod);
        setEmail("");
        setPhone("");
        setIsPhoneValid(false);
        setName("");
        setOtp(["", "", "", ""]);
        setLocalError("");
        setResendCooldown(0);
        setAttemptsLeft(null);
        verifyingRef.current = false;
    };

    const initialStepForChannels = (): { step: Step; method: Method | null } => {
        if (emailEnabled && phoneEnabled) return { step: "selection", method: null };
        if (emailEnabled) return { step: "input", method: "email" };
        if (phoneEnabled) return { step: "input", method: "phone" };
        return { step: "selection", method: null };
    };

    const handleSuccessfulAuth = () => {
        const next = initialStepForChannels();
        resetForm(next.step, next.method);
        onClose();
    };

    useEffect(() => {
        if (isOpen) {
            dispatch(clearAuthError());
            if (storeId) dispatch(getPlatform({ storeId }));
        }
    }, [isOpen, dispatch, storeId]);

    const [prevAuthChannels, setPrevAuthChannels] = useState(authChannels);
    if (authChannels !== prevAuthChannels) {
        setPrevAuthChannels(authChannels);
        if (isOpen && step !== "otp" && step !== "profile" && step !== "success") {
            const next = initialStepForChannels();
            setStep(next.step);
            setMethod(next.method);
        }
    }

    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    useEffect(() => {
        if (step === "otp") inputRefs.current[0]?.focus();
    }, [step]);

    useEffect(() => {
        if (!isAuthenticated || !isOpen || !user) return;
        // Name/profile is only for a brand-new customer. Existing shoppers
        // (phone or email) should land in the account even if the other
        // contact method is missing.
        if (user.isNew) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- advance the flow once login lands in the store
            setStep("profile");
            return;
        }
        setStep("success");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, user, isOpen]);

    useEffect(() => {
        if (step !== "success") return;
        const timer = setTimeout(() => handleSuccessfulAuth(), 900);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step]);

    const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
    if (isOpen !== prevIsOpen) {
        setPrevIsOpen(isOpen);
        if (!isOpen) {
            const next = initialStepForChannels();
            // eslint-disable-next-line react-hooks/refs -- reset on close during render (React's "adjust state on prop change" pattern)
            resetForm(next.step, next.method);
        }
    }

    if (!isOpen || isEditorPreview()) return null;

    const handleMethodSelect = (selected: Method) => {
        setMethod(selected);
        setLocalError("");
        setStep("input");
    };

    const handleBack = () => {
        setLocalError("");
        if (step === "input") {
            if (multipleMethods) {
                setStep("selection");
                setMethod(null);
            } else {
                onClose();
            }
        } else if (step === "otp") {
            setStep("input");
            setOtp(["", "", "", ""]);
            verifyingRef.current = false;
        }
    };

    const handleSendOTP = async () => {
        if (!storeId || !method) return;
        if (method === "email" && !isEmailValid) return;
        if (method === "phone" && !isPhoneValid) return;
        setLocalError("");
        try {
            const payload: { storeId: string; channel: Channel; email?: string; phoneNumber?: string } = {
                storeId,
                channel: selectedChannel,
            };
            if (method === "email") payload.email = email;
            else payload.phoneNumber = phone.replace(/\s/g, "");

            const result = await dispatch(sendOTP(payload)).unwrap();
            setResendCooldown(30);
            setAttemptsLeft(result.attemptsLeft || 3);
            setOtp(["", "", "", ""]);
            setStep("otp");
        } catch (err: unknown) {
            const message = typeof err === "string" ? err : "Failed to send OTP";
            setLocalError(message);
            if (message.includes("try again later")) setResendCooldown(60);
        }
    };

    const handleVerifyOTP = async (code: string) => {
        if (!storeId || !method || verifyingRef.current) return;
        if (code.length !== 4) {
            setLocalError("Please enter complete 4-digit OTP");
            return;
        }
        verifyingRef.current = true;
        setLocalError("");
        try {
            const payload: { storeId: string; otp: string; channel: Channel; email?: string; phoneNumber?: string } = {
                storeId,
                otp: code,
                channel: selectedChannel,
            };
            if (method === "email") payload.email = email;
            else payload.phoneNumber = phone.replace(/\s/g, "");
            await dispatch(verifyOTP(payload)).unwrap();
        } catch (err: unknown) {
            const message = typeof err === "string" ? err : "Invalid OTP";
            setLocalError(message);
            if (message.includes("attempts left")) {
                const match = message.match(/(\d+) attempts? left/);
                if (match) setAttemptsLeft(parseInt(match[1]));
            }
            setOtp(["", "", "", ""]);
            verifyingRef.current = false;
            if (message.includes("Maximum attempts exceeded") || message.includes("request a new OTP")) {
                setTimeout(() => {
                    setStep("input");
                    setOtp(["", "", "", ""]);
                    setResendCooldown(300);
                }, 2000);
            }
        }
    };

    const handleOtpChange = (index: number, value: string) => {
        if (value.length > 1) value = value.slice(-1);
        if (!/^\d*$/.test(value)) return;
        const next = [...otp];
        next[index] = value;
        setOtp(next);
        setLocalError("");
        if (value !== "" && index < 3) {
            inputRefs.current[index + 1]?.focus();
        } else if (value !== "" && index === 3) {
            inputRefs.current[index]?.blur();
            void handleVerifyOTP(next.join(""));
        }
    };

    const handleOtpKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleCompleteRegistration = async () => {
        if (!storeId) return;
        if (!name.trim() || !isEmailValid || !isPhoneValid) return;
        setLocalError("");
        try {
            const { firstName, lastName } = splitName(name);
            await dispatch(
                completeRegistration({
                    storeId,
                    registrationData: {
                        firstName,
                        lastName,
                        email,
                        phone: phone.replace(/\s/g, ""),
                    },
                })
            ).unwrap();
            setStep("success");
        } catch (err: unknown) {
            setLocalError(typeof err === "string" ? err : "Failed to complete registration");
        }
    };

    const handleResendOTP = async () => {
        if (resendCooldown > 0) return;
        setOtp(["", "", "", ""]);
        setLocalError("");
        verifyingRef.current = false;
        await handleSendOTP();
    };

    const canSend = method === "email" ? isEmailValid : isPhoneValid;
    const canCompleteProfile = Boolean(name.trim() && isEmailValid && phone && isPhoneValid);
    const showBack = step === "input" || step === "otp";

    const subtitle =
        step === "selection"
            ? "Choose an option to continue"
            : step === "input" && method
              ? `via ${method}`
              : step === "otp"
                ? "Verification Code"
                : step === "profile"
                  ? "Complete your profile"
                  : "";

    return (
        <div
            className="fixed inset-0 z-[70] flex flex-col sm:flex-row items-end sm:items-center justify-center font-sans bg-black/40 sm:p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget && !authLoading && step !== "profile") onClose();
            }}
        >
            <div className="bg-white w-full sm:max-w-[440px] rounded-t-[32px] sm:rounded-2xl shadow-2xl z-10 relative flex flex-col mt-auto sm:mt-0 max-h-[95vh] overflow-visible">
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-4 mb-2 sm:hidden shrink-0" />

                <div className="px-5 sm:px-8 pt-2 sm:pt-8 pb-4 flex items-start justify-between relative shrink-0">
                    <div className="flex gap-3 items-center">
                        {showBack && (
                            <button
                                type="button"
                                onClick={handleBack}
                                disabled={authLoading}
                                className="text-gray-400 hover:text-gray-700 transition-colors p-1.5 -ml-2 rounded-full hover:bg-gray-100"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                        )}
                        <div>
                            <h1 className="text-[20px] sm:text-[22px] font-bold text-gray-900 leading-tight tracking-tight">
                                Sign in to {shopName}
                            </h1>
                            {subtitle && (
                                <p className="text-[14px] sm:text-[15px] text-gray-500 mt-1 font-medium capitalize">{subtitle}</p>
                            )}
                        </div>
                    </div>
                    {step !== "success" && (
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={authLoading}
                            className="text-gray-400 hover:text-gray-700 transition-colors p-1 -mt-1 -mr-1"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
                <div className="h-px w-full bg-gray-100 mb-5 sm:mb-6 shrink-0" />

                <div className="px-5 sm:px-8 pb-6 sm:pb-8 flex-1 flex flex-col overflow-y-auto">
                    {step === "selection" && (
                        <div className="flex flex-col gap-3 flex-1">
                            {emailEnabled && (
                                <button
                                    type="button"
                                    onClick={() => handleMethodSelect("email")}
                                    className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all group"
                                >
                                    <div className="w-12 h-12 sm:w-10 sm:h-10 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all shrink-0">
                                        <Mail className="w-5 h-5 text-gray-700" />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-semibold text-[15px] text-gray-900">Email Address</div>
                                        <div className="text-[13px] text-gray-500 mt-0.5">Receive an OTP via email</div>
                                    </div>
                                </button>
                            )}
                            {phoneEnabled && (
                                <button
                                    type="button"
                                    onClick={() => handleMethodSelect("phone")}
                                    className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all group"
                                >
                                    <div className="w-12 h-12 sm:w-10 sm:h-10 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all shrink-0">
                                        <Phone className="w-5 h-5 text-gray-700" />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-semibold text-[15px] text-gray-900">Phone Number</div>
                                        <div className="text-[13px] text-gray-500 mt-0.5">
                                            Receive an OTP via {phoneDeliveryCopy(authChannels)}
                                        </div>
                                    </div>
                                </button>
                            )}
                        </div>
                    )}

                    {step === "input" && (
                        <div className="flex-1 flex flex-col">
                            <div className="mb-5 sm:mb-6 flex-1">
                                <label className="block text-[13px] font-semibold text-gray-700 mb-1.5 sm:mb-2 capitalize">
                                    {method === "email" ? "Email Address" : "Phone Number"}
                                </label>
                                {method === "email" ? (
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => {
                                            setEmail(e.target.value);
                                            setLocalError("");
                                        }}
                                        placeholder="Enter your email address"
                                        disabled={authLoading}
                                        className={`w-full bg-white border rounded-[12px] px-4 h-[44px] text-[15px] sm:text-[14px] text-gray-900 outline-none focus:border-gray-900 transition-all shadow-sm ${
                                            email && !isEmailValid ? "border-red-300 bg-red-50/10" : "border-gray-200"
                                        }`}
                                    />
                                ) : (
                                    <PhoneInput value={phone} onChange={setPhone} onValidityChange={setIsPhoneValid} />
                                )}
                                <p className="text-[13px] text-gray-500 mt-2 font-medium">
                                    You&apos;ll receive a 4-digit OTP via{" "}
                                    {method === "email" ? "Email" : phoneDeliveryCopy(authChannels)}
                                </p>
                            </div>
                            {displayError && <ErrorText message={displayError} />}
                            {resendCooldown > 0 && (
                                <p className="text-[13px] text-amber-700 font-medium mb-3">
                                    Please wait {resendCooldown}s before requesting a new OTP
                                </p>
                            )}
                            <button
                                type="button"
                                onClick={handleSendOTP}
                                disabled={authLoading || !canSend || resendCooldown > 0}
                                className={`w-full h-[44px] rounded-[12px] flex items-center justify-center gap-2 font-bold text-[15px] transition-all duration-200 ${
                                    canSend && !authLoading && resendCooldown === 0
                                        ? "bg-[#191919] hover:bg-black text-white shadow-[0_12px_36px_rgba(0,0,0,0.2)] active:scale-[0.98]"
                                        : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                                }`}
                            >
                                <Send className="w-5 h-5 sm:w-4 sm:h-4" />
                                {authLoading ? "Sending..." : "Send OTP"}
                            </button>
                        </div>
                    )}

                    {step === "otp" && (
                        <div className="flex-1 flex flex-col">
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-gray-50 rounded-full mx-auto flex items-center justify-center mb-4 border border-gray-100">
                                    {method === "email" ? (
                                        <Mail className="w-6 h-6 text-gray-600" />
                                    ) : (
                                        <Phone className="w-6 h-6 text-gray-600" />
                                    )}
                                </div>
                                <p className="text-[14px] text-gray-600 font-medium">
                                    Enter the 4-digit code sent to
                                    <br />
                                    <span className="font-bold text-gray-900 mt-1 block">
                                        {method === "email" ? email : phone}
                                    </span>
                                </p>
                            </div>

                            <div className="flex justify-center gap-3 sm:gap-4 mb-6">
                                {otp.map((digit, index) => (
                                    <input
                                        key={index}
                                        ref={(el) => {
                                            inputRefs.current[index] = el;
                                        }}
                                        type="text"
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        value={digit}
                                        onChange={(e) => handleOtpChange(index, e.target.value)}
                                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                        disabled={authLoading}
                                        className="w-12 h-12 sm:w-14 sm:h-14 bg-white border border-gray-200 rounded-[12px] text-center text-xl font-bold text-gray-900 outline-none focus:border-gray-900 transition-all shadow-sm disabled:bg-gray-50"
                                    />
                                ))}
                            </div>

                            {attemptsLeft !== null && attemptsLeft > 0 && (
                                <p className="text-[13px] text-gray-500 text-center mb-3">
                                    {attemptsLeft} {attemptsLeft === 1 ? "attempt" : "attempts"} remaining
                                </p>
                            )}
                            {displayError && <ErrorText message={displayError} />}
                            {authLoading && <p className="text-[13px] text-gray-500 text-center mb-3">Verifying...</p>}

                            <div className="text-center text-[13px] font-medium mt-auto sm:mt-0">
                                <span className="text-gray-500">Didn&apos;t receive the code? </span>
                                <button
                                    type="button"
                                    onClick={handleResendOTP}
                                    disabled={authLoading || resendCooldown > 0}
                                    className="text-[#191919] font-bold hover:underline disabled:text-gray-400 disabled:no-underline"
                                >
                                    {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : "Resend OTP"}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === "profile" && (
                        <div className="flex-1 flex flex-col">
                            <div className="flex flex-col gap-3 sm:gap-4 mb-5 sm:mb-6">
                                <div>
                                    <label className="block text-[13px] font-semibold text-gray-700 mb-1.5 sm:mb-2">
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Enter your full name"
                                        disabled={authLoading}
                                        className="w-full bg-white border border-gray-200 rounded-[12px] px-4 h-[44px] text-[15px] sm:text-[14px] text-gray-900 outline-none focus:border-gray-900 transition-all shadow-sm"
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                                        <label className="block text-[13px] font-semibold text-gray-700">Email Address</label>
                                        {method === "email" && (
                                            <button
                                                type="button"
                                                onClick={() => setStep("input")}
                                                className="text-[12px] font-bold text-blue-600 hover:underline"
                                            >
                                                Change
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Enter your email address"
                                        disabled={method === "email" || authLoading}
                                        className={`w-full border rounded-[12px] px-4 h-[44px] text-[15px] sm:text-[14px] text-gray-900 outline-none focus:border-gray-900 transition-all shadow-sm ${
                                            email && !isEmailValid ? "border-red-300 bg-red-50/10" : "border-gray-200"
                                        } ${method === "email" ? "bg-gray-50 text-gray-500 cursor-not-allowed" : "bg-white"}`}
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                                        <label className="block text-[13px] font-semibold text-gray-700">Phone Number</label>
                                        {method === "phone" && (
                                            <button
                                                type="button"
                                                onClick={() => setStep("input")}
                                                className="text-[12px] font-bold text-blue-600 hover:underline"
                                            >
                                                Change
                                            </button>
                                        )}
                                    </div>
                                    <div className={method === "phone" ? "opacity-70 pointer-events-none grayscale" : ""}>
                                        <PhoneInput value={phone} onChange={setPhone} onValidityChange={setIsPhoneValid} />
                                    </div>
                                </div>
                            </div>
                            {displayError && <ErrorText message={displayError} />}
                            <button
                                type="button"
                                onClick={handleCompleteRegistration}
                                disabled={authLoading || !canCompleteProfile}
                                className={`w-full h-[44px] rounded-[12px] flex items-center justify-center gap-2 font-bold text-[15px] transition-all duration-200 mt-auto sm:mt-4 ${
                                    canCompleteProfile && !authLoading
                                        ? "bg-[#191919] hover:bg-black text-white shadow-[0_12px_36px_rgba(0,0,0,0.2)] active:scale-[0.98]"
                                        : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                                }`}
                            >
                                {authLoading ? "Saving..." : "Complete Profile"}
                            </button>
                        </div>
                    )}

                    {step === "success" && (
                        <div className="flex flex-col items-center py-8 flex-1 justify-center">
                            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle2 className="w-8 h-8 text-green-600" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">Authentication success</h2>
                            <p className="text-gray-500 text-sm text-center">Logging you in...</p>
                        </div>
                    )}

                    {step !== "success" && (
                        <p className="text-center text-[12px] text-gray-500 mt-6 sm:mt-8 shrink-0">
                            By proceeding, I accept the{" "}
                            <Link href="/terms" className="text-blue-600 hover:underline font-medium">
                                T&amp;C
                            </Link>{" "}
                            and{" "}
                            <Link href="/privacy" className="text-blue-600 hover:underline font-medium">
                                Privacy Policy
                            </Link>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

function ErrorText({ message }: { message: string }) {
    return (
        <p className="text-[13px] text-red-600 font-medium mb-3 flex items-start gap-1.5">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{message}</span>
        </p>
    );
}
