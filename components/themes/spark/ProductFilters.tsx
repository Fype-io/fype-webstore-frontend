"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { ProductSortBy } from "@/types/storefront";
import { useStoreCurrency } from "@/components/shared/StoreCurrency";

const SORT_OPTIONS: Array<{ value: ProductSortBy; label: string }> = [
    { value: "newest", label: "Newest" },
    { value: "bestSelling", label: "Best Selling" },
    { value: "priceLowToHigh", label: "Price: Low to High" },
    { value: "priceHighToLow", label: "Price: High to Low" },
];

// Real per-store catalog + pagination, so filtering has to round-trip
// through the server (unlike the design reference's Shop.tsx, which filters
// a small hardcoded in-memory array client-side) — same URL-search-param
// pattern as theme_one's ProductFilters.tsx, restyled for Spark.
interface ProductFiltersProps {
    // Only applies when the URL has no `sortBy` yet — once a visitor picks
    // one, that choice (reflected in the URL) always wins.
    defaultSort?: ProductSortBy;
}

export default function ProductFilters({ defaultSort }: ProductFiltersProps) {
    const { symbol } = useStoreCurrency();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const minPrice = searchParams.get("minPrice") ?? "";
    const maxPrice = searchParams.get("maxPrice") ?? "";
    const sortBy = (searchParams.get("sortBy") as ProductSortBy) || (defaultSort ?? "newest");
    const search = searchParams.get("search") ?? "";

    const [searchInput, setSearchInput] = useState(search);
    const [tempMinPrice, setTempMinPrice] = useState(minPrice);
    const [tempMaxPrice, setTempMaxPrice] = useState(maxPrice);
    const [isPriceOpen, setIsPriceOpen] = useState(false);
    const [isSortOpen, setIsSortOpen] = useState(false);

    const filtersRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (filtersRef.current && !filtersRef.current.contains(event.target as Node)) {
                setIsPriceOpen(false);
                setIsSortOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const updateParams = (updates: Record<string, string | undefined>) => {
        const params = new URLSearchParams(searchParams.toString());
        Object.entries(updates).forEach(([key, value]) => {
            if (value) params.set(key, value);
            else params.delete(key);
        });
        params.delete("page");
        router.push(`${pathname}?${params.toString()}`);
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateParams({ search: searchInput || undefined });
    };

    const handleApplyPrice = () => {
        updateParams({ minPrice: tempMinPrice || undefined, maxPrice: tempMaxPrice || undefined });
        setIsPriceOpen(false);
    };

    const handleClearPrice = () => {
        setTempMinPrice("");
        setTempMaxPrice("");
        updateParams({ minPrice: undefined, maxPrice: undefined });
        setIsPriceOpen(false);
    };

    const hasActivePrice = !!(minPrice || maxPrice);
    const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Newest";

    return (
        <div className="w-full lg:w-auto flex flex-col md:flex-row items-center gap-3 text-sm font-medium z-30" ref={filtersRef}>
            <form onSubmit={handleSearchSubmit} className="relative w-full md:w-auto">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
                <input
                    type="text"
                    placeholder="Search products..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="w-full md:w-[280px] border border-gray-200 py-3 pl-10 pr-4 rounded-lg focus:outline-none focus:border-black transition-colors"
                />
            </form>

            <div className="flex items-center gap-3 relative w-full md:w-auto">
                <div className="relative isolate flex-1 md:flex-initial">
                    <button
                        type="button"
                        onClick={() => {
                            setIsPriceOpen(!isPriceOpen);
                            setIsSortOpen(false);
                        }}
                        className={`flex items-center justify-between gap-6 border px-4 py-3 rounded-lg transition-colors bg-white w-full md:w-[154px] ${
                            isPriceOpen ? "border-black" : "border-gray-200 hover:border-black"
                        }`}
                    >
                        <span>
                            Price
                            {hasActivePrice && <span className="ml-1.5 w-2 h-2 inline-block rounded-full bg-black" />}
                        </span>
                        <span className="material-symbols-outlined text-base">{isPriceOpen ? "expand_less" : "expand_more"}</span>
                    </button>

                    {isPriceOpen && (
                        <div className="absolute mt-2 left-0 z-30 w-[280px]">
                            <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-5">
                                <h4 className="font-bold text-base mb-4">Price Range</h4>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-sm text-gray-500 mb-1.5 block">Min Price ({symbol})</label>
                                        <input
                                            type="number"
                                            placeholder="0"
                                            value={tempMinPrice}
                                            onChange={(e) => setTempMinPrice(e.target.value)}
                                            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-black transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm text-gray-500 mb-1.5 block">Max Price ({symbol})</label>
                                        <input
                                            type="number"
                                            placeholder="Any"
                                            value={tempMaxPrice}
                                            onChange={(e) => setTempMaxPrice(e.target.value)}
                                            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-black transition-colors"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mt-6">
                                    <button onClick={handleClearPrice} className="py-2.5 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                                        Clear
                                    </button>
                                    <button onClick={handleApplyPrice} className="py-2.5 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-900 transition-colors">
                                        Apply
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="relative isolate flex-1 md:flex-initial">
                    <button
                        type="button"
                        onClick={() => {
                            setIsSortOpen(!isSortOpen);
                            setIsPriceOpen(false);
                        }}
                        className={`flex items-center justify-between gap-6 border px-4 py-3 rounded-lg transition-colors bg-white w-full md:w-[190px] ${
                            isSortOpen ? "border-black" : "border-gray-200 hover:border-black"
                        }`}
                    >
                        <span className="truncate">{currentSortLabel}</span>
                        <span className="material-symbols-outlined text-base">{isSortOpen ? "expand_less" : "expand_more"}</span>
                    </button>

                    {isSortOpen && (
                        <div className="absolute mt-2 right-0 z-30 w-full min-w-[200px]">
                            <div className="bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden py-2">
                                {SORT_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => {
                                            updateParams({ sortBy: option.value });
                                            setIsSortOpen(false);
                                        }}
                                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between"
                                    >
                                        <span className={sortBy === option.value ? "font-bold text-black" : "text-gray-600"}>{option.label}</span>
                                        {sortBy === option.value && <span className="material-symbols-outlined text-base">check</span>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
