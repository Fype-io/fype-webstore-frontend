"use client";

import { createContext, useContext, useMemo } from "react";
import { currencyLocale, currencyPrefix, currencySymbol, formatPrice, storeCurrencyCode } from "@/lib/currency";

// The store's currency for client components. Set once in Providers from the
// shop's public settings; server components get it as a prop instead (they
// can't read context). See lib/currency.ts for the display rules.

const StoreCurrencyContext = createContext<string | null>(null);

export function StoreCurrencyProvider({ currency, children }: { currency?: string | null; children: React.ReactNode }) {
    return <StoreCurrencyContext.Provider value={currency ?? null}>{children}</StoreCurrencyContext.Provider>;
}

export function useStoreCurrency() {
    const currency = useContext(StoreCurrencyContext);
    return useMemo(() => ({
        currency: storeCurrencyCode(currency),
        prefix: currencyPrefix(currency),
        symbol: currencySymbol(currency),
        locale: currencyLocale(currency),
        format: (amount: number | string | null | undefined, decimals?: number) => formatPrice(amount, currency, decimals),
    }), [currency]);
}
