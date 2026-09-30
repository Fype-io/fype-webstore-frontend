# Runbook: route custom hostnames to the storefront Worker (`*/*`)

**Why:** merchant custom hostnames (Cloudflare for SaaS, e.g. `www.zalloperfumes.com`) match
none of the production routes (`shops.fypestore.com/*`, `*.fypestore.com/*`), so Cloudflare
skips the Worker and tries the fallback origin's own server, which returns **522**. Cloudflare's
fix is a `*/*` route on the SaaS zone
([Worker as fallback origin](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/advanced-settings/worker-as-origin/)).

**Scope:** production `storefront-next` Worker, zone `fypestore.com`. Staging gets no `*/*`.

Nothing here has been run yet.

## How routes decide (what this relies on)

- Cloudflare: *"When more than one route pattern could match a request URL, the most specific
  route pattern wins."* ([Routes](https://developers.cloudflare.com/workers/configuration/routing/routes/)).
  The docs show `www.example.com/*` beating `*.example.com/*`, but give no explicit `*/*` example.
  Production already relies on this rule: `test-shops.` and `<store>.test.` both match the
  production `*.fypestore.com/*` and are served by their own more specific staging routes.
- A route with **Worker: None** is an exclusion: matching requests bypass Workers entirely
  (same page).
- Wrangler: *"If you change your routes in the dashboard, Wrangler will override them in the next
  deploy with the routes you have set in your Wrangler configuration file."*
  ([Configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)). The docs
  don't say whether Worker: None routes or other Workers' routes are touched. Assume they may be,
  and re-check them after every deploy.
- Open bug [workers-sdk#15625](https://github.com/cloudflare/workers-sdk/issues/15625):
  *"config-file routes silently ignored for Workers declaring [assets]"*, reported on wrangler
  4.107 with opennextjs-cloudflare. This Worker declares `assets` and uses wrangler 4.113; whether
  it's affected is unknown. So after deploying, check in the dashboard that `*/*` exists, and add
  it by hand if it doesn't.
- `*/*` is in `wrangler.jsonc` as well as (if needed) the dashboard. With both in agreement, a
  later deploy has nothing to remove.

## Before you start

1. **crmApp `93c3996` is deployed to production** ("fixed custom hosts resolving to a subdomain
   store"). Without it, a custom host that isn't active yet can resolve to the store that owns
   subdomain `www`.
2. **storefront-next `3af02af` is on the branch you deploy** (host normalization, 404 for unknown
   hosts). It ships in the same deploy as the route change (step b).
3. `npx wrangler whoami` shows the account that owns the `fypestore.com` zone.
4. Run the checks in step d **now** and save the output. That's the "before" to compare with.

## Record the current state (before any change)

In the dashboard, `fypestore.com` zone:

- **DNS → Records:** write down every record with its **Proxy status**. In particular, record
  whether `api.fypestore.com` and `test-api.fypestore.com` are **Proxied** (orange cloud) or
  **DNS only** (grey cloud).
  - Seen from outside on 2026-09-30, both resolve to Cloudflare IPs and send Cloudflare headers,
    which means Proxied. Confirm in the dashboard.
  - Routes only apply to proxied records. A DNS-only host can't be affected by `*/*`.
- **Workers Routes:** write down every route and its Worker. Expected, at least:

  | Route | Worker |
  |---|---|
  | `shops.fypestore.com/*` | `storefront-next` |
  | `*.fypestore.com/*` | `storefront-next` |
  | `test-shops.fypestore.com/*` | `storefront-next-staging` |
  | `*.test.fypestore.com/*` | `storefront-next-staging` |

  - `api.` and `test-api.` match `*.fypestore.com/*`, yet today they're served by the Express
    backend.
  - So expect an exclusion (e.g. `api.fypestore.com/*` → None) or some other mechanism.
  - Write down exactly what it is.

Or use the API, with a token that has Zone → DNS: Read and Zone → Workers Routes: Read. Keep the
token in an env var, never in shell history or a file you commit:

```bash
curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?per_page=500" \
  | jq -r '.result[] | [.name, .type, (if .proxied then "proxied" else "dns-only" end)] | @tsv'

curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/workers/routes" \
  | jq -r '.result[] | [.pattern, (.script // "None")] | @tsv'
```

## a) Add exclusion routes (Worker: None)

Do this **before** `*/*` exists, so there's never a moment where an excluded host reaches the
storefront.

**Workers Routes → Add route**, zone `fypestore.com`, Worker **None**, once per host:

| Route | Why |
|---|---|
| `fypestore.com/*` | The root redirects to `themes.` (301) today, without the Worker. This keeps it that way, whatever the order of redirect rules and Workers. It matches the apex only, not subdomains. |
| `api.fypestore.com/*` | Production API (Express). Skip if a matching exclusion already exists. |
| `test-api.fypestore.com/*` | Staging API (Express). Skip if one already exists. |
| `<host>/*` for any other **proxied** record from "Record the current state" | Any host that isn't a storefront and isn't already under a more specific route. |

Don't add exclusions for `www.`, `shops.`, `themes.`, `test.`, `test-shops.`, `<store>.` or
`<store>.test.` hosts. They're storefront hosts today and keep their current routes.

Check: run step d. Nothing should have changed yet.

## b) Deploy, which adds `*/*`

```bash
cd storefront-next
npm run deploy          # opennextjs-cloudflare build && opennextjs-cloudflare deploy --env ""
```

Then, in **Workers Routes**:

1. Confirm `*/*` → `storefront-next` is listed. If it's missing (the #15625 case), **Add route**:
   `*/*`, Worker `storefront-next`.
2. Confirm every route and exclusion from "Record the current state" and step a is still there
   and unchanged. Re-add any that are missing.

Don't run `npm run deploy:staging`: staging's KV id is a placeholder until you create its
namespace (see "Staging KV" below).

## c) Purge the production KV entry for zalloperfumes

This removes any tenant cached for this host while it was resolving to the wrong store:

```bash
npx wrangler kv key delete "tenant:www.zalloperfumes.com" \
  --namespace-id 55ab9eaeeee0478494db64b87b26389e --remote

# Expect "Value not found" (or empty):
npx wrangler kv key get "tenant:www.zalloperfumes.com" \
  --namespace-id 55ab9eaeeee0478494db64b87b26389e --remote --text
```

After this deploy, a 404 from `/shops/by-domain` deletes the entry by itself. The purge covers the
time before that.

## d) Checks

Look for `x-opennext: 1`: it means the storefront Worker served the response.

```bash
# Custom hostname. Before: 522. After, while the domain isn't active in the backend: 404
# "Store not found" with x-opennext: 1. After it's active: 200 with the store.
curl -sS -o /dev/null -w "%{http_code}\n" http://www.zalloperfumes.com/
curl -sSI http://www.zalloperfumes.com/ | grep -iE "^(HTTP|x-opennext)"

# HTTPS: fails the handshake until Cloudflare issues the certificate. Once it's active:
curl -sSI https://www.zalloperfumes.com/ | grep -iE "^(HTTP|x-opennext)"   # 200 (or 404 until active), x-opennext: 1

# Root: unchanged, 301 to themes., no x-opennext
curl -sSI https://fypestore.com/ | grep -iE "^(HTTP|location|x-opennext)"

# APIs: unchanged, Express JSON 404, no x-opennext
curl -sS -D - "https://api.fypestore.com/api/v1/commerce/shops/by-domain?domain=nonexistent.example" | grep -iE "^(HTTP|x-opennext)|success"
curl -sS -D - "https://test-api.fypestore.com/api/v1/commerce/shops/by-domain?domain=nonexistent.example" | grep -iE "^(HTTP|x-opennext)|success"

# Platform hosts: still the Worker (x-opennext: 1)
curl -sSI https://shops.fypestore.com/ | grep -iE "^(HTTP|x-opennext)"
curl -sSI https://themes.fypestore.com/ | grep -iE "^(HTTP|x-opennext)"
curl -sS -o /dev/null -w "%{http_code}\n" https://themes.fypestore.com/theme-preview/spark   # 200
curl -sSI https://test-shops.fypestore.com/ | grep -iE "^(HTTP|x-opennext)"
curl -sSI https://<store>.fypestore.com/ | grep -iE "^(HTTP|x-opennext)"                   # a real live store: 200
```

Expected status changes from `3af02af` (production Worker only, not caused by `*/*`):

- `shops.fypestore.com/` and `themes.fypestore.com/` show "Store not found" with **200** today,
  and **404** after (same page, no redirect). Any other path on a host with no store changes the
  same way.
- `/theme-preview/*` and `/api/*` are unaffected.
- `test-shops.` is served by the staging Worker, which isn't redeployed, so it stays **200**.

Anything else that differs from the "before" output is a problem: roll back.

## Rollback

1. **Workers Routes → delete `*/*`.** This takes effect immediately, and custom hostnames go back
   to 522.
2. Before the next deploy, revert the `*/*` route in `wrangler.jsonc` (the "added */* route"
   commit). Otherwise the deploy adds it again.
3. If the storefront code itself is at fault (host normalization, 404 page):
   ```bash
   npx wrangler deployments list
   npx wrangler rollback <version-id>   # the version before this deploy
   ```
4. Leave the exclusion routes from step a. They match today's behavior.

## Staging KV (separate from the steps above)

Staging used production's tenant cache (`55ab9eae…`). It now has a placeholder:

```bash
npx wrangler kv namespace create FYPE_TENANT_CACHE_STAGING
```

Put the printed id in `env.staging.kv_namespaces[0].id` in `wrangler.jsonc` (replacing
`REPLACE_WITH_STAGING_KV_NAMESPACE_ID`), commit it, then `npm run deploy:staging`. Staging deploys
fail until you do this.
