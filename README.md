This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## CI/CD

The storefront runs as two Cloudflare Workers, deployed by GitHub Actions (`.github/workflows/ci-cd.yml`):

| Branch | Worker | Routes | API |
|---|---|---|---|
| `develop` | `storefront-next-staging` | `test-shops.fypestore.com`, `*.test.fypestore.com` | `test-api.fypestore.com` |
| `main` | `storefront-next` | `shops.fypestore.com`, `*.fypestore.com`, custom hostnames | `api.fypestore.com` |

- **Every PR** runs `cf-typegen`, `tsc --noEmit`, `npm run lint`, `npm test` and an OpenNext build. All must pass.
- **A push to `develop` or `main`** (a merged PR) runs the same checks, then deploys that branch's Worker and smoke-checks it. Merging to `main` deploys production; there is no extra approval step.
- **`NEXT_PUBLIC_API_BASE_URL`** is set by the workflow per environment. Next.js inlines it into the client bundle at build time, so the `vars` in `wrangler.jsonc` don't reach browser code, and local `.env*` files aren't used in CI.
- **Worker secrets** (e.g. `STOREFRONT_TOKEN_SECRET`) aren't touched by deploys. Set them once with `npx wrangler secret put <NAME> [--env staging]`.

### One-time GitHub setup

- **Secrets:** `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Use a token made from Cloudflare's "Edit Cloudflare Workers" template, limited to this account and the `fypestore.com` zone.
- **Optional variables:** `STAGING_SMOKE_URL` and `PRODUCTION_SMOKE_URL`, to smoke-check a real store page instead of the fallback hostnames.
- **Branch protection on `develop` and `main`:** require the `checks` job to pass before merging.

### Checking and rolling back a deploy

```bash
npx wrangler deployments list --env staging   # oldest first; drop --env for production
npx wrangler rollback --env staging           # back to the previous version; drop --env for production
```

A rollback doesn't change git. Revert the commit too, or the next push deploys it again.

### Manual deploy

To deploy without CI, set the API URL explicitly, because local `.env*` files may point at the wrong API:

```bash
NEXT_PUBLIC_API_BASE_URL=https://test-api.fypestore.com/api/v1 npm run deploy:staging
NEXT_PUBLIC_API_BASE_URL=https://api.fypestore.com/api/v1 npm run deploy
```
