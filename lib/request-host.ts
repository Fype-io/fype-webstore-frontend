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

// The public origin of a request, e.g. "https://shop.example.com": https in production
// (the Worker sits behind TLS), http in development. Used for absolute URLs in the
// sitemap, canonical links and structured data.
export function getRequestOrigin(headers: HeaderSource): string {
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    return `${protocol}://${headers.get("host") ?? ""}`;
}
