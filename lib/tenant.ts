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

const API_TIMEOUT_MS = 5000;

// KV is only the fallback for when the API can't answer, so an entry can live
// long: it's rewritten as soon as a request sees the store change. Short TTLs
// meant a rewrite on every request, which ran through the KV write allowance.
const CACHE_TTL_SECONDS = 24 * 60 * 60;
// Rewrite a little before the entry expires, so it never lapses while in use.
const REWRITE_AFTER_MS = 23 * 60 * 60 * 1000;
// "Unpublished" is rewritten often (unpublished stores get little traffic, as
// they're gated): another instance may have written "published" since, and a
// stale "published" would open a password-protected store during an outage.
const UNPUBLISHED_REWRITE_AFTER_MS = 60 * 1000;
const MAX_REMEMBERED_TENANTS = 500;

type ApiResult = { kind: "found"; tenant: TenantInfo } | { kind: "not_found" } | { kind: "error" };

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

    // Only a 404 proves the host has no store. Anything else that isn't a 2xx
    // (5xx, 429 rate limiting, 408, ...) says nothing about the store, so KV is
    // still a valid answer.
    if (res.status === 404) return { kind: "not_found" };
    if (!res.ok) return { kind: "error" };

    type ShopResponse = { shopId?: string; themeId?: string; isPublished?: boolean };
    let json: { shop?: ShopResponse; data?: { shop?: ShopResponse } } & ShopResponse;
    try {
        json = (await res.json()) as typeof json;
    } catch {
        return { kind: "error" };
    }
    const shop = json.data?.shop ?? json.shop ?? json;
    // A 2xx without a shop is a malformed answer, not a "not found".
    if (!shop?.shopId) return { kind: "error" };

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

// What this Worker instance knows KV holds, per domain: the tenant and when it
// was written. Set only after a successful write, or after a KV read. Hosts
// with no store are never added, so a flood of random subdomains can't push
// real stores out. Oldest entry dropped past MAX_REMEMBERED_TENANTS.
type RememberedTenant = { tenant: TenantInfo; writtenAt: number };
const rememberedTenants = new Map<string, RememberedTenant>();
// Domains with a KV write/delete in flight in this instance.
const pendingDomains = new Set<string>();

type TenantCacheMetadata = { writtenAt?: number };

function remember(domain: string, tenant: TenantInfo, writtenAt: number): void {
    rememberedTenants.delete(domain);
    rememberedTenants.set(domain, { tenant, writtenAt });
    if (rememberedTenants.size > MAX_REMEMBERED_TENANTS) {
        const oldest = rememberedTenants.keys().next().value;
        if (oldest !== undefined) rememberedTenants.delete(oldest);
    }
}

function sameTenant(a: TenantInfo, b: TenantInfo): boolean {
    return (
        a.shopId === b.shopId &&
        a.storeDomain === b.storeDomain &&
        a.themeId === b.themeId &&
        (a.isPublished !== false) === (b.isPublished !== false)
    );
}

function isFresh(entry: RememberedTenant | undefined, tenant: TenantInfo, now: number): boolean {
    if (!entry || !sameTenant(entry.tenant, tenant)) return false;
    const maxAge = tenant.isPublished === false ? UNPUBLISHED_REWRITE_AFTER_MS : REWRITE_AFTER_MS;
    return now - entry.writtenAt < maxAge;
}

// Runs a KV task after the response when the Worker context allows it, so no
// request waits on KV; otherwise (local next dev) waits for it. At most one
// task per domain at a time: the domain is marked before the first await, so
// parallel requests in this instance don't all write.
async function runInBackground(
    domain: string,
    task: (kv: KVNamespace) => Promise<void>
): Promise<void> {
    if (pendingDomains.has(domain)) return;
    pendingDomains.add(domain);

    let kv: KVNamespace | undefined;
    let waitUntil: ((promise: Promise<unknown>) => void) | undefined;
    try {
        const { env, ctx } = await getCloudflareContext({ async: true });
        kv = env.FYPE_TENANT_CACHE;
        if (ctx && typeof ctx.waitUntil === "function") waitUntil = ctx.waitUntil.bind(ctx);
    } catch {
        // Local next dev may not have KV; password gating still works from the API.
        kv = undefined;
    }
    if (!kv) {
        pendingDomains.delete(domain);
        return;
    }

    const store = kv;
    const run = (async () => {
        try {
            await task(store);
        } catch {
            // A failed KV call is never remembered, so the next request retries.
        } finally {
            pendingDomains.delete(domain);
        }
    })();
    if (waitUntil) waitUntil(run);
    else await run;
}

// Brings KV in line with the API's answer, writing only when it differs.
async function syncTenantCache(domain: string, tenant: TenantInfo): Promise<void> {
    if (isFresh(rememberedTenants.get(domain), tenant, Date.now())) return;

    await runInBackground(domain, async (kv) => {
        const key = `tenant:${domain}`;
        // A fresh instance checks what KV already holds before writing. Only
        // for "published": a stale cached "published" read must never stop an
        // "unpublished" write, so that one is always written.
        if (tenant.isPublished !== false && !rememberedTenants.has(domain)) {
            // Throws if KV can't be read: no write, nothing remembered.
            const stored = await kv.getWithMetadata<TenantInfo, TenantCacheMetadata>(key, "json");
            const writtenAt = stored.metadata?.writtenAt ?? 0;
            const entry = stored.value?.shopId ? { tenant: stored.value, writtenAt } : undefined;
            if (entry && isFresh(entry, tenant, Date.now())) {
                remember(domain, tenant, writtenAt);
                return;
            }
        }
        const writtenAt = Date.now();
        await kv.put(key, JSON.stringify(tenant), {
            expirationTtl: CACHE_TTL_SECONDS,
            metadata: { writtenAt } satisfies TenantCacheMetadata,
        });
        remember(domain, tenant, writtenAt);
    });
}

// Deletes the KV entry for a host that lost its store, but only when this
// instance knows it wrote one: hosts with no store (bots trying random
// subdomains) cost no KV call. An entry no instance remembers expires on its
// own, and is never used while the API answers.
async function forgetTenantCache(domain: string): Promise<void> {
    if (!rememberedTenants.has(domain)) return;

    await runInBackground(domain, async (kv) => {
        await kv.delete(`tenant:${domain}`);
        rememberedTenants.delete(domain);
    });
}

// Tests only: clears what this instance remembers between tests.
export function resetTenantCacheMemoryForTests(): void {
    rememberedTenants.clear();
    pendingDomains.clear();
}

// Host -> API (publish state must be fresh) -> KV only if the backend can't
// answer (network error, timeout, any non-404 error status). A 404 is final: it
// is never overridden by a cached tenant, so a host that lost its store stops
// resolving at once. KV is written only when the answer changes (see
// syncTenantCache), in the background.
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
            await syncTenantCache(domain, result.tenant);
            return { status: "found", tenant: result.tenant };
        }
        if (result.kind === "not_found") {
            await forgetTenantCache(domain);
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
