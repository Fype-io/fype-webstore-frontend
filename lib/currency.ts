// Store currency display. One currency per store (INR, USD or AED), set by the
// merchant and returned in public settings as `currency` (null when the store
// hasn't set one - those stores show INR, as before).
//
// Amounts show with the currency's sign, or its ISO code when it has no common
// sign: "₹1,299", "$1,299", "AED 1,299" (the code, not the Arabic "د.إ", same as
// the admin). Safe to use from server and client components.

export const CURRENCY_LOCALE: Record<string, string> = { INR: "en-IN", USD: "en-US", AED: "en-AE" };
const CURRENCY_SYMBOL: Record<string, string> = { INR: "₹", USD: "$", AED: "AED" };

export function storeCurrencyCode(currency?: string | null): string {
    const code = (currency || "").toUpperCase();
    return CURRENCY_SYMBOL[code] ? code : "INR";
}

/** Number locale for the currency (Indian digit grouping for INR). */
export function currencyLocale(currency?: string | null): string {
    return CURRENCY_LOCALE[storeCurrencyCode(currency)] ?? "en-IN";
}

/** "₹", "$" or "AED" - for labels such as "Min Price (₹)". */
export function currencySymbol(currency?: string | null): string {
    return CURRENCY_SYMBOL[storeCurrencyCode(currency)] ?? "₹";
}

/** What goes right before an amount: "₹", "$", or "AED " (a code gets a space). */
export function currencyPrefix(currency?: string | null): string {
    const symbol = currencySymbol(currency);
    return /^[A-Za-z]+$/.test(symbol) ? `${symbol} ` : symbol;
}

/**
 * An amount in the store's currency with digit grouping: "₹1,299", "₹1,299.5"
 * (up to 2 decimals, none when whole), or a fixed number of decimals.
 */
export function formatPrice(amount: number | string | null | undefined, currency?: string | null, decimals?: number): string {
    const value = Number(amount ?? 0);
    const safe = Number.isFinite(value) ? value : 0;
    const number = safe.toLocaleString(currencyLocale(currency), decimals === undefined
        ? { maximumFractionDigits: 2 }
        : { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return `${currencyPrefix(currency)}${number}`;
}
