"use client";

import { useState } from "react";
import { State } from "country-state-city";
import { LocateFixed } from "lucide-react";
import type { Address } from "@/redux/slices/userSlice";
import { reverseGeocode } from "@/lib/reverseGeocode";
import { splitName } from "./checkoutUtils";
import { countrySelectOptions, toCountryIso } from "./ui/countries";
import { PhoneInput } from "./ui/PhoneInput";
import { SearchableSelect } from "./ui/SearchableSelect";
import CheckoutHeader from "./CheckoutHeader";

function toStateIso(countryIso: string, isoOrName: string): string {
    if (!countryIso || !isoOrName) return "";
    const states = State.getStatesOfCountry(countryIso);
    const match = states.find((s) => s.isoCode === isoOrName || s.name.toLowerCase() === isoOrName.toLowerCase());
    return match?.isoCode ?? "";
}

function stateName(countryIso: string, iso: string): string {
    if (!iso) return "";
    return State.getStateByCodeAndCountry(iso, countryIso)?.name || iso;
}

interface AddAddressPanelProps {
    initial?: Address | null;
    saving?: boolean;
    onBack: () => void;
    onSave: (address: Omit<Address, "_id" | "addressId">) => Promise<void>;
    // ISO country a new address starts in (e.g. "AE" for a Jeebly store); an
    // address being edited keeps its own.
    defaultCountry?: string;
}

export default function AddAddressPanel({ initial, saving, onBack, onSave, defaultCountry }: AddAddressPanelProps) {
    const startCountry = toCountryIso(initial?.country || defaultCountry || "");
    const [house, setHouse] = useState(initial?.addressLine1 || "");
    const [area, setArea] = useState(initial?.addressLine2 || "");
    const [country, setCountry] = useState(startCountry);
    const [state, setState] = useState(() => toStateIso(startCountry, initial?.state || ""));
    const [city, setCity] = useState(initial?.city || "");
    const [pincode, setPincode] = useState(initial?.postalCode || "");
    const [name, setName] = useState([initial?.firstName, initial?.lastName].filter(Boolean).join(" "));
    const [phone, setPhone] = useState(initial?.phoneNumber || "");
    const [isPhoneValid, setIsPhoneValid] = useState(!!initial?.phoneNumber);
    const [isDefault, setIsDefault] = useState(initial?.isDefault || false);
    const [lat, setLat] = useState<number | undefined>(initial?.latitude);
    const [lng, setLng] = useState<number | undefined>(initial?.longitude);
    const [isFetchingLocation, setIsFetchingLocation] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);

    const availableStates = country ? State.getStatesOfCountry(country) : [];
    // UAE addresses have no postal code (the backend accepts them without one).
    const pincodeOptional = country === "AE";
    const canSave =
        house.trim() !== "" &&
        area.trim() !== "" &&
        country.trim() !== "" &&
        (availableStates.length === 0 || state.trim() !== "") &&
        city.trim() !== "" &&
        (pincodeOptional || pincode.trim() !== "") &&
        name.trim() !== "" &&
        isPhoneValid;

    const handleFetchLocation = () => {
        setLocationError(null);
        if (!navigator.geolocation) {
            setLocationError("Geolocation is not supported by your browser");
            return;
        }
        setIsFetchingLocation(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const result = await reverseGeocode(position.coords.latitude, position.coords.longitude);
                    if (!result) {
                        setLocationError("Could not fetch location details.");
                        return;
                    }
                    setLat(result.latitude);
                    setLng(result.longitude);
                    if (result.country) {
                        const iso = toCountryIso(result.country);
                        setCountry(iso);
                        if (result.state) setState(toStateIso(iso, result.state));
                    } else if (result.state) {
                        setState(toStateIso(country, result.state));
                    }
                    if (result.city) setCity(result.city);
                    if (result.pincode) setPincode(result.pincode);
                    if (result.area && !area) setArea(result.area);
                    if (result.house && !house) setHouse(result.house);
                } catch {
                    setLocationError("Failed to fetch location details.");
                } finally {
                    setIsFetchingLocation(false);
                }
            },
            (error) => {
                let errorMessage = "Unable to retrieve your location.";
                if (error.code === 1) errorMessage = "Location permission denied.";
                if (error.code === 2) errorMessage = "Location information is unavailable.";
                if (error.code === 3) errorMessage = "The request to get user location timed out.";
                setLocationError(errorMessage);
                setIsFetchingLocation(false);
            },
            { timeout: 10000 }
        );
    };

    const handleSave = async () => {
        if (!canSave) return;
        const { firstName, lastName } = splitName(name);
        await onSave({
            firstName,
            lastName,
            phoneNumber: phone.replace(/\s/g, ""),
            addressLine1: house.trim(),
            addressLine2: area.trim(),
            city: city.trim(),
            state: availableStates.length ? stateName(country, state) : state.trim(),
            country,
            postalCode: pincode.trim(),
            isDefault,
            latitude: lat,
            longitude: lng,
        });
    };

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <CheckoutHeader title={initial ? "Edit Address" : "Add New Address"} onBack={onBack} />

            <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 sm:py-6 flex flex-col gap-4 sm:gap-6">
                <button
                    type="button"
                    onClick={handleFetchLocation}
                    disabled={isFetchingLocation}
                    className="group w-full flex items-center justify-center gap-2.5 py-3.5 sm:py-4 bg-white text-gray-800 rounded-xl font-semibold hover:bg-gray-50 transition-all border border-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)] disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                    {isFetchingLocation ? (
                        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
                    ) : (
                        <LocateFixed className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform duration-300" size={20} />
                    )}
                    {isFetchingLocation ? "Locating..." : "Use current location"}
                </button>

                {locationError && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-100 font-medium">{locationError}</div>
                )}

                <div className="flex items-center gap-4 py-2">
                    <div className="flex-1 h-[1px] bg-gray-200" />
                    <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">Or enter manually</span>
                    <div className="flex-1 h-[1px] bg-gray-200" />
                </div>

                <input
                    value={house}
                    onChange={(e) => setHouse(e.target.value)}
                    placeholder="House/ Flat/ Office No."
                    className="w-full pb-3 text-base text-black placeholder-gray-500 border-b border-gray-200 focus:border-black focus:outline-none transition-colors"
                />
                <input
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="Area / Street / Locality"
                    className="w-full pb-3 text-base text-black placeholder-gray-500 border-b border-gray-200 focus:border-black focus:outline-none transition-colors"
                />
                <div className="flex gap-4">
                    <SearchableSelect
                        options={countrySelectOptions()}
                        value={country}
                        onChange={(c) => {
                            setCountry(c);
                            setState("");
                            setCity("");
                        }}
                        placeholder="Country"
                        className="w-full"
                    />
                    <SearchableSelect
                        options={availableStates.map((s) => ({ label: s.name, value: s.isoCode }))}
                        value={state}
                        onChange={(s) => {
                            setState(s);
                            setCity("");
                        }}
                        placeholder="State"
                        className="w-full"
                        disabled={!country || availableStates.length === 0}
                    />
                </div>
                <div className="flex gap-4">
                    <input
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="City"
                        className="w-full pb-3 text-base text-black placeholder-gray-500 border-b border-gray-200 focus:border-black focus:outline-none transition-colors"
                    />
                    <input
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value)}
                        placeholder={pincodeOptional ? "Postal code (optional)" : "Pincode"}
                        className="w-full pb-3 text-base text-black placeholder-gray-500 border-b border-gray-200 focus:border-black focus:outline-none transition-colors"
                    />
                </div>
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name"
                    className="w-full pb-3 text-base text-black placeholder-gray-500 border-b border-gray-200 focus:border-black focus:outline-none transition-colors"
                />

                <div className="pt-2">
                    <PhoneInput
                        value={phone}
                        onChange={setPhone}
                        onValidityChange={setIsPhoneValid}
                        selectedCountry={country || undefined}
                        className="w-full"
                        placeholder="Phone Number"
                    />
                </div>

                <label className="flex items-center gap-3 mt-4 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={isDefault}
                        onChange={(e) => setIsDefault(e.target.checked)}
                        className="w-5 h-5 rounded border-gray-400 text-black focus:ring-black accent-black"
                    />
                    <span className="text-gray-700 text-base font-medium">Use this as default address.</span>
                </label>
            </div>

            <div className="w-full p-4 sm:p-5 bg-white border-t border-gray-100 pb-6 sm:pb-5 mt-auto shrink-0 z-10">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={!canSave || saving}
                    className={`w-full py-[14px] sm:py-4 rounded-xl font-bold text-[16px] sm:text-lg flex items-center justify-center gap-2 transition-all ${
                        canSave && !saving
                            ? "bg-black text-white hover:bg-gray-900 active:scale-[0.98]"
                            : "bg-gray-200 text-gray-400 cursor-not-allowed"
                    }`}
                >
                    {saving ? "Saving..." : "Save Address"}
                </button>
            </div>
        </div>
    );
}
