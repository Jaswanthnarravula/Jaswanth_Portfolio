# STATUS — roll-up of every ledger

Single place to see where the project stands. Update this file in the same change that updates a ledger.
Source of truth for each row is the ledger named in the first column.

**Current phase:** P1 Welcome. P0 Foundation gate passed on automated evidence 2026-09-21 (details below);
owner review of P0 pending — proceeding under the 2026-09-21 authorization in `plans/README.md`.
**Last updated:** 2026-09-22

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
| P1 Welcome | 51 | 43 | 8 | 0 | 0 | ☐ | |
| P2 Vertical slice | 50 | 0 | 0 | 50 | 0 | ☑ 2026-09-22 (automated evidence) | pending review |
| P3 macOS (+ engine core) | 202 | 202 | 0 | 0 | 0 | ☐ | |
| P4 Windows 11 | 152 | 152 | 0 | 0 | 0 | ☐ | |
| P5 iOS | 140 | 140 | 0 | 0 | 0 | ☐ | |
| P6 Android | 132 | 132 | 0 | 0 | 0 | ☐ | |
| P7 Linux | 89 | 89 | 0 | 0 | 0 | ☐ | |
| P8 Polish | 11 | 11 | 0 | 0 | 0 | ☐ | |
| **Total** | **930** | **769** | **9** | **152** | **0** | | |

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

### P1 storyboard match (2026-09-21, owner: "exactly same as this html page")
Welcome screens vs the frames rendered full screen (`plans/visual-targets/frames/`, `scripts/render-visual-targets.mjs`),
share of pixels differing by more than 24/255 on any channel, preview build, Chromium:

| Screen | 1280 × 800 | 1440 × 900 | 1680 × 1050 | 1920 × 1200 | What remains |
|---|---|---|---|---|---|
| Hello | 0.05 % | 0.01 % | 0.01 % | 0.00 % | text anti-aliasing |
| Intro | 0.76 % | 0.49 % | 0.15 % | 0.39 % | glyph-edge anti-aliasing (vector path vs text; ink within 0.3 px) |
| Who's watching? | 0.06 % | 0.07 % | 0.05 % | 0.06 % | avatar WebP vs the frame's PNG |
| Chooser | 0.26 % | 0.23 % | 0.28 % | 0.26 % | the Résumé · Skip the OS footer (required, not in the frame), snapshot edges |

Tier 2 (forced WebGL) matches too except the lens rim, where the shader adds the refraction the storyboard promises.
The Hello glass (lens, glyph, pill) then moved to the owner's later liquid-glass decision (06 Deviations log); the
Hello row above is the storyboard version. The five OS screens are not built yet (P2–P7); each has its frame values in
its `01-identity.md` "Visual target".

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

### P2 gate evidence (2026-09-22, local runs on the preview builds)
macOS stays `released: false` (ARCH-REL-01): production still 404s `/macos`; preview builds show it.

| Gate item (`05-roadmap.md`) | Result |
|---|---|
| H1, D1, P1, M3, O1 green on macOS | H1 `e2e/macos.spec.ts` MAC-FIND-03 · D1 ROUTE-DEEP-01 · M3 MAC-WM-10 + MAC-FIND-07 · O1 RESP-ROT-01 (re-clamp + the minimize flight lands on the moved Dock tile) · P1 reload + corrupt storage in `e2e/foundation.spec.ts` on macOS, TTL expiry (KRN-SES-01) and per-OS sessions parked on a switch (KRN-SWITCH-01) in `unit/kernel/sessions.test.ts` |
| INP ≤ 200 ms under 4× CPU | `e2e/performance.spec.ts` PERF-INP-01, read from Event Timing (9 presses: open, select ×2, drag, minimize, restore, zoom, open): worst 32–40 ms over 6 runs (was 400–640 ms before presses committed after paint) |
| Leak loop stable | PERF-LEAK-01 (160 window opens + 6 exits through history): heap < 2 MB, listeners and DOM back to baseline · MOTION-LEAK-01: 0 tickers / 0 tweens at idle |
| axe clean on home + Finder | A11Y-AXE-01 on home, Finder and the compact switcher (WCAG 2.2 AA) |
| Site deployable, macOS unreleased | `npm run build` + post-build audit: all routes static, no token in client assets |
| Playwright (macOS, chooser, history, foundation, welcome, chooser, résumé specs) | chromium-desktop · pixel · reduced-motion: 200 passed, 4 failed — all in `welcome.spec.ts` (P1: W1 "second visit lands on the profiles" ×3, which `/` always starting at Hello now contradicts; RES-PRE-01 once under load, 3/3 alone) · iphone (WebKit, 2 workers): 29 passed, 1 P0 history flake under load (4/4 alone) · asset-original + chromium-desktop + reduced-motion: 82 passed · firefox + iPads (smoke): 3 passed · perf: 5 passed · leak: 1 passed |
| Vitest | all unit + component suites green (see IMPLEMENTATION.md P2 checkpoint) |

Sizes (gzip): macOS shell entry 15.7 KB (≤ 40) · `os-kernel` 13.8 KB (≤ 28) · `/macos` first load 214.9 KB (framework 132.8 KB
before paint). The shared/10 "OS first load ≤ 200 KB" row still assumes the old ~105 KB framework; re-basing it like
the welcome row (`PERF-BUDGET-01`, P1) gives ≤ 226 KB. A stray chooser warm-up on OS routes (13.6 KB) was found and
removed; ARCH-SPLIT-01 now asserts it.

Deviations for owner review (logged in each ledger): `MAC-ID-01` link text colour · `MAC-ID-02` inactive title
colour · `PERF-INP-01` measured through Event Timing.

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
