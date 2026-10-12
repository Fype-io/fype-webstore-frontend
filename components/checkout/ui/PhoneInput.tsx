"use client";

import { useEffect, useMemo, useState } from "react";
import { AsYouType, parsePhoneNumberFromString, type CountryCode, getCountries, getCountryCallingCode } from "libphonenumber-js";
import { Dropdown, DropdownItem } from "./Dropdown";
import { AlertCircle, CheckCircle2, ChevronDown } from "lucide-react";

const getFlagEmoji = (countryCode: string) => {
    const codePoints = countryCode
        .toUpperCase()
        .split("")
        .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
};

const ALL_COUNTRIES = getCountries()
    .map((iso) => ({
        name: new Intl.DisplayNames(["en"], { type: "region" }).of(iso) || iso,
        code: `+${getCountryCallingCode(iso)}`,
        flag: getFlagEmoji(iso),
        iso: iso as string,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

interface PhoneInputProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
    label?: string;
    placeholder?: string;
    selectedCountry?: string;
    onValidityChange?: (isValid: boolean) => void;
}

export function PhoneInput({
    value,
    onChange,
    className,
    label,
    placeholder = "00000 00000",
    selectedCountry,
    onValidityChange,
}: PhoneInputProps) {
    const initialCountryInfo = useMemo(() => {
        if (value.startsWith("+")) {
            const asYouType = new AsYouType();
            asYouType.input(value);
            const iso = asYouType.getCountry();
            if (iso) {
                const country = ALL_COUNTRIES.find((c) => c.iso === iso);
                if (country) {
                    return {
                        iso: iso as CountryCode,
                        code: country.code,
                        flag: country.flag,
                        phone: value.replace(country.code, "").trim(),
                    };
                }
            }
        }
        return { iso: "IN" as CountryCode, code: "+91", flag: "🇮🇳", phone: value };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const [phoneNumber, setPhoneNumber] = useState(initialCountryInfo.phone);
    const [countryCode, setCountryCode] = useState(initialCountryInfo.code);
    const [countryFlag, setCountryFlag] = useState(initialCountryInfo.flag);
    const [countryIso, setCountryIso] = useState<CountryCode>(initialCountryInfo.iso);
    const [countrySearch, setCountrySearch] = useState("");
    const [isValid, setIsValid] = useState<boolean | null>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    useEffect(() => {
        if (selectedCountry && selectedCountry !== countryIso) {
            const found = ALL_COUNTRIES.find((c) => c.iso === selectedCountry);
            if (found) {
                // eslint-disable-next-line react-hooks/set-state-in-effect -- follow the parent's selectedCountry prop
                setCountryIso(found.iso as CountryCode);
                setCountryCode(found.code);
                setCountryFlag(found.flag);
            }
        }
    }, [selectedCountry, countryIso]);

    const filteredCountries = useMemo(() => {
        if (!countrySearch) return ALL_COUNTRIES;
        const search = countrySearch.toLowerCase();
        return ALL_COUNTRIES.filter(
            (c) => c.name.toLowerCase().includes(search) || c.code.includes(search) || c.iso.toLowerCase().includes(search)
        );
    }, [countrySearch]);

    const validatePhone = (phoneStr: string, iso: CountryCode, code: string) => {
        if (!phoneStr) {
            setIsValid(null);
            return;
        }
        try {
            const fullStr = phoneStr.startsWith("+") ? phoneStr : `${code}${phoneStr}`;
            const parsed = parsePhoneNumberFromString(fullStr, iso);
            setIsValid(parsed ? parsed.isValid() : false);
        } catch {
            setIsValid(false);
        }
    };

    const handlePhoneChange = (inputValue: string) => {
        const cleaned = inputValue.replace(/[^\d+]/g, "");

        if (cleaned.startsWith("+")) {
            const asYouType = new AsYouType();
            asYouType.input(cleaned);
            const detectedIso = asYouType.getCountry();
            if (detectedIso) {
                const found = ALL_COUNTRIES.find((c) => c.iso === detectedIso);
                if (found) {
                    setCountryIso(detectedIso as CountryCode);
                    setCountryCode(found.code);
                    setCountryFlag(found.flag);
                    const formatted = asYouType.input(cleaned);
                    const numberPart = formatted.replace(found.code, "").trim();
                    setPhoneNumber(numberPart);
                    validatePhone(numberPart, detectedIso as CountryCode, found.code);
                    onChange(`${found.code}${numberPart}`);
                    return;
                }
            }
        }

        const asYouType = new AsYouType(countryIso);
        const formatted = asYouType.input(cleaned);
        setPhoneNumber(formatted);
        validatePhone(formatted, countryIso, countryCode);
        onChange(`${countryCode}${formatted}`);
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- revalidate the number when the country changes
        validatePhone(phoneNumber, countryIso, countryCode);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [countryIso, countryCode]);

    useEffect(() => {
        onValidityChange?.(isValid === true);
    }, [isValid, onValidityChange]);

    return (
        <div className={className}>
            {label && (
                <div className="flex items-center justify-between" style={{ marginBottom: "6px" }}>
                    <label className="text-[13px] font-medium text-[#555]">{label}</label>
                    {isValid !== null && (
                        <span className={`text-[11px] font-semibold flex items-center gap-1 ${isValid ? "text-emerald-600" : "text-red-500"}`}>
                            {isValid ? (
                                <>
                                    <CheckCircle2 size={12} /> Valid Number
                                </>
                            ) : (
                                <>
                                    <AlertCircle size={12} /> Invalid Number
                                </>
                            )}
                        </span>
                    )}
                </div>
            )}
            <div
                className={`flex items-center w-full h-[44px] bg-white border border-gray-200 rounded-[12px] transition-all focus-within:border-gray-900 ${isValid === false ? "border-red-300 bg-red-50/10" : ""}`}
            >
                <div className="z-10 shrink-0 h-full border-r border-gray-200">
                    <Dropdown
                        trigger={
                            <div
                                className="inline-flex items-center gap-2 h-full px-3 py-2 text-[15px] sm:text-[14px] font-medium text-[#222] hover:bg-gray-50 focus:outline-none transition-colors cursor-text rounded-l-xl"
                                onClick={() => {
                                    if (!isDropdownOpen) {
                                        setIsDropdownOpen(true);
                                        setCountrySearch("");
                                    }
                                }}
                            >
                                <span className="text-lg leading-none">{countryFlag}</span>
                                <input
                                    type="text"
                                    className={`w-[44px] font-medium bg-transparent outline-none focus:ring-0 p-0 border-none text-[#222] placeholder-gray-400 ${isDropdownOpen ? "text-[12px]" : "text-[15px] sm:text-[14px]"}`}
                                    value={isDropdownOpen ? countrySearch : countryCode}
                                    placeholder={isDropdownOpen ? "Search" : countryCode}
                                    onChange={(e) => {
                                        setCountrySearch(e.target.value);
                                        if (!isDropdownOpen) setIsDropdownOpen(true);
                                    }}
                                    onFocus={() => {
                                        if (!isDropdownOpen) {
                                            setIsDropdownOpen(true);
                                            setCountrySearch("");
                                        }
                                    }}
                                />
                                <ChevronDown
                                    size={14}
                                    className="text-[#888] cursor-pointer"
                                />
                            </div>
                        }
                        className="w-64"
                        closeOnClick={false}
                        isOpen={isDropdownOpen}
                        onOpenChange={(open) => {
                            setIsDropdownOpen(open);
                            if (!open) setCountrySearch("");
                        }}
                        maxDropdownHeight={200}
                    >
                        <div className="flex flex-col flex-1 min-h-0 w-64 bg-white">
                            <div className="overflow-y-auto py-1 flex-1">
                                {filteredCountries.length > 0 ? (
                                    filteredCountries.map((c) => (
                                        <DropdownItem
                                            key={c.iso}
                                            closeOnClick
                                            onClick={() => {
                                                setCountryCode(c.code);
                                                setCountryFlag(c.flag);
                                                setCountryIso(c.iso as CountryCode);
                                                setCountrySearch("");
                                                setIsDropdownOpen(false);
                                            }}
                                        >
                                            <div className="flex items-center justify-between w-full py-1">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-lg">{c.flag}</span>
                                                    <div className="flex flex-col">
                                                        <span className="text-[13px] font-medium text-[#222] leading-tight">{c.name}</span>
                                                        <span className="text-[11px] text-[#888] uppercase">{c.iso}</span>
                                                    </div>
                                                </div>
                                                <span className="text-[12px] font-medium text-[#666]">{c.code}</span>
                                            </div>
                                        </DropdownItem>
                                    ))
                                ) : (
                                    <div className="px-4 py-6 text-center">
                                        <p className="text-[13px] text-[#888]">No countries found</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Dropdown>
                </div>
                <div className="relative flex-1 h-full">
                    <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        className="block w-full h-full px-4 text-[15px] sm:text-[14px] text-[#222] bg-transparent focus:ring-0 outline-none rounded-r-[12px] placeholder:text-[#aaa]"
                        style={{ border: "none", outline: "none", boxShadow: "none", backgroundColor: "transparent" }}
                        placeholder={placeholder}
                    />
                </div>
            </div>
        </div>
    );
}
