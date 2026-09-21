# shared/13 — Deployment

## Purpose
Ship a fully static site on Vercel with safe caching, previews per change, scheduled content refresh and a
release checklist that enforces the ledgers. Requirements: R4 (Vercel), S.

## Decisions

| Decision | Rationale | Rejected |
|---|---|---|
| Fully static output (SSG for every route); no server functions in v1 | No backend needed (contact is `mailto:`); fastest, cheapest, most resilient | Server actions / API routes |
| Vercel Git integration for deploys; the `vercel` CLI stays dev-only | Keeps CLI audit noise out of production | CLI-driven production deploys |
| **Every phase is deployable**: only `released` OSes are visible (`ARCH-REL-01`) | The site never shows half-finished work | "Coming soon" tiles |
| Scheduled redeploy refreshes GitHub data | Keeps the site static | Runtime API calls |
| Git initialized in P0; commits only when the owner asks | Owner controls history | Auto-commits |

## Specification

### Repository and branches
`git init` in P0 (repo is not yet a git repository). `main` = production; feature branches → PR → preview URL.
`.gitignore` keeps `public/decoders/` ignored (generated), adds `assets-inbox/` raw drops, test artifacts.

### Environments and variables

| Variable | Scope | Purpose | Default |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | all | Absolute URLs for metadata/OG/sitemap | `http://localhost:3000` |
| `NEXT_PUBLIC_ASSET_MODE` | all | `official` \| `original` | `official` |
| `GITHUB_USERNAME` | build | Enables GitHub enrichment | unset → résumé projects only |
| `GITHUB_TOKEN` | build (secret) | Contribution graph + higher rate limit; never exposed to the client | unset |
| `CHECK_CONTENT` | build | Force the placeholder guard outside production | unset |
| `NEXT_PUBLIC_DEBUG` | dev | Dev-only motion/tier debug HUD | `false` |
| `NEXT_PUBLIC_OS_PREVIEW` | test / preview | `all` or a comma list of OS ids made visible before release (e2e builds); **ignored when `VERCEL_ENV=production`** | unset |
| `NEXT_DIST_DIR` | build (tests) | Output folder, so the `ASSET_MODE=original` e2e build lives beside the default one (`.next-original`) | `.next` |
| `LHCI_BASE_URL` | CI | Lighthouse CI audits this deployed URL instead of the local production build (nightly) | unset |

### Headers and caching (`vercel.json`)
- `/assets/**` (content-hashed) and `/_next/static/**` → `public, max-age=31536000, immutable`.
- `/decoders/three-0.186/**` (versioned path) → immutable. The unversioned `/decoders/*` rule is removed.
- `/resume/*.pdf` → `public, max-age=3600` + `Content-Disposition: inline`.
- HTML → Vercel default (revalidated per deploy).
- Security headers on all routes: `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin`, `Permissions-Policy` (no camera/mic/geolocation), and a CSP allowing self,
  the inline tier script via hash, Vercel analytics endpoints, and `data:`/`blob:` for fonts/audio.

### Scheduled refresh
A Vercel Deploy Hook triggered by a daily GitHub Actions cron (or Vercel Cron) rebuilds the site so
`scripts/fetch-github.mjs` refreshes `data/generated/github.json`. A failed fetch keeps the committed snapshot
(`shared/17-github-live-data.md`), so a scheduled build can never break production.

### Build pipeline
`prebuild`: `copy-decoders` (dormant pipeline stays functional) → `fetch-github` (best effort) →
`build-hello-paths` → `check-content` (production only) → `check-plans`. `build`: `next build` (Turbopack).

### Domains and metadata
Custom domain optional; `metadataBase` from `NEXT_PUBLIC_SITE_URL`; canonical URLs point at `/go/*`;
`sitemap.ts` lists `/`, `/plain`, `/go/*` only; `robots.ts` allows all and points at the sitemap;
`manifest.ts` with original icons only (never third-party marks).

### Release checklist (gate for promoting to production)
1. `STATUS.md`: every ID in the released scope is `verified`; no unsigned `BLOCKED`.
2. PR gates green; nightly green for the last run.
3. Lighthouse CI on the preview URL meets targets on `/` and one deep link per released OS.
4. Placeholder guard passes (no `placeholder: true`).
5. Journey suite green in **both** asset modes.
6. Manual script (real devices + screen readers) signed for the released OSes.
7. OG cards validated (LinkedIn/Twitter/Slack debuggers) for `/` and two `/go/*` URLs.
8. `TAKEDOWN.md` present and current; Legal surface reachable.

### Rollback
Vercel instant rollback to the previous deployment; asset-mode switch is an env change + redeploy.

## Edge cases
Build without network → GitHub snapshot used, fonts are self-hosted by `next/font` at build (cached). Preview
deployments are `noindex` via header. Deploy hook failure → next scheduled run retries; no user impact.

## Feature IDs + acceptance tests

| ID | Feature | Acceptance test |
|---|---|---|
| `DEPLOY-GIT-01` | Repository initialized + ignore rules | `static: repo has .git; ignore rules present` |
| `DEPLOY-ENV-01` | Env variable contract | `unit: env schema parses with defaults` |
| `DEPLOY-HDR-01` | Cache + security headers | `e2e: header assertions on a production build` |
| `DEPLOY-STATIC-01` | Fully static output | `build: next build reports all routes as static` |
| `DEPLOY-CRON-01` | Scheduled refresh | `ci: deploy-hook workflow exists; offline build passes` |
| `DEPLOY-SEO-01` | sitemap / robots / manifest / canonical | `unit: sitemap lists only / , /plain, /go/*; canonicals resolve` |
| `DEPLOY-REL-01` | Release checklist enforced | `release: checklist recorded in STATUS.md` |
| `DEPLOY-PREV-01` | Preview deployments are noindex | `e2e: X-Robots-Tag on preview` |

## Open questions
None.
