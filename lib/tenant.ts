import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getApiBaseUrl } from "@/lib/api-base-url";

export type TenantInfo = {
    shopId: string;
    storeDomain: string;
    themeId: string;
    isPublished: boolean;
};

// found: the API (or, if it's unreachable, KV) knows this host.
// not_found: the API says no store owns this host - never answered from KV.
// unavailable: the API couldn't answer and KV has nothing either.
export type TenantLookup =
    | { status: "found"; tenant: TenantInfo }
    | { status: "not_found" }
    | { status: "unavailable" };

const CACHE_TTL_SECONDS = 300;
const API_TIMEOUT_MS = 5000;

type ApiResult = { kind: "found"; tenant: TenantInfo } | { kind: "not_found"; deleteCache: boolean } | { kind: "error" };

async function fetchTenantFromApi(domain: string, apiBaseUrl: string): Promise<ApiResult> {
    let res: Response;
    try {
        res = await fetch(`${apiBaseUrl}/commerce/shops/by-domain?domain=${encodeURIComponent(domain)}`, {
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            signal: AbortSignal.timeout(API_TIMEOUT_MS),
        });
    } catch {
        // Network error or timeout.
        return { kind: "error" };
    }

    if (res.status >= 500) return { kind: "error" };
    // Only a 404 proves the host has no store; drop any stale KV entry for it.
    if (res.status === 404) return { kind: "not_found", deleteCache: true };
    if (!res.ok) return { kind: "not_found", deleteCache: false };

    type ShopResponse = { shopId?: string; themeId?: string; isPublished?: boolean };
    let json: { shop?: ShopResponse; data?: { shop?: ShopResponse } } & ShopResponse;
    try {
        json = (await res.json()) as typeof json;
    } catch {
        return { kind: "error" };
    }
    const shop = json.data?.shop ?? json.shop ?? json;
    if (!shop?.shopId) return { kind: "not_found", deleteCache: false };

    return {
        kind: "found",
        tenant: {
            shopId: shop.shopId,
            storeDomain: domain,
            themeId: shop.themeId ?? "theme_one",
            isPublished: shop.isPublished !== false,
        },
    };
}

async function readTenantCache(domain: string): Promise<TenantInfo | null> {
    try {
        const { env } = await getCloudflareContext({ async: true });
        const cached = await env.FYPE_TENANT_CACHE.get<TenantInfo>(`tenant:${domain}`, "json");
        if (!cached?.shopId) return null;
        return cached;
    } catch {
        return null;
    }
}

async function writeTenantCache(domain: string, tenant: TenantInfo): Promise<void> {
    try {
        const { env } = await getCloudflareContext({ async: true });
        await env.FYPE_TENANT_CACHE.put(`tenant:${domain}`, JSON.stringify(tenant), {
            expirationTtl: tenant.isPublished === false ? 30 : CACHE_TTL_SECONDS,
        });
    } catch {
        // Local next dev may not have KV; password gating still works from the API.
    }
}

async function deleteTenantCache(domain: string): Promise<void> {
    try {
        const { env } = await getCloudflareContext({ async: true });
        await env.FYPE_TENANT_CACHE.delete(`tenant:${domain}`);
    } catch {
        // Local next dev may not have KV.
    }
}

// Host -> API (publish state must be fresh) -> KV only if the backend can't
// answer (network error, timeout, 5xx). A 404 is final: it is never overridden
// by a cached tenant, so a host that lost its store stops resolving at once.
// Called from middleware, so this must stay edge-safe.
export async function resolveTenant(domain: string): Promise<TenantLookup> {
    let apiBaseUrl: string | null = null;
    try {
        apiBaseUrl = await getApiBaseUrl();
    } catch {
        apiBaseUrl = null;
    }

    if (apiBaseUrl) {
        const result = await fetchTenantFromApi(domain, apiBaseUrl);
        if (result.kind === "found") {
            await writeTenantCache(domain, result.tenant);
            return { status: "found", tenant: result.tenant };
        }
        if (result.kind === "not_found") {
            if (result.deleteCache) await deleteTenantCache(domain);
            return { status: "not_found" };
        }
    }

    const cached = await readTenantCache(domain);
    if (!cached?.shopId) return { status: "unavailable" };
    return {
        status: "found",
        tenant: { ...cached, isPublished: cached.isPublished !== false },
    };
}
