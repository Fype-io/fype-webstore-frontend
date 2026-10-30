"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { suggestPlaces, type PlaceSuggestion } from "@/lib/placeSuggest";

// A city or area picked from Google's suggestions (through the backend). While
// suggestions are on, only a picked one is kept: text typed but not picked goes
// back to the last value when the field loses focus. When they're off (no key on
// the server, Google failing, a request failing) the field is plain free text,
// so no shopper is ever blocked.

const DEBOUNCE_MS = 300;
const MIN_QUERY = 2;

interface PlaceSearchSelectProps {
    kind: "city" | "area";
    /** ISO country code. */
    country: string;
    /** The state's ISO code. */
    state?: string;
    /** For an area: the city it's in. */
    city?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    className?: string;
    disabled?: boolean;
    onFocus?: () => void;
    onBlur?: () => void;
}

type Mode = "unknown" | "list" | "free";

export function PlaceSearchSelect({
    kind,
    country,
    state,
    city,
    value,
    onChange,
    placeholder,
    className = "",
    disabled = false,
    onFocus,
    onBlur,
}: PlaceSearchSelectProps) {
    const [mode, setMode] = useState<Mode>("unknown");
    const [text, setText] = useState(value);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
    const latest = useRef(0);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Show a value set from outside (cleared by a new state, filled by "Use current location").
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- the field mirrors the committed value
        setText(value);
    }, [value]);

    // Ask once per country/kind whether suggestions are on; Google isn't called for this.
    useEffect(() => {
        let cancelled = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reset while asking
        setMode("unknown");
        suggestPlaces({ kind, country })
            .then((r) => !cancelled && setMode(r.available ? "list" : "free"))
            .catch(() => !cancelled && setMode("free"));
        return () => {
            cancelled = true;
        };
    }, [kind, country]);

    useEffect(() => () => {
        if (timer.current) clearTimeout(timer.current);
    }, []);

    const search = (q: string) => {
        if (timer.current) clearTimeout(timer.current);
        const request = ++latest.current;
        if (q.trim().length < MIN_QUERY) {
            setSuggestions([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        timer.current = setTimeout(() => {
            suggestPlaces({ kind, country, state, city, q: q.trim() })
                .then((r) => {
                    if (request !== latest.current) return;
                    if (!r.available) {
                        setMode("free");
                        setOpen(false);
                        onChange(q);
                        return;
                    }
                    setSuggestions(r.suggestions);
                })
                .catch(() => {
                    if (request !== latest.current) return;
                    setMode("free");
                    setOpen(false);
                    onChange(q);
                })
                .finally(() => {
                    if (request === latest.current) setLoading(false);
                });
        }, DEBOUNCE_MS);
    };

    const pick = (s: PlaceSuggestion) => {
        latest.current++;
        setText(s.name);
        setSuggestions([]);
        setOpen(false);
        setLoading(false);
        onChange(s.name);
    };

    const listOn = mode === "list";

    return (
        <div className={`relative ${className}`}>
            <input
                value={text}
                onChange={(e) => {
                    const next = e.target.value;
                    setText(next);
                    if (listOn) {
                        setOpen(true);
                        search(next);
                    } else {
                        onChange(next);
                    }
                }}
                onFocus={() => {
                    if (listOn) setOpen(true);
                    onFocus?.();
                }}
                onBlur={() => {
                    // Only a picked suggestion is kept while the list is on.
                    if (listOn && text !== value) setText(value);
                    setOpen(false);
                    onBlur?.();
                }}
                placeholder={placeholder}
                disabled={disabled}
                autoComplete="off"
                role={listOn ? "combobox" : undefined}
                aria-expanded={listOn ? open : undefined}
                aria-autocomplete={listOn ? "list" : undefined}
                className={`w-full pb-3 text-base text-black placeholder-gray-500 border-b border-gray-200 focus:border-black focus:outline-none transition-colors ${disabled ? "opacity-50" : ""}`}
            />
            {listOn && open && text.trim().length >= MIN_QUERY && (
                <div
                    role="listbox"
                    className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto"
                >
                    {loading ? (
                        <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" size={16} /> Searching…
                        </div>
                    ) : suggestions.length > 0 ? (
                        suggestions.map((s) => (
                            <div
                                key={s.placeId}
                                role="option"
                                aria-selected={s.name === value}
                                // mousedown, not click: picks before the input's blur puts the old value back
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    pick(s);
                                }}
                                className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-gray-50 flex items-center justify-between gap-2 ${s.name === value ? "bg-gray-50" : ""}`}
                            >
                                <span className="min-w-0">
                                    <span className="font-medium text-black">{s.name}</span>
                                    {s.secondary && <span className="block text-xs text-gray-500 truncate">{s.secondary}</span>}
                                </span>
                                {s.name === value && <Check className="w-4 h-4 text-black shrink-0" size={16} />}
                            </div>
                        ))
                    ) : (
                        <div className="px-4 py-3 text-sm text-gray-500 text-center">
                            No {kind === "area" ? "areas" : "cities"} found - check the spelling
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
