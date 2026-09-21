# STATUS — roll-up of every ledger

Single place to see where the project stands. Update this file in the same change that updates a ledger.
Source of truth for each row is the ledger named in the first column.

**Current phase:** P1 Welcome. P0 Foundation gate passed on automated evidence 2026-09-21 (details below);
owner review of P0 pending — proceeding under the 2026-09-21 authorization in `plans/README.md`.
**Last updated:** 2026-09-21

## Feature IDs by ledger and phase

| Ledger | P0 | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| `06-onboarding-acceptance.md` (Hello · Netflix · chooser) | – | 32 | 4 | – | – | – | – | – | – | **36** |
| `shared/22-acceptance.md` | 103 | 19 | 21 | 23 | 5 | 3 | – | 14 | 6 | **194** |
| `macos/08-acceptance.md` | – | – | 25 | 129 | 2 | – | – | – | 1 | **157** |
| `windows/08-acceptance.md` | – | – | – | – | 145 | – | – | – | 1 | **146** |
| `ios/08-acceptance.md` | – | – | – | – | – | 137 | – | – | 1 | **138** |
| `android/08-acceptance.md` | – | – | – | – | – | – | 132 | – | 1 | **133** |
| `linux/13-acceptance.md` | – | – | – | 50 | – | – | – | 75 | 1 | **126** |
| **Per phase** | **103** | **51** | **50** | **202** | **152** | **140** | **132** | **89** | **11** | **930** |

## Progress

| Phase | In scope | planned | built | verified | BLOCKED | Gate passed | Owner sign-off |
|---|---|---|---|---|---|---|---|
| P0 Foundation | 103 | 0 | 1 | 102 | 0 | ☑ 2026-09-21 | pending review |
| P1 Welcome | 51 | 51 | 0 | 0 | 0 | ☐ | |
| P2 Vertical slice | 50 | 50 | 0 | 0 | 0 | ☐ | |
| P3 macOS (+ engine core) | 202 | 202 | 0 | 0 | 0 | ☐ | |
| P4 Windows 11 | 152 | 152 | 0 | 0 | 0 | ☐ | |
| P5 iOS | 140 | 140 | 0 | 0 | 0 | ☐ | |
| P6 Android | 132 | 132 | 0 | 0 | 0 | ☐ | |
| P7 Linux | 89 | 89 | 0 | 0 | 0 | ☐ | |
| P8 Polish | 11 | 11 | 0 | 0 | 0 | ☐ | |
| **Total** | **930** | **827** | **1** | **102** | **0** | | |

### P0 gate evidence (2026-09-21, local runs on production builds)
| Gate item (`05-roadmap.md`) | Result |
|---|---|
| Typecheck + lint + unit green; kernel/routing ≥ 90 % | `npm run check` clean · Vitest 587/587 · `lib/kernel` 94.7 / 91.5 / 94.8 / 96.3 % (stmts/branches/funcs/lines), global 90.7 / 84.5 / 88.5 / 92.7 % |
| Production build, all routes static | Post-build audit on both builds: 151 prerendered paths, no dynamic route, no token in 17 client assets |
| History contract suite on both adapters | `e2e/history.spec.ts` green on `native` and `next-router` in every PR project |
| Deep link + Back/Forward + refresh on a stub OS | D1, H1, spam-traversal and repair specs green (a reload-then-quick-Back race was found and fixed in `RouteSync`) |
| Journeys in both asset modes | `chromium-desktop` (official, :3000) and `asset-original` (:3001) green; zero `/assets/official/` requests in original mode |
| No-JS pages complete | `no-js` project green (`/`, `/plain`, every `/go/*`, one deep link per OS) |
| `check-plans` green | 148 documents · 930 IDs · 930 ledger rows |
| Playwright PR matrix | 156 passed · 13 skipped by design (WebKit Tab-to-link, single cross-build comparison, Chromium-only notch emulation) · 0 failed |
| Lighthouse (mobile, 3 runs, median) | Accessibility 1.00 · CLS 0.000 · meta-viewport pass on every URL |

Not yet evidenced: `TEST-TOOL-01` (needs the first GitHub PR run — the repository has no remote yet).

### P1 starting baseline (Lighthouse warnings owned by `PERF-LCP-01`, `PERF-BUDGET-01`, `TEST-PERF-01`)
| URL | LCP | TBT | Script (gz) | Budget |
|---|---|---|---|---|
| `/` (P0 placeholder page) | 2.61 s | 394 ms | 158 KB | ≤ 2.5 s · ≤ 200 ms · ≤ 130 KB |
| `/plain` | 2.81 s | 575 ms | 134 KB | ≤ 2.5 s · ≤ 200 ms · ≤ 130 KB |
| `/go/projects/enterprise-sso` | 3.40 s | 485 ms | 170 KB | ≤ 2.5 s · ≤ 200 ms · ≤ 200 KB |
| `/go/resume` | 3.41 s | 447 ms | 170 KB | ≤ 2.5 s · ≤ 200 ms · ≤ 200 KB |

Cause (from the traces): on localhost the first paint lands after hydration, so Lighthouse's simulation charges all
framework script work to LCP; `/` also idle-loads the shell runtime. P1 rebuilds `/` (kernel out of the welcome
bundle) and must bring every row under budget before the three assertions become errors.

## Released operating systems (`OS_REGISTRY[os].released`)

| OS | Released | Ledger 100 % verified | Audit done | Date |
|---|---|---|---|---|
| macOS | ☐ | ☐ | ☐ | |
| Windows 11 | ☐ | ☐ | ☐ | |
| iOS | ☐ | ☐ | ☐ | |
| Android | ☐ | ☐ | ☐ | |
| Linux | ☐ | ☐ | ☐ | |

## Plan documents

| Area | Files | Status |
|---|---|---|
| Root (index, north star, trace, Hello, Netflix, chooser, roadmap, onboarding ledger, status) | 9 | complete |
| `shared/` contracts + ledger | 22 | complete |
| `macos/` | 26 | complete |
| `windows/` | 25 | complete |
| `ios/` | 27 | complete |
| `android/` | 25 | complete |
| `linux/` | 14 | complete |
| **Total in `plans/`** | **148** | **reviewed; implementation authorized 2026-09-21** |
| `CLAUDE.md` (repo root) | 1 | complete |

## Inputs with working defaults (nothing blocks on these)

| Input | Default until provided | How to provide |
|---|---|---|
| Résumé | PDF generated from `data/portfolio.ts`; facts published nowhere (experience start dates, the IBM role and dates) stay `placeholder: true`, so the guard blocks a production deploy until supplied | Drop `content/resume.pdf` (published automatically) and fill the placeholders in `data/portfolio.ts` |
| Official icons / Netflix sound + avatars | 37 official files ingested; the green profile avatar is a hue-shifted copy of the blue one until the real file arrives; original artwork renders in `ASSET_MODE=original` | Drop files in `assets-inbox/`, then `npm run assets:ingest` |
| GitHub username (+ optional token) | `Jaswanthnarravula`; committed snapshot (2 public repos) is used if a build-time fetch fails | Optional `GITHUB_TOKEN` in Vercel |
| Vercel plan | Page views + Speed Insights | Custom events switch on automatically if supported |
| Fifth profile | `Guest` | One line in the profiles data |

## Release checklist sign-offs (from `shared/13-deployment.md`)
| Item | Done | Evidence |
|---|---|---|
| Every released ID `verified` | ☐ | |
| PR gates + nightly green | ☐ | |
| Lighthouse targets on `/` + one deep link per released OS | ☐ | |
| Placeholder guard passes | ☐ | |
| Journey suite green in both asset modes | ☐ | |
| Manual device + screen-reader script signed | ☐ | |
| OG cards validated | ☐ | |
| `TAKEDOWN.md` + Legal surface present | ☐ | |
