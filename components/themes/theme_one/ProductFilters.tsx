"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Category, ProductSortBy } from "@/types/storefront";
import { useStoreCurrency } from "@/components/shared/StoreCurrency";

interface ProductFiltersProps {
    categories: Category[];
}


function FilterButton({
    label,
    onClick,
    isOpen,
    hasActiveFilters,
}: {
    label: string;
    onClick?: () => void;
    isOpen?: boolean;
    hasActiveFilters?: boolean;
}) {
    return (
        <button
            className={`flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-lg border pl-4 pr-2 transition-colors ${
                hasActiveFilters ? "bg-black text-white border-black hover:opacity-90" : "bg-white border-gray-300 hover:bg-gray-50"
            }`}
            onClick={onClick}
            aria-expanded={isOpen}
        >
            <p className="text-sm font-medium">{label}</p>
            <svg className={`w-5 h-5 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </button>
    );
}

export default function ProductFilters({ categories }: ProductFiltersProps) {
    const { symbol } = useStoreCurrency();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const selectedCategories = searchParams.get("category")?.split(",").filter(Boolean) ?? [];
    const minPrice = searchParams.get("minPrice") ?? "";
    const maxPrice = searchParams.get("maxPrice") ?? "";
    const sortBy = (searchParams.get("sortBy") as ProductSortBy) || "newest";
    const search = searchParams.get("search") ?? "";

    const [searchInput, setSearchInput] = useState(search);
    const [tempMinPrice, setTempMinPrice] = useState(minPrice);
    const [tempMaxPrice, setTempMaxPrice] = useState(maxPrice);
    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
    const [isPriceDropdownOpen, setIsPriceDropdownOpen] = useState(false);

    const categoryDropdownRef = useRef<HTMLDivElement>(null);
    const priceDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
                setIsCategoryDropdownOpen(false);
            }
            if (priceDropdownRef.current && !priceDropdownRef.current.contains(event.target as Node)) {
                setIsPriceDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Debounced search — pushes to the URL 300ms after typing stops.
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchInput !== search) pushFilters({ search: searchInput || null, page: null });
        }, 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchInput]);

    function pushFilters(updates: Record<string, string | null>) {
        const params = new URLSearchParams(searchParams.toString());
        for (const [key, value] of Object.entries(updates)) {
            if (value === null || value === "") params.delete(key);
            else params.set(key, value);
        }
        router.push(`${pathname}?${params.toString()}`);
    }

    const handleCategoryToggle = (categorySlug: string) => {
        const next = selectedCategories.includes(categorySlug)
            ? selectedCategories.filter((c) => c !== categorySlug)
            : [...selectedCategories, categorySlug];
        pushFilters({ category: next.length > 0 ? next.join(",") : null, page: null });
    };

    const handlePriceRangeApply = () => {
        const min = tempMinPrice ? parseFloat(tempMinPrice) : undefined;
        const max = tempMaxPrice ? parseFloat(tempMaxPrice) : undefined;

        if ((min !== undefined && min < 0) || (max !== undefined && max < 0)) {
            alert("Price cannot be negative");
            return;
        }
        if (min !== undefined && max !== undefined && min > max) {
            alert("Minimum price cannot be greater than maximum price");
            return;
        }

        pushFilters({
            minPrice: min !== undefined ? String(min) : null,
            maxPrice: max !== undefined ? String(max) : null,
            page: null,
        });
        setIsPriceDropdownOpen(false);
    };

    const handlePriceRangeClear = () => {
        setTempMinPrice("");
        setTempMaxPrice("");
        pushFilters({ minPrice: null, maxPrice: null, page: null });
        setIsPriceDropdownOpen(false);
    };

    const handleClearAllFilters = () => {
        setSearchInput("");
        setTempMinPrice("");
        setTempMaxPrice("");
        router.push(pathname);
    };

    const hasActiveFilters = selectedCategories.length > 0 || !!minPrice || !!maxPrice || !!search;

    return (
        <>
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search products..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                />
            </div>

            <div className="flex flex-wrap gap-3 mb-6">
                {categories.length > 0 && (
                    <div className="relative" ref={categoryDropdownRef}>
                        <FilterButton
                            label={`Categories ${selectedCategories.length > 0 ? `(${selectedCategories.length})` : ""}`}
                            onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                            isOpen={isCategoryDropdownOpen}
                            hasActiveFilters={selectedCategories.length > 0}
                        />

                        {isCategoryDropdownOpen && (
                            <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                                <div className="p-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="font-semibold text-sm">Categories</h3>
                                        {selectedCategories.length > 0 && (
                                            <button
                                                onClick={() => pushFilters({ category: null, page: null })}
                                                className="text-xs text-black hover:underline"
                                            >
                                                Clear all
                                            </button>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        {categories.map((category) => (
                                            <label key={category.slug} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCategories.includes(category.slug)}
                                                    onChange={() => handleCategoryToggle(category.slug)}
                                                    className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
                                                />
                                                <span className="text-sm">{category.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="relative" ref={priceDropdownRef}>
                    <FilterButton
                        label={minPrice || maxPrice ? `Price (${symbol}${minPrice || 0} - ${symbol}${maxPrice || "∞"})` : "Price"}
                        onClick={() => setIsPriceDropdownOpen(!isPriceDropdownOpen)}
                        isOpen={isPriceDropdownOpen}
                        hasActiveFilters={!!minPrice || !!maxPrice}
                    />

                    {isPriceDropdownOpen && (
                        <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-300 rounded-lg shadow-lg z-50">
                            <div className="p-4">
                                <h3 className="font-semibold text-sm mb-3">Price Range</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs text-gray-600 mb-1">Min Price ({symbol})</label>
                                        <input
                                            type="number"
                                            value={tempMinPrice}
                                            onChange={(e) => setTempMinPrice(e.target.value)}
                                            placeholder="0"
                                            min="0"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-600 mb-1">Max Price ({symbol})</label>
                                        <input
                                            type="number"
                                            value={tempMaxPrice}
                                            onChange={(e) => setTempMaxPrice(e.target.value)}
                                            placeholder="Any"
                                            min="0"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-sm"
                                        />
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                        <button onClick={handlePriceRangeClear} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">
                                            Clear
                                        </button>
                                        <button onClick={handlePriceRangeApply} className="flex-1 px-3 py-2 bg-black text-white rounded-lg text-sm font-medium hover:opacity-90">
                                            Apply
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <select
                    value={sortBy}
                    onChange={(e) => pushFilters({ sortBy: e.target.value, page: null })}
                    className="h-10 px-4 rounded-lg bg-white border border-gray-300 text-sm font-medium hover:bg-gray-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-black"
                >
                    <option value="newest">Newest</option>
                    <option value="bestSelling">Best Selling</option>
                    <option value="priceLowToHigh">Price: Low to High</option>
                    <option value="priceHighToLow">Price: High to Low</option>
                </select>

                {hasActiveFilters && (
                    <button onClick={handleClearAllFilters} className="h-10 px-4 rounded-lg bg-red-50 text-red-600 border border-red-200 text-sm font-medium hover:bg-red-100">
                        Clear All Filters
                    </button>
                )}
            </div>

            {hasActiveFilters && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-gray-700">Active Filters:</span>

                        {selectedCategories.map((catSlug) => {
                            const category = categories.find((c) => c.slug === catSlug);
                            return category ? (
                                <span key={catSlug} className="px-3 py-1 bg-black text-white rounded-full text-sm flex items-center gap-2">
                                    {category.name}
                                    <button onClick={() => handleCategoryToggle(catSlug)} className="hover:text-gray-200 font-bold">
                                        ×
                                    </button>
                                </span>
                            ) : null;
                        })}

                        {(minPrice || maxPrice) && (
                            <span className="px-3 py-1 bg-black text-white rounded-full text-sm flex items-center gap-2">
                                Price: {symbol}{minPrice || 0} - {symbol}{maxPrice || "∞"}
                                <button onClick={handlePriceRangeClear} className="hover:text-gray-200 font-bold">
                                    ×
                                </button>
                            </span>
                        )}

                        {search && (
                            <span className="px-3 py-1 bg-black text-white rounded-full text-sm flex items-center gap-2">
                                Search: &quot;{search}&quot;
                                <button
                                    onClick={() => {
                                        setSearchInput("");
                                        pushFilters({ search: null, page: null });
                                    }}
                                    className="hover:text-gray-200 font-bold"
                                >
                                    ×
                                </button>
                            </span>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
