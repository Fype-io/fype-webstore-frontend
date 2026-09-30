type HeaderSource = { get(name: string): string | null };

// The store lookup key for a request: the Host header, trimmed, lowercased,
// without the port or a trailing dot. "WWW.Shop.com.:443" and "www.shop.com"
// must resolve (and cache) as the same tenant.
export function getRequestHost(headers: HeaderSource): string {
    return (headers.get("host") ?? "")
        .trim()
        .toLowerCase()
        .replace(/:\d*$/, "")
        .replace(/\.+$/, "");
}
