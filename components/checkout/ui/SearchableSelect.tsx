"use client";

import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown } from "lucide-react";

interface SearchableSelectProps {
    options: { label: string; value: string }[];
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    className?: string;
    disabled?: boolean;
}

export function SearchableSelect({ options, value, onChange, placeholder, className = "", disabled = false }: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [position, setPosition] = useState<"bottom" | "top">("bottom");
    const [maxHeight, setMaxHeight] = useState(240);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const selectedOption = options.find((opt) => opt.value === value);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- show the selected label again when the list closes
        if (!isOpen) setSearch(selectedOption ? selectedOption.label : "");
    }, [isOpen, selectedOption]);

    useEffect(() => {
        if (isOpen && wrapperRef.current) {
            const rect = wrapperRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            if (spaceBelow < 200 && spaceAbove > spaceBelow) {
                setPosition("top");
                setMaxHeight(Math.min(200, Math.max(150, spaceAbove - 80)));
            } else {
                setPosition("bottom");
                setMaxHeight(Math.min(200, Math.max(150, spaceBelow - 20)));
            }
        }
    }, [isOpen]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredOptions = options.filter((opt) => opt.label.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            <div
                className={`w-full pb-3 border-b border-gray-200 flex items-center justify-between cursor-text ${disabled ? "opacity-50 pointer-events-none" : ""} transition-colors ${isOpen ? "border-black" : ""}`}
                onClick={() => {
                    if (!disabled) {
                        setIsOpen(true);
                        inputRef.current?.focus();
                    }
                }}
            >
                <input
                    ref={inputRef}
                    type="text"
                    className="w-full text-base outline-none bg-transparent placeholder-gray-500 text-black"
                    placeholder={placeholder}
                    value={isOpen ? search : selectedOption ? selectedOption.label : ""}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        if (!isOpen) setIsOpen(true);
                    }}
                    onFocus={(e) => {
                        e.target.select();
                        setIsOpen(true);
                    }}
                    disabled={disabled}
                />
                <ChevronDown
                    className={`w-4 h-4 text-gray-400 shrink-0 cursor-pointer transition-transform ${isOpen ? "rotate-180" : ""}`}
                    size={16}
                />
            </div>

            {isOpen && (
                <div
                    className={`absolute left-0 right-0 ${position === "top" ? "bottom-full mb-1" : "top-full mt-1"} bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden flex flex-col`}
                    style={{ maxHeight: `${maxHeight}px` }}
                >
                    <div className="overflow-y-auto flex-1 min-h-0">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt) => (
                                <div
                                    key={opt.value}
                                    className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-gray-50 flex items-center justify-between ${opt.value === value ? "bg-gray-50 font-medium" : ""}`}
                                    onClick={() => {
                                        onChange(opt.value);
                                        setSearch(opt.label);
                                        setIsOpen(false);
                                    }}
                                >
                                    <span>{opt.label}</span>
                                    {opt.value === value && <Check className="w-4 h-4 text-black" size={16} />}
                                </div>
                            ))
                        ) : (
                            <div className="px-4 py-3 text-sm text-gray-500 text-center">No results found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
