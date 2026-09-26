# 05 — Roadmap (phases as work orders)

**Foundation → Welcome → one vertical slice → macOS → Windows 11 → iOS → Android → Linux → Polish.**
A phase starts only when the previous gate has passed. Every phase ships a complete, deployable site: the chooser
lists only OSes whose ledger is 100 % `verified` (`ARCH-REL-01`).

How to run a phase: read the listed files → take the listed feature IDs from the ledgers (filter by the Phase column)
→ build by ID with its named acceptance test → mark `built`, then `verified` with evidence → run the gate → log
deviations → **stop for the owner's review**.

| Phase | IDs in scope | Count |
|---|---|---|
| P0 Foundation | `shared/22-acceptance.md` rows marked P0 | 103 |
| P1 Welcome | `06-onboarding-acceptance.md` P1 (32) + shared P1 (19) | 51 |
| P2 Vertical slice | macOS P2 (25) + shared P2 (21) + onboarding P2 (4) | 50 |
| P3 macOS | macOS P3 (129) + shared P3 (23) + **terminal engine core** `linux` P3 (50) | 202 |
| P4 Windows 11 | Windows P4 (145) + shared P4 (5) + macOS P4 (2: Handoff slot) | 152 |
| P5 iOS | iOS P5 (137) + shared P5 (3) | 140 |
| P6 Android | Android P6 (132) | 132 |
| P7 Linux | Linux P7 (75) + shared P7 (14) | 89 |
| P8 Polish | shared P8 (6 + 9 content depth) + per OS (1 release script + 2 content depth) ×5 | 30 |
| **Total** | | **949** |

---

## P0 — Foundation
**Read first:** `README.md` · `00-north-star.md` · all of `shared/01`–`13` · `shared/15`–`19` (index, continuity,
GitHub, analytics, OG).
**Build:** `git init` · scaffold fixes (`ARCH-FIX-01`) · test tooling + CI (`TEST-*` P0) · import-boundary lint
(`ARCH-LINT-01`) · `scripts/check-plans.mjs` · data schema + typed placeholders + guard (`DATA-*`) · content views
(`VIEW-*`) · kernel reducers, sessions, persistence, focus manager (`KRN-*` P0) · route codec, `go()`/`canonicalize()`,
`HistoryPort` with both adapters, contract suite (`ROUTE-*` P0) · Shell in the root layout, semantic fallback, `/go`,
`/plain` (`ARCH-*`) · tier script + governor (`PERF-TIER-01`, `PERF-GOV-01`) · motion primitives (`MOTION-SPRING-01`,
`MOTION-DIR-01`) · five a11y primitives, test-first (`A11Y-PRIM-*`) · design tokens for all five OS scopes (`DS-*` P0) ·
asset manifest, `ASSET_MODE`, parametric originals, `assets-inbox/` ingest, `TAKEDOWN.md` (`ASSET-*` P0) · search
index + matcher · continuity slice · `AnalyticsPort` · GitHub fetch + snapshot · static OG routes · deployment skeleton.
**Gate:** typecheck + lint + unit green (kernel/routing ≥ 90 % coverage) · production build, all routes static ·
**history contract suite green on both adapters** · e2e deep link + Back/Forward + refresh on a **stub OS** · journeys
pass in **both asset modes** · no-JS pages complete · `check-plans` green.

## P1 — Welcome (Hello · Netflix · chooser)
**Read first:** `02-hello-page.md` · `03-netflix-page.md` · `04-os-chooser.md` · `shared/06`, `07`, `10`, `11`.
**Build:** Hello (SSR `<h1>`, CSS stroke draw, generated greeting paths + MorphSVG, glass by tier, `GlassStage` shader)
· Tap to begin + mute · audio engine · Netflix intro (skippable) · "Who's watching?" with five **identical-behaviour**
profiles · chooser cards, badge, prefetch, enter transition against the stub OS.
**Gate:** Lighthouse LCP ≤ 2.5 s (target 1.5 s) / CLS ≤ 0.1 / a11y ≥ 95 on `/` · three.js requested only after `load`,
T2 only · no audio request before first paint · W1/W2/W3 green incl. `reduced-motion`, `no-js`, `asset-original` ·
**all five profiles → identical transition → chooser** · intro skippable from frame one.

## P2 — Vertical slice (thin macOS, end to end)
**Read first:** `macos/README.md` · `macos/01`, `02` · `macos/surfaces/{desktop,dock,menu-bar,mission-control}.md` ·
`macos/apps/finder.md` · `macos/04`, `05`, `06`.
**Build:** desktop + wallpaper · static menu bar · Dock (links, dots, minimized tiles; no magnification yet) · the
**window manager** core (open, focus/z-order, drag, minimize, zoom, close, Dock click semantics, history rules,
compact mode) · one Finder window (columns, select → URL, Back/Forward, compact drill-down) · real chooser enter/exit,
boot timing rule, Continue-in-macOS.
**Gate:** kernel proven end to end: H1, D1, P1, M3, O1 green on macOS · INP ≤ 200 ms under 4× CPU · leak loop stable ·
axe clean on home + Finder · **site deployable** with macOS `released: false` still (preview only).

## P3 — macOS complete (+ terminal engine core)
**Read first:** everything in `macos/` · `linux/02`, `03`, `04` (engine core) · `shared/14`, `15`, `20`, `21`.
**Work orders:** **3a** terminal engine library (`LNX-SH-*`, `LNX-FS-*`, `LNX-CMD-*` marked P3) — pure TS, unit-tested
before any UI · **3b** remaining surfaces (boot, lock screen, full menu bar, Dock magnification/bounce/context,
Spotlight, notifications, context menus, Mission Control grid) · **3c** apps (Safari + Lenis/ScrollTrigger scope, GitHub,
Preview, Mail, VS Code, Terminal, System Settings) · **3d** cross-OS features (résumé fast path, tour, eggs, Switch OS)
· **3e** definition-of-done audit (`macos/08-acceptance.md`).
**Gate:** every `MAC-*` P2/P3 row `verified` · M1/M2/M3 + shared journeys green · audit checklist complete · deviations
signed → set macOS `released: true` → production now shows a finished macOS.

## P4 — Windows 11
**Read first:** everything in `windows/` · `shared/16` (continuity now has two OSes).
**Build:** identity (Mica/Acrylic) · window manager skin + **Snap** · taskbar, Start, Search, desktop, toasts + Quick
Settings, context menus, Task View, boot, lock · seven apps · cross-OS features · continuity in both directions
(`CONT-ACCEPT-01`, `MAC-DOCK-08`, `WIN-NOTIF-02`).
**Gate:** every `WIN-*` row `verified` · N1/N2/N3/N-keyboard + shared journeys · grayscale smell test vs macOS · audit ·
release Windows.

## P5 — iOS
**Read first:** everything in `ios/`.
**Build:** identity · **icon ↔ app flight**, Home gesture, switcher, nav stacks, sheets · Home Screen, Dock, folder,
widgets, Spotlight, banners + Notification Center, status bar + Home indicator, Control Center, quick actions, boot,
lock · seven apps · phone + **full-page** layouts (iPadOS layout on tablets, laptops and desktops — no device frame) ·
cross-OS features.
**Gate:** every `IOS-*` row `verified` · I1/I2/I-keyboard + shared journeys on iphone, ipad ×2, chromium-desktop · real
iPhone check (keyboard up, rotate) · audit · release iOS.

## P6 — Android
**Read first:** everything in `android/`.
**Build:** M3 identity + build-time dynamic colour · **container transform, system Back contract, predictive Back**,
Recents · launcher + At-a-glance, drawer (= search), favorites + search bar, shade + Quick Settings, system bars (two
nav modes), heads-up + snackbars, shortcuts, boot, lock · six apps · phone + **full-page** layouts (large-screen
launcher with taskbar on tablets, laptops and desktops — no device frame) · cross-OS features.
**Gate:** every `AND-*` row `verified` · A1/A2/A-keyboard + shared journeys on pixel, tablet ×2, chromium-desktop · real
Android check · **blur count = 0** · grayscale smell test vs iOS · audit · release Android.

## P7 — Linux
**Read first:** everything in `linux/` (engine already exists from P3).
**Build:** identity, status bar + tiling · boot log, login, MOTD · URL-encoded cwd · output animation + scrolling ·
hints (insert-only) · viewer tile · system commands, `search`, `switch`, tour, eggs · mobile prompt, `visualViewport`,
accessory row, tap-to-insert · accessibility contract.
**Gate:** every `LNX-*` row `verified` · L1/L2/L3 + shared journeys · unscripted technical-reviewer session · fuzz test ·
real-device keyboard check · audit · release Linux. **All five OSes are now live.**

## P8 — Polish and release
**Build:** cross-OS restore + continuity across all OS pairs · full Playwright matrix + nightly · visual baselines (Linux
container) · profiling procedure on production builds (`shared/10`) · leak loops · real-device + screen-reader scripts
for all five OSes (`*-A11Y-06`, `LNX-A11Y-08`, `TEST-MANUAL-01`) · OG card validation · analytics event audit ·
scheduled redeploy (`DEPLOY-CRON-01`) · forced-colors pass (`DS-THEME-01`) · **content depth** (`shared/23-content-depth.md`:
`DATA-COPY-01`, `CONTENT-*`, `MAC-GH-08`, `MAC-NOTIF-07`, `WIN-GH-07`, `WIN-START-09`, `IOS-GH-07`, `IOS-WIDG-05`,
`AND-GH-07`, `AND-KEEP-07`, `LNX-FS-08`, `LNX-BOOT-08`) — data + shared views first, then one OS at a time
(Linux → macOS → Windows → iOS → Android), pausing after Linux for the owner's look review.
**Gate:** `STATUS.md` shows 949 / 949 `verified` (or signed `BLOCKED`) · release checklist in `shared/13-deployment.md`
complete · placeholder guard passes with real résumé content.

---

## Standing rules
- One OS at a time. No starting the next OS while the current one has unverified rows.
- Every OS phase (P2–P7) opens by reconciling its surface and app files with the "Visual target" in its
  `01-identity.md` (owner storyboard, `plans/visual-targets/`), logging each change in its Deviations log, and closes
  with the Storyboard test in its definition-of-done audit.
- The owner reviews at every gate. Deviations need the owner's sign-off in that folder's log.
- New ideas mid-phase go to the **Backlog** below, not into the current work order.

## Backlog (unplanned ideas — need owner approval and a spec before they get IDs)
| Date | Idea | Proposed home |
|---|---|---|
| 2026-09-23 | iOS on slow CPUs: at 4× CPU throttling a flight still shows ~3 frames (as before the 2026-09-23 speed pass) — the first frame restyles the whole Home Screen when it turns `inert` and paints it into its layer, and an app's first open pays ~30–70 ms of one-time text setup. Candidates: `inert` on fewer nodes, a lighter Home paint, font warm-up in idle time | `plans/ios/03-motion.md` · `shared/10-performance.md` |
