# STATUS — roll-up of every ledger

Single place to see where the project stands. Update this file in the same change that updates a ledger.
Source of truth for each row is the ledger named in the first column.

**Current phase:** P7 Linux implementation and automated acceptance gate complete: all 89 P7 rows are verified.
The release-wide P8 manual/polish gate remains open (details below).
**Previous:** P3 macOS (+ terminal engine core) built — 162 verified · 39 built · 1 BLOCKED; paused for the owner's
P3 gate review (details below). P0 and P2 gates passed on automated evidence; owner reviews pending. P4 Windows 11 built
(120 of 152 P4 rows verified; details below), paused for the owner's P4 review.
**Last updated:** 2026-09-23

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
| P3 macOS (+ engine core) | 202 | 0 | 39 | 162 | 1 | ☐ (awaiting review) | pending review |
| P4 Windows 11 | 152 | 2 | 30 | 120 | 0 | ☐ (automated evidence recorded; see below) | pending review |
| P5 iOS | 140 | 0 | 0 | 140 | 0 | ☐ (automated evidence recorded; see below) | pending review |
| P6 Android | 132 | 0 | 81 | 51 | 0 | ☐ (focused automated evidence recorded; see below) | pending review |
| P7 Linux | 89 | 0 | 0 | 89 | 0 | ☑ 2026-09-23 (automated evidence) | pending review |
| P8 Polish | 11 | 11 | 0 | 0 | 0 | ☐ | |
| **Total** | **930** | **56** | **159** | **714** | **1** | | |

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

### P3 evidence (2026-09-22, local runs on the preview build `.next-p3`)
All eight macOS apps and every macOS surface are built: lock screen, Spotlight, notifications + Center, Control Center,
context menus, Mission Control, dialogs (About This Mac, Get Info, Quick Look, Switch OS), the tour, the boot replay, and the
shared terminal engine inside Terminal and VS Code.

| Check | Result |
|---|---|
| Typecheck | `tsc --noEmit` clean |
| Vitest | macOS unit + component suites green; terminal engine `unit/terminal/*` green (all 50 Linux P3 engine rows cite it). Full run: 1376 passed, 2 failed — only `unit/routing/codec.test.ts` ARCH-REL-01 — see "Owner questions" |
| Playwright macOS (`macos.spec.ts`, `macos-p3.spec.ts`, `macos-p3b.spec.ts`, `macos-chooser.spec.ts`) | chromium-desktop · reduced-motion · pixel · iphone: 135 passed; 2 load flakes (RESP-ROT-01, MAC-WM-01) pass on rerun |
| Perf project | ARCH-SPLIT-01 · PERF-INP-01 · MOTION-RULE-02 green |
| Leak loop (PERF-LEAK-01) | heap +1.19 MB of 2 · listeners 0 · DOM 0 · detached elements 0, after fixing a real leak in the Overview scroll effects (see the shared Deviations log) |
| axe (X1) | A11Y-AXE-01 clean with Spotlight, Settings and Mission Control open |
| Blur budget (X5) | ≤ 3 live `backdrop-filter` surfaces with Spotlight + a banner open |
| `check-plans` | 148 documents · 930 IDs · 930 ledger rows |

**What remains in P3**
- `MAC-BOOT-04` **BLOCKED**: the > 4 s "Still starting up…" line lives in the chooser boot frame, which this phase was told
  to keep unchanged. Owner decision needed (allow a one-line chooser change, or move the row).
- 39 rows are `built`, not `verified`: each is implemented, but its named test needs a run that has not happened yet —
  nightly projects (iphone-landscape rail, ipad touch posture, forced colours, dark visual), perf traces (marquee, lazy
  search / tour / egg chunks, P3 flights), a real device with the keyboard up, or a named e2e still to write (throttled
  Dock bounce, notification swipe, GitHub card flight, the cross-OS M1 keyboard journey). Each row names its gap.
- Not in P3: `MAC-DOCK-08` and `MAC-X-02` (P4 continuity), `MAC-A11Y-06` (P8 screen-reader script).

**Owner questions**
- All five OSes are `released: true` in `lib/kernel/registry.ts` (commit cfd53de). ARCH-REL-01 expects unreleased OSes to
  404 in production, so it fails until the flags are set back or the test is re-based on the new release set. Left as is.

Deviations for owner review (logged in each ledger): macOS — `MAC-BOOT-04`, `MAC-DOCK-01` (no Trash), `MAC-DOCK-02`,
`MAC-DOCK-03`, `MAC-DOCK-07`, `MAC-SPOT-01`, `MAC-SET-03`, `MAC-SET-06`, `MAC-MENU-03`, `MAC-CTX-03`, `MAC-RESP-01`, the
removed placeholder and the adapted P2 tests · shared — the macOS kernel additions and `RESP-DOM-01`.

### P4 evidence (2026-09-22, local runs on the preview build `.next-p4`)
The Windows 11 shell (taskbar, Start ↔ Search, Task View, Snap, flyouts, toasts, context menus, lock, boot, About
Windows, continuity, tour) and its seven apps are built. P4 was started at the owner's direct request before the P1–P3
gates were reviewed. Windows ledger: 115 verified · 30 built · 1 P8 row planned; the 5 shared P4 rows verified; the 2
macOS Handoff rows (`MAC-DOCK-08`, `MAC-X-02`) stay with the macOS session.

| Check | Result |
|---|---|
| Typecheck · lint · format | clean (`tsc --noEmit`, `eslint`, `prettier --check`) |
| Vitest | Windows evidence set (Windows, design tokens, terminal, welcome) 598/598; full run 1570 passed, 2 failed — only ARCH-REL-01 (every OS `released: true` since commit cfd53de) |
| Playwright Windows (7 specs) + chooser and history specs | Final run on the rebuilt `.next-p4` and an `ASSET_MODE=original` build, after the P5 session's shared `Press` / `drag` changes: every Windows spec plus `chooser.spec` and `history.spec` on chromium-desktop, iphone, pixel, reduced-motion, no-js and asset-original — **311 passed, 0 failed, 0 flaky** (104 skipped by design). Product defects traced from flakes under load and fixed: a hovered accent button read 3.9:1 (every accent hover now darkens, and a chosen accent gets its own hover tone), About Windows and the Properties / Shortcuts dialogs could return focus into the closing Search panel and then to `<body>`, and the Windows motion probe missed a tween before its first tick, so axe scanned half-faded pages (`WIN-SET-07` on iphone went from 13/16 to 16/16 at 8 workers). Test-side: `WIN-CASE-03` waits for the keyboard snap to land (30/30), `WIN-SET-01` records the 1.2 s search flash instead of catching it mid-flight, `WIN-TERM-05` allows 15 s for Edge's first chunk, `WIN-EDGE-04` is `test.slow()`. Under heavy machine contention (five sessions building and running suites here) the iphone project still times out; those runs are environment-bound, not Windows |
| Budgets (gzip, before idle work) | `/windows` first load 241.3 KB (macOS 259.1 KB); Windows-only 44.4 KB vs the 38 KB shell row; apps 7.1–12.3 KB, VS Code 15.3 KB, Terminal 13.8 KB + shared engine — awaits the `PERF-BUDGET-01` re-base |
| Speed (production) | windows visible 19–82 ms after the press, settled 212–381 ms; in-app navigation 22–81 ms to the URL |
| Not run | nightly projects (Firefox, iPad, landscape, forced colours, visual snapshots), perf traces, real devices, screen reader (P8) |

### P5 evidence (2026-09-22, local runs on the preview builds `.next-p5` (official assets) and `.next-p5o` (original))
The iOS shell (Lock Screen, boot, Home Screen with pages and widgets, Dock, folders, Spotlight, Control Center,
Notification Center and banners, quick actions, App Switcher, status bar and Home indicator, the icon ↔ app flight and
the Home gesture) and its seven apps (Files with Quick Look, Safari, GitHub, Mail, Messages, Notes, Settings) are built.
iOS ledger: 137 verified · 1 P8 row planned (`IOS-A11Y-06`, the recorded screen-reader script); the 3 shared P5 rows
(`ROUTE-MOBILE-01`, `MOTION-FLIGHT-01`, `EGG-SHAKE-01`) verified.

| Check | Result |
|---|---|
| Typecheck · lint · format | clean (`tsc --noEmit`, `eslint`, `prettier --check`) |
| Vitest | iOS evidence set (`tests/unit/ios`, `tests/component/ios`, `tests/unit/kernel/ios.test.ts`) 212/212; full run 1605 passed, 3 failed — the 2 ARCH-REL-01 rows (every OS `released: true` since commit cfd53de, unchanged by P5) and `MAC-WM-10`, which is order-flaky in `tests/component/macos/shell.test.tsx` with and without P5's shared changes (verified by stashing them) |
| Playwright iOS (`ios`, `ios-surfaces`, `ios-journeys`) + chooser | Final run on both rebuilt preview builds across chromium-desktop, iphone, pixel, reduced-motion, asset-original, firefox-desktop, ipad-portrait, ipad-landscape, webkit-desktop, iphone-landscape and forced-colors: **645 passed, 0 failed** (202 skipped by design — landscape-, pad-, motion- or build-specific). The suite found 16 product defects, all fixed and re-verified (listed in `IMPLEMENTATION.md`) |
| Playwright perf (`perf`) | `IOS-ID-03`, `IOS-WIDG-04`, `IOS-MOTION-04` green: nothing animates at rest, no timers beyond the status-bar minute tick, and no Layout > 1 ms inside a tagged flight apart from the app body's own mount at 90 % (marked `pf-app-mount:*`) |
| Speed (preview build, measured in-page from the pointer event) | After the owner's "premium smooth and fast" review: app open 16 ms to the first frame and 307 ms to land, Home 24 ms / 314 ms, at 60 fps (before: 50 ms / 464 ms and 52 ms / ~600 ms at ~30 fps; a macOS window lands in ~300 ms on the same machine) |
| Budgets (JS fetched by the load event, encoded) | /ios 163.3 KB, /ios/github 139.8 KB, measured the same way /macos reads 163.3 KB — awaits the `PERF-BUDGET-01` re-base |
| Both asset modes | official (:3510) and `ASSET_MODE=original` (:3511) built and served; `IOS-ID-02` compares every icon box across the two builds |
| Not run | Lighthouse, real devices (iPhone / iPad with the keyboard up), screen readers (P8), visual baselines — `IOS-ID-06` attaches light and dark screenshots but sets no pixel baseline |

### P6 evidence (2026-09-22, local focused run and isolated production build `.next-mobile-final`)

The Android portfolio is implemented as a full-page Material-style launcher and taskbar, a lock screen, app drawer,
combined notification/quick-settings shade, Recents, shortcuts, heads-up/snackbar surfaces, two navigation modes and
six dynamically loaded apps (Chrome, Files, GitHub, Gmail, Keep and Settings). The focused evidence verifies 51 rows;
the remaining 81 are marked `built` until their named cross-browser/nightly/manual cases are recorded.

| Check | Result |
|---|---|
| Typecheck · lint · format | TypeScript clean; full ESLint has 0 errors (one unrelated existing chooser warning); Android files pass Prettier |
| Vitest | `tests/unit/android/model.test.ts` 16/16; `tests/component/android/shell.test.tsx` 5/5 |
| Playwright Android | `tests/e2e/android.spec.ts`: Chromium desktop **8 passed, 0 failed**; Pixel phone checks green — full-page launcher, drawer/Back, lifecycle/Recents, shade/prefs, all six app routes, Gmail attachment → Files, phone posture, gesture target sizes and axe |
| Mobile launch regression | `tests/e2e/mobile-launch.spec.ts`: **18/18** across Chromium desktop, Pixel and reduced motion (3 repetitions each); Android and iOS app clicks update route + foreground surface atomically with no document reload |
| Accessibility | axe reports zero serious or critical violations on Android Home; keyboard Back restores focus to the launcher search control |
| Visual target | Manual render comparison at 1440 × 900 for Home and Gmail, plus 390 × 844 Home; full page with no device frame, sage tonal palette, wide Gmail rail/list/detail |
| Static production build | `.next-mobile-final`: 150/150 static pages generated successfully |
| Plan audit | 148 documents · 930 IDs · 930 ledger rows; P6 is 51 verified / 81 built / 0 planned |
| Not yet recorded | Asset-original, Firefox/WebKit/iPad/landscape/forced-colours matrices, Lighthouse/perf/leak, real Android keyboard, TalkBack/NVDA and pixel baselines |

### P7 evidence (2026-09-23, local production build and focused Linux matrix)

The Linux portfolio is implemented as a responsive terminal workspace over the shared shell/VFS: authentic prompt and
status bar, boot/login/MOTD, hints and tour, complete P7 command registry, split/overlay/pager rich views, continuity,
touch accessory keys, visual-viewport handling, focus restoration, reduced-motion and forced-colours support.

| Check | Result |
|---|---|
| Typecheck · focused lint | Clean |
| Vitest | Linux/terminal/kernel evidence set: **313/313** across 15 files, including output lifecycle, focus return, persistence, 10,000-command fuzzing and axe audits |
| Playwright Linux | Chromium desktop, iPhone, Pixel and reduced motion: **36 passed, 12 intentional posture skips**; Firefox + iPad portrait + iPad landscape smoke: **4 passed, 2 touch-only skips**; forced colours: **10 passed, 2 touch/viewport skips** |
| Static production build | 150/150 static pages; build audit found no dynamic routes and no token in 110 client assets |
| Plan audit | 148 documents · 930 IDs · 930 ledger rows; P7 is **89 verified / 0 built / 0 planned** |
| Product defects found by the matrix | Fixed cwd-independent project opening, routed focus restoration, light/dark viewer contrast, forced-colours tokens, split rewrap timing, tour cancellation, and OS-switch draft restoration |
| P8 release-only work | Visual/Lighthouse/perf release audits; real-device keyboard checks; recorded NVDA/VoiceOver script; uninstructed reviewer sessions |

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
