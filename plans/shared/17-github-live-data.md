# shared/17 — Live GitHub data (build-time)

## Purpose
The GitHub app shows real repositories, stars, languages and a contribution graph — while the site stays
100 % static and a build can never fail because of GitHub. Requirement: N8.

## Decisions

| Decision | Rationale | Rejected |
|---|---|---|
| Fetch at **build time** into a committed snapshot | Static, fast, no client token, no rate limits at runtime | Client-side API calls |
| **Best-effort**: overwrite the snapshot only on a fully validated success | A GitHub outage or rate limit cannot break a deploy (risk 12) | Failing the build |
| Token optional, **server-side only** | Contribution graph needs GraphQL auth; nothing secret may reach the client | `NEXT_PUBLIC_` token |
| Résumé data remains the source of truth for *which* projects matter | GitHub enriches; it never invents portfolio content | Auto-listing every repo as a project |
| Feature is **off until `GITHUB_USERNAME` is set** | Nothing waits on the owner; the GitHub app still works from résumé data | Blocking on the username |

## Specification

### Script — `scripts/fetch-github.mjs` (runs in `prebuild`)
1. No `GITHUB_USERNAME` → exit 0, keep snapshot.
2. REST `GET /users/{u}` and `/users/{u}/repos?per_page=100&sort=pushed` (public only, forks excluded unless
   referenced by a project).
3. With `GITHUB_TOKEN`: GraphQL `contributionsCollection` (last 52 weeks, with each day's date and GitHub level),
   pinned repositories. **Without a token (or if GraphQL has no calendar)** the contribution calendar comes from the
   public profile calendar `github.com/users/{u}/contributions` (same data the profile shows); a failure there only
   leaves `contributions` null (owner change 2026-09-26, logged in shared/22). `prebuild` and `npm run github:refresh`
   load `.env.local` when it exists.
4. Validate against the schema below; on success write `data/generated/github.json` (stable key order so diffs
   are meaningful) with `fetchedAt`.
5. Any error (network, 403 rate limit, schema mismatch, timeout 8 s) → log a warning, **keep the existing file**, exit 0.

### Schema
```ts
interface GithubSnapshot { v: 1; fetchedAt: string | null; user: { login: string; name: string | null; followers: number; publicRepos: number; url: string } | null;
  repos: readonly GithubRepo[]; pinned: readonly string[];
  contributions: { total: number; weeks: readonly (readonly number[])[]; start?: string /* ISO date of weeks[0][0] */;
                   levels?: readonly (readonly number[])[] /* GitHub's 0–4, same shape as weeks */ } | null }
interface GithubRepo { name: string; url: string; description: string | null; stars: number; forks: number;
  language: string | null; languages?: Readonly<Record<string, number>>; topics: readonly string[]; pushedAt: string; archived: boolean }
```
An empty snapshot (`user: null, repos: []`) is committed in P0 so the app has a valid shape before any fetch.

### Merging (selector `getProjectsWithGithub()`)
Match `Project.repo` URL ↔ `GithubRepo.url`. Enriched fields: stars, forks, primary language, last pushed,
topics. Unmatched portfolio projects render without GitHub stats. Unmatched repos appear only under
"More on GitHub" (top 6 by stars, non-archived) — never in `/go/projects`.

### Presentation (owned by each OS's `apps/github.md`)
Profile header, pinned/featured repositories, repository list with language dots and stars, contribution heatmap
(CSS grid of 53 × 7 cells, 5 intensity levels, accessible summary "N contributions in the last year" + a table
alternative). Linux: `gh status`-style text via `renderText`. When `contributions === null` the heatmap is
simply absent — no empty frame.

### Freshness
A small "Updated {relative date}" line from `fetchedAt`. Scheduled redeploy daily (`shared/13-deployment.md`).

## Edge cases
Renamed/deleted repo → the project keeps its résumé data, loses stats silently. Rate limit without token (60/h)
→ one build uses ≤ 3 requests. Private repos never fetched. Very large accounts → capped at 100 repos.
Build offline → snapshot used.

## Feature IDs + acceptance tests

| ID | Feature | Acceptance test |
|---|---|---|
| `GH-FETCH-01` | Build-time fetch script | `unit: successful responses produce a schema-valid snapshot` |
| `GH-SAFE-01` | Failure keeps snapshot, exit 0 | `unit: network error / 403 / bad schema leave file untouched; build test offline passes` |
| `GH-TOKEN-01` | Token never reaches the client | `static: no GITHUB_TOKEN reference outside scripts/; bundle grep` |
| `GH-MERGE-01` | Merge by repo URL; résumé stays source of truth | `unit: unmatched repos excluded from project list` |
| `GH-UI-01` | Heatmap with accessible summary + table alternative | `cmp: axe clean; summary text present` |
| `GH-OFF-01` | Works with no username (default) | `e2e: GitHub app renders résumé projects with empty snapshot` |

## Open questions
None — defaults are active until `GITHUB_USERNAME` (and optionally `GITHUB_TOKEN`) are set in Vercel.
