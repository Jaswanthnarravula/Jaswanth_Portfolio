# Implementation record

## Authorization and plan review

On 2026-09-21 the owner authorized starting implementation, reconstructing missing plans, and completing the portfolio.
This supersedes the earlier pause while Claude wrote plans and the repeated permission stops in the roadmap.
All 148 plan documents and all five nested OS trees were inspected before application changes.
The seven ledgers enumerate 930 requirements. No plans are currently missing.

Work order: P0 foundation → P1 welcome → P2 macOS vertical slice → P3 complete macOS and terminal engine →
P4 Windows → P5 iOS → P6 Android → P7 Linux → P8 final validation. No later phase starts before the preceding gate.
Evidence is recorded in the owning ledger; this document does not substitute for acceptance tests.

## Content sources

- Primary: <https://www.linkedin.com/in/jaswanth-narravula/>, as requested by the owner.
- Supporting project information: <https://github.com/Jaswanthnarravula/>.
- Do not invent employment dates, project dates, proficiency scores, or additional experience.
- Source access: LinkedIn blocks direct anonymous retrieval; its publicly indexed profile supplies partial detail.
  GitHub's public profile is readable. Preserve provenance and distinguish reported results from measured site performance.

## Issues found during review

These remain explicit reconciliation tasks in their owning phases, not permission to omit features:

1. Shared résumé access requires one action from every surface; some mobile specs describe two actions.
   Preserve the stricter one-action requirement through native system chrome and overlay controls.
2. OS release definitions include later-phase continuity and manual audit IDs. Keep unfinished OSes unreleased;
   distinguish preview validation from final production release and reconcile the circular gates before P3 completion.
3. Persisted running-app markers, draft archives and Snap state require typed additions to the compact kernel catalogue.
4. Linux's 24-line stagger would exceed its stated 240 ms cap; cap the computed stagger rather than extending the cap.
5. A project hint must resolve from its actual cwd; use absolute home paths where needed.
6. Build a downloadable résumé from sourced content; user supplied LinkedIn instead of a résumé document.
   Done in P0: the PDF is generated from `data/portfolio.ts`; an owner file at `content/resume.pdf` replaces it.

## P0 checkpoint (2026-09-21)

The P0 gate passed on automated evidence; every P0 ledger row is `verified` except `TEST-TOOL-01`, which needs a
first GitHub PR run. Gate table, Lighthouse baseline and inputs: `plans/STATUS.md`. Departures from specs:
`plans/shared/22-acceptance.md` → Deviations log.

Defects found and fixed while validating the gate:
- `RouteSync` created its history listener one frame late, so a Back pressed straight after a reload was lost and the
  first canonical write overwrote the entry (found by the WebKit iPad project; regression test added).
- Reader contrast: white on the dark-theme accent fill was 3.6:1 and the résumé paper inherited dark-theme text
  (1.07:1). Accent darkened, the paper re-scopes its own tokens; contrast tests now cover the brand layer.
- The tier script was 691 B against a 600 B budget; rewritten to 598 B with identical behaviour.
- `content/resume.pdf` was not picked up by the résumé build as `shared/02` requires; now it is.

Still owed outside automation: real-device, screen-reader and external deployment checks need real evidence;
browser emulation is not a substitute. No commits have been made (the owner commits).

## P1 checkpoint (2026-09-21)

Everything in the P1 work order is built: Hello (SSR `<h1>`, CSS stroke draw, generated greeting paths + MorphSVG,
tiered glass, the T2 `GlassStage` shader), Tap to begin + mute, the audio engine, the skippable intro, "Who's
watching?" with five identical-behaviour profiles, and the chooser (cards, badge, prefetch, the shared-element enter
against the stub OS). Ledger rows with evidence: `plans/06-onboarding-acceptance.md` and the P1 rows of
`plans/shared/22-acceptance.md`; gate table: `plans/STATUS.md`.

Defects found and fixed while validating the gate:
- A failed OS chunk could never recover: `OSHost` loaded once on mount, so a successful Retry (or the `online`
  retry) left the kernel idle on an empty screen. It now reloads on every new attempt (regression test).
- A chooser chunk that could not load (offline before it was warmed) crashed the whole site to the root error page
  (an uncaught `React.lazy` rejection). `ChooserSlot` now contains it with Retry, an `online` retry and `/plain`.
- A fast Tab or arrow key on a busy device was undone: the FocusManager applied a stale focus request one frame
  later. Requests are now dropped when the visitor's own input moved focus meanwhile (deviation logged).
- Focus reached an OS only when its reveal ended; shared/09 says at animation start. It now moves when `entering`
  begins, so a slow reveal never leaves focus on the covered chooser card.
- The intro could run past 3.5 s: its safety timer was cancelled once the motion chunk arrived, after which a late
  chunk, GSAP lag smoothing, or the first AudioContext of a session (225–518 ms to open the audio device on this
  host) stretched it. It now ends on a wall-clock deadline counted from the tap (deviation logged).
- On a slow phone the `load` event can precede the first paint, so the intro sound, the kernel runtime and the motion
  chunk were fetched ahead of the LCP. One scheduler (`lib/motion/idle.ts`) now waits for `load` + first contentful
  paint + idle; the profile avatars no longer load behind the first-visit Hello.
- Older Safari could not decode the AVIF snapshots (blank cards); each ships with a WebP fallback in the same budget.
- The badge gave macOS to medium-width windows; plans/04 names only compact-coarse phones and expanded desktops.
- On Windows the e2e server wrapper orphaned `next start`, so a later local run could silently reuse a stale build.

Not yet evidenced (the P1 gate is therefore not passed): Lighthouse LCP ≤ 2.5 s on `/`. On this host the simulated
mobile LCP is 2.6–2.8 s (framework JS on the slow-4G model); real-device-style runs paint the `<h1>` in 0.4–1.2 s.
The reference measurement is the Vercel-preview LHCI run. The framework is 130.8 KB gzip, not the plan's ~105 KB;
the corrected first-load budget awaits the owner's sign-off. No commits have been made (the owner commits).

## P2 checkpoint (2026-09-22)

The thin macOS is built end to end and reached from the chooser: full-page desktop on the storyboard wallpaper (no
device frame), the static menu bar that follows the focused app, desktop items, the Dock (links, running dots,
minimized tiles, keyboard model), the window manager (open from the launcher rect with cascade and learned rects,
focus and z-order, drag, minimize and restore, zoom, close, Dock click rules, history rules, compact mode with a
controls menu and a Windows switcher), one Finder (columns from data, select → URL, Back/Forward, compact drill-down)
and the chooser's real enter and exit (exit beat, return flight, boot frame, Continue in macOS). All 50 P2 rows are
`verified`: `plans/macos/08-acceptance.md`, the P2 rows of `plans/shared/22-acceptance.md` and
`plans/06-onboarding-acceptance.md`; gate table in `plans/STATUS.md`. macOS stays `released: false`.

Defects found and fixed while validating the gate:
- Presses were slow: every click committed to the kernel and re-rendered the whole shell inside the handler — 400–640
  ms at 4× CPU. The PERF-INP-01 test still passed, because `web-vitals` only reports INP on page hide, so it read 0.
  Presses now paint first and commit after the frame (`dispatchSoon`, as shared/10 prescribes); windows, menu bar,
  desktop and Dock are memoised; the shell and Dock subscribe to narrow values. Worst press now 32–40 ms. The test
  reads Event Timing and fails if it saw too few presses (deviation logged).
- With commits after paint, two shortcuts in one frame could both target the same window, and Finder's drill-down
  and the window switcher moved focus before the new level existed (focus fell to `<body>` on Pixel). Shortcut
  handlers now land queued presses first (`flushQueued`); focus moves wait for the commit (`afterQueued`).
- Every OS deep link also fetched the chooser (13.6 KB): its `/`-only warm-up was scheduled before boot decoded the
  URL and never cancelled. It is cancelled now, and ARCH-SPLIT-01 asserts the chooser stays away.
- Accent-blue text inside windows was 3.7:1 and the inactive title (50 % opacity) was below 4.5:1; both use AA
  colours now (deviations logged).
- Dock running dots were clipped by the pill's overflow; GSAP `clearProps: 'all'` wiped React-owned window variables.
- After Back from a deep-linked OS the chooser could stay covered for good: it decides it is "returning" at render
  but subscribes a passive effect later, and an exit that ended in between went unseen. The stage now reads the
  kernel once when it subscribes (found by the P4 session; component test added).
- The leak test left macOS through Back after 160 fast window opens, past the router's 20-pushes-in-10-s limit
  (push degrades to replace), so Back stayed inside macOS. The history round trips now run before the app loop.

Not yet evidenced or awaiting the owner: owner review of the P2 gate (and of P0/P1, still pending); the P1 test
"W1 second visit lands on the profiles" contradicts `/` always starting at Hello (a P1 decision); the shared/10 "OS
first load ≤ 200 KB" row assumes the old framework size — `/macos` is 214.9 KB, within the re-based ≤ 226 KB;
real-device, screen-reader and deployment checks. No commits have been made (the owner commits).

## P3 checkpoint (2026-09-22)

The whole macOS is built on the P2 slice: the lock screen on first chooser entry, a menu bar with real APG menus that
follow the focused app (Apple menu, Control Center, clock → Notification Center, compact `AppName ▾`), desktop selection,
marquee and context menus, Dock magnification, labels, bounce-while-loading and Dock menus, eight-zone resize, keyboard
Move / Size, Hide Others / Show All, Mission Control, Spotlight on the shared search index, notifications, the tour and
the eggs. All eight apps are real: Finder (columns, icons, list, Quick Look, path and status bars), Safari, GitHub,
Mail (compose → `mailto:`), Preview (print, download, zoom), System Settings (every pane, search, prefs applied at once),
Terminal (zsh voice of the shared engine, two tabs, saved history) and VS Code (shared editor, lazy terminal panel).
Result: 162 of 202 P3 rows `verified`, 39 `built`, 1 `BLOCKED`; the 50 Linux engine rows are all `verified` by
`unit/terminal/*`. Details and the gap per row: `plans/macos/08-acceptance.md`, `plans/linux/13-acceptance.md`, the P3
rows of `plans/shared/22-acceptance.md`, and the P3 section of `plans/STATUS.md`.

Defects found and fixed while validating:
- Focus fell to `<body>` after overlays closed (Spotlight, sheets, the lock screen). Overlays now return focus to their
  invoker through one helper; unlocking lands on the desktop heading.
- The page behind the lock screen stayed interactive during its fade; `inert` now follows the lock state, not the fade.
- Reopening Spotlight during its fade-out reused the closing panel; each opening now gets a fresh panel.
- Dock labels were clipped and magnification was blocked by the Dock's scroll overflow; overflow now applies in compact
  only, and magnification checks that the grown Dock fits.
- White text on the accent failed contrast in several menus and lists; selection text uses `--mac-selection`.
- Several CSS modules broke pure mode (print, split views, the touch sheet); fixed without global selectors.

- The leak loop grew 3.6 MB where 2 MB is the budget. Two causes were real: ScrollTrigger keeps every scroller
  element in a module-level cache and never drops it, so each Safari open held a detached Overview page (~107 KB), and
  macOS kept the element each overlay was invoked from after the shell unmounted. Two were measurement faults in the
  test itself: it measured from a cold baseline, counting V8's first-pass compiled code as a leak, and its detached
  count pinned the very elements it measured. The loop now reports heap +1.19 MB of 2, with zero listener, DOM and
  detached-element growth, and it asserts the plan's "zero detached elements" rule for the first time.

Awaiting the owner: `MAC-BOOT-04` (needs a chooser change; the chooser was to stay unchanged); all five OSes are
`released: true` since commit cfd53de, so ARCH-REL-01 fails (2 tests) until the flags or the test change; review of the
P3 deviations. Not yet evidenced: nightly projects (landscape rail, iPad touch, forced colours, dark visual), perf traces
for the new flights and lazy chunks, a real device with the keyboard up, the screen-reader script (P8). No commits have
been made (the owner commits).

## P4 checkpoint (2026-09-22)

P4 was started at the owner's direct request ("Work only on Phase P4") before the P1–P3 gates were reviewed; the
Windows shell sits on the kernel, primitives and terminal engine those phases built. The Windows 11 portfolio is built
end to end: the centred taskbar (pills, hover previews, jump lists, tray, Show desktop), the desktop, Start and the
Start → Search morph, Task View, the window manager with Snap (drag previews, layouts flyout, system menu Snap ▸,
Alt+Shift+Arrow, paired ½ + ½ resize), Quick Settings, the Notification Center, toasts, context menus with "Show more
options", the lock screen, the boot frame, the About Windows egg, continuity and the tour — and seven apps: File
Explorer, Edge, GitHub, Outlook, Visual Studio Code (on a new shared editor body), Windows Terminal (a PowerShell
adapter over the shared engine) and Settings. Ledger rows with evidence: `plans/windows/08-acceptance.md` and the P4
rows of `plans/shared/22-acceptance.md`; gate table and evidence in `plans/STATUS.md`. Windows ledger: 114 verified,
31 built (their named test does not exist yet or did not pass on every project), 1 P8 row planned; the 5 shared P4 rows
verified. Vitest 1380 passed (the only failures are ARCH-REL-01, below); Playwright, 7 Windows specs on chromium-desktop,
reduced-motion, pixel and iphone: 181 passed, 3 retry-green flakes, 1 failure (`WIN-SET-05` on iphone).

Defects found and fixed while validating (e2e on a production preview build, plus two owner reports):
- Owner report — "clicked Safari twice, it didn't open until I reloaded": in development React Strict Mode runs every
  effect twice; the window's unmount cleanup killed the open tween at its first frame (opacity 0) and the re-run skipped
  the unchanged phase, so the window stayed invisible in `opening`. Both macOS and Windows windows now settle and forget
  the last phase on unmount (regression test `component/windows/window-strict.test.tsx`; the macOS owner kept the fix).
- Owner report — "inside OS navigations are way too slow": measured on production, windows appear 19–82 ms after the
  press and settle in 212–381 ms; in-app navigation updates the URL in 22–81 ms. The slowness came from the stuck
  window above and from the dev server compiling each app on its first open. The pinned apps and the shell's on-demand
  surfaces now load in idle time after the desktop paints (both OSes), so a first open never waits (deviation logged).
- Every Windows window lost ~60 px at the bottom: `.window > :not(.mica)` out-ranked the absolute resize zones.
- Shell menus (window system menu, jump lists, context menus) painted under windows: the menu layer's
  `backdrop-filter` made it a stacking context at level 0; the system menu also rendered inside the window, whose
  `contain: paint` clipped it and whose `overflow: hidden` let focus scroll the window content out of view (windows are
  `overflow: clip` now and every menu opens in the shell's menu layer).
- The taskbar's hover preview was clipped by the list's `overflow-x: auto` and closed when the pointer crossed the gap
  to it; title-bar double-click never maximized (the drag's pointer capture retargeted the event — macOS has the same
  pattern, reported to its owner); the snap preview needed pointer movement to appear after resting at an edge.
- Task View unmounted at once under reduced motion (`clearProps: undefined` throws inside GSAP when a zero-length tween
  completes); Esc from the Search field and choosing an already-open app left focus on `<body>` (the latter fixed in the
  kernel, confirmed with the macOS owner); `winver` from Search returned focus to `<body>`.
- Four live blur surfaces with Start and a menu open (the cap is three); an axe target-size violation on Explorer's
  breadcrumb chevrons; Outlook focus loss on phones; GitHub's phone title bar covering Back; Edge downloading
  ScrollTrigger under reduced motion.
- Start / Search, Task View, the flyouts and dialogs became on-demand chunks; a placeholder panel keeps every key
  typed before Start's chunk arrives (E9) and the real panel takes its place without a second rise. Dim text on the
  Acrylic panels read 4.2:1 over the dark wallpaper (tint without blur) — now 5.4:1 through its own token (tested).
- Career facts typed into the shell (the owner's name in Desktop and Edge paths, the site domain) now come from the
  selectors and `NEXT_PUBLIC_SITE_URL`.
- Sign-in from the lock screen now lands on the OS heading, as every chooser entry does (shared/09; the chooser spec's
  W1 / X1 pass the lock like macOS's).
- Found under a 6-worker run: a hovered accent button in Settings lightened to 3.9:1 (white on blue); every Windows
  accent hover now darkens, and a chosen accent (navy, green, …) gets its own hover tone instead of the default blue
  (unit test over every accent, both themes). About Windows closed while Search was still fading out handed focus back
  into the leaving panel, which then dropped it on `<body>`; the Properties and Keyboard shortcuts dialogs had no
  fallback at all. All three now share one return rule: the opener, else the focused window, else the desktop.
  The About Windows OK button had the same lightening hover (fixed the same way). The Windows motion probe
  (`__motion.debug()`) missed a GSAP tween until its first tick; under slow WebKit frames the tests' "settled" check
  passed while a page fade was about to start, so axe scanned half-faded pages. It now counts any unfinished top-level
  tween or timeline (the macOS and iOS probes share the gap; reported to their sessions). `WIN-CASE-03` now waits for
  the keyboard snap to land before reloading (it commits a frame after the press).
- Two shared specs still drove the Windows preview stub that P4 replaced, and failed on every project (found by the
  P5 session): `history.spec` (ARCH-SHELL-01) and `leak.spec` (PERF-LEAK-01) now open apps from the real taskbar (the
  Start sheet on phones) and switch OS through Settings › Switch operating system, as `WIN-SET-05` does. `leak.spec`
  also matched Dock names ending in ", open" only, while macOS now says ", running". It runs to the end again and
  fails on the macOS side (heap +3.59 MB against 2 MB); a temporary probe split the loop and cleared the Windows
  shell: 10 OS round trips grew the heap 0.63 MB with 0 listeners and 0 nodes, while 20 macOS app cycles grew it
  3.35 MB — reported to the macOS session with the numbers.
- The title-bar double-click hit-test called `document.elementFromPoint`, which jsdom does not implement, so the
  component tests logged an unhandled `TypeError` (found by the P5 session); it now falls back to the event's own
  target where there is no hit-testing.
- Three Windows tests were timing-fragile on a loaded machine (five sessions build and run suites on this one, and
  headless WebKit renders in software): `WIN-SET-01` caught the 1.2 s search flash mid-flight — it now records the
  flash and its overlay animation as they happen and still asserts it clears; `WIN-TERM-05` allows 15 s for the first
  Edge open, which fetches its chunk; `WIN-EDGE-04` (a PDF page plus two axe runs) is marked `test.slow()`, as the
  Outlook axe test already was. No assertion was weakened.
- The P3 session found that ScrollTrigger caches every scroller it is given and never drops it (a detached page per
  open), and fixed it in the shared `lib/motion/overview-scroll.ts`. Windows' one consumer is Edge's About tab, which
  goes through that module: measured on the preview build, 10 × open → attach → close leaves 0 detached elements,
  0 `.lenis` nodes and +0.41 MB of heap, with both libraries confirmed loaded during the run.

Budgets (production preview build, gzip, chunks fetched before idle work): `/windows` first load 241.3 KB (macOS
259.1 KB); code only Windows loads 44.4 KB against the 38 KB shell row — down from 52.7 KB after Start/Search, Task
View, the flyouts, dialogs, About Windows and the tour became on-demand chunks and the Fluent glyphs were split by
chunk. Content apps 7.1–12.3 KB; VS Code 15.3 KB (with the shared editor body); Terminal 13.8 KB plus the shared engine.
Both OSes exceed the re-based ≤ 226 KB OS first load; the budget table awaits the owner's re-base decision
(`PERF-BUDGET-01`).

Awaiting the owner: review of the P4 gate and of the P4 deviations (27 in `plans/windows/08-acceptance.md`, 8 in
`plans/shared/22-acceptance.md`); the shell-budget overage above; `MAC-DOCK-08` / `MAC-X-02` (the macOS Handoff slot,
owned by the macOS session); every OS is `released: true` since commit cfd53de, so ARCH-REL-01 fails — and a
production build would then expose Android and Linux, which nobody has built yet (`DEPLOY-PREV-01`), so the flags want
setting back to `false` except for the OSes whose gate the owner has signed off; `tsconfig.json`
from that commit fails `prettier --check` (Next appended the `.next-p3` / `.next-p4` type paths). Open issue: after
"Back to chooser" or Shut down the chooser sometimes never appears (the static fallback shows) — intermittent, seen on
iphone and under load, in the shared chooser / transition hand-off; reported to the P1–P3 sessions. Not yet evidenced: the nightly projects (Firefox, iPad, landscape, forced colours, visual
snapshots in both themes), perf traces for the flights, a real device with the keyboard up, the screen-reader script
(`WIN-A11Y-06`, P8). No commits have been made by this session (the owner commits).

## P5 checkpoint (2026-09-22)

P5 was started at the owner's direct request ("Work only on Phase P5: build the complete iOS portfolio… a full-page iOS
visual experience, not a device mockup"). The iOS portfolio is built end to end: the Lock Screen and logo boot, the Home
Screen (pages on native scroll-snap, the Search pill ↔ page dots, widgets, badges, the Career folder), the Dock with
recents, Spotlight, Control Center, the Notification Center with banners, quick actions with context previews, the App
Switcher, the status bar and Home indicator, the icon ↔ app flight and the interactive Home gesture — and seven apps:
Files with Quick Look, Safari, GitHub, Mail, Messages, Notes and Settings. There is no device frame at any size: on a
desktop the shell and every app fill the viewport in the iPadOS layout (north-star B17).

Ledger rows with evidence: `plans/ios/08-acceptance.md` (137 verified, 1 P8 row planned) and the 3 P5 rows of
`plans/shared/22-acceptance.md`; gate table and evidence in `plans/STATUS.md`. Vitest: the iOS evidence set 212/212,
full run 1605 passed; the failures are the 2 ARCH-REL-01 rows (below) and the order-flaky macOS `MAC-WM-10`. Playwright: `ios`, `ios-surfaces`, `ios-journeys` and `chooser` on
eleven projects — 645 passed, 0 failed; the three iOS `@perf` tests green.

Defects found and fixed while validating (all on production preview builds, never the dev server):
- **A cancelled WAAPI exit closed the surface that replaced it.** `cancel()` queues its event, so a fade cancelled by a
  reopen called `onClosed` on the *new* overlay: Spotlight reopened and immediately closed, the App Switcher opened over
  a fading Control Center and vanished, an app went Home and stayed `closing` forever under reduced motion, and a
  reopened Mail compose handed focus back to the Compose button. Every iOS exit (Spotlight, Control Center, Folder,
  Notification Center, Switcher, Sheet, Quick Look, `surfaceMotion`) now detaches `onfinish`/`oncancel` before it
  cancels, and each Spotlight open mounts a fresh panel.
- **Gestures were read from rendered frames.** Release velocity and the long-press timer came from the GSAP ticker, so a
  starved frame clock turned a slow drag into a flick and let a long press fire mid-swipe. Both now read the pointer
  events themselves (`releaseKinematics`, over the last 50 ms), and `Press` watches the window for movement, because a
  gesture that captures the pointer (the pager) stops moves reaching the pressed element.
- **Focus.** After the Lock Screen's slide the OS heading was focused from a timer that ran before React lifted `inert`;
  quick actions, Quick Look and the notification stacks each dropped focus to `<body>` or pulled it back to the app
  heading. Focus now moves in the commit that lifts `inert`, a modal inside an app keeps it, and clearing a stack steps
  to the next Clear.
- **Layout.** The Search pill sat under the Home indicator's hit zone in phone landscape (axe target size) and over the
  page dots on a mouse (the dots now take their own row); Spotlight's panel and the sheet layer were bound to the layout
  viewport, so with a keyboard up the field, Cancel and Send fell underneath — both follow `--vvh` / `--vv-top` now.
- **Wallpaper parallax never ran**: `gsap.ticker.add()` can tick synchronously, and the tick removed itself before the
  pending position was stored. The state is written before the ticker is added (same ordering in `surfaceMotion`).
- Plus: the Control Center had no swipe-up close, a banner's flight started at its app icon instead of the banner, the
  pad Back button was missing `data-back` (so Esc went Home), GitHub's tab switch left focus on `<body>`, quick-actions
  menus left the background live, and openness was measured against icon size, so returning from a widget left the Home
  Screen scaled.

Awaiting the owner: review of the 13 iOS deviations (`plans/ios/08-acceptance.md`) and the 6 shared ones
(`plans/shared/22-acceptance.md`), including the kernel additions (`WindowInstance.ui` + `SET_APP_UI`,
`NAVIGATE_IN_APP { replace }`, `drag({ lazyCapture })`) and the AA tint `#0068da`. Still open from earlier phases: all
five OSes are `released: true` since commit cfd53de, so ARCH-REL-01 fails and a production build would expose Android
and Linux, which nobody has built — flipping those flags is the owner's call at a gate. Not yet evidenced: Lighthouse,
real devices with the keyboard up, the screen-reader script (P8), and visual baselines (`IOS-ID-06` attaches light and
dark screenshots but sets none). No commits have been made (the owner commits).

### P5 follow-up — the look and the navigation (2026-09-22)

The owner reviewed the running OS and asked for UI and navigation work. Every surface and app was then inspected on the
real build (desktop 1440 × 900 and iPhone), side by side with `plans/visual-targets/ios-home.png`, and the gaps were
fixed:

- **Wallpaper and Dock.** The wallpaper ran a pink band across the whole bottom edge, so the Dock's glass sampled it and
  read as a pink slab. The warm colour is now a corner glow over a purple field, as in the frame, and the Dock plate is
  one material on both layouts (the full-page Dock had its own `saturate(160%)`).
- **Widgets.** Facts longer than the frame's sample text spilled outside the rounded cards ("Sugar Land, Texas" hung
  below the tile). Widgets clip, the small tiles clamp to three lines and their detail lines truncate, so the two small
  widgets stay square and equal.
- **Phone Home Screen.** A browser viewport is shorter than the device, so an icon plus its label (79 px) did not fit a
  grid row (73 px) and every label slid under the next row's icons. The icon art now sizes to its row.
- **Navigation bar.** On a pushed screen the centred title was laid over the back label ("‹ Repositor…" under
  "Enterprise SSO Identity Provider"). The bar buttons take what they need, the title takes the rest, and both
  truncate — the title never covers the back label.
- **The iPad split view.** GitHub listed the repositories in the sidebar *and* repeated the same list in the detail. The
  detail now opens on a repository, as iPadOS split views do.
- **App Switcher.** Cards showed the launch placeholder (a big app icon) instead of the running app, because the flight
  writes the placeholder's opacity inline and a parked card never reaches full openness. A parked card shows the app.
- **Control Center.** The Sound tile's "More" button sat on top of the tile's own label; it is a corner chevron now.
- Plus a duplicate React key in the shared asset credits list (one artwork credited by two OSes).

Evidence: iOS Playwright specs (`ios`, `ios-surfaces`, `ios-journeys`) plus `chooser` on eleven projects — 635 passed,
the remaining reruns green serially (the parallel failures were artifact collisions between sessions sharing
`test-results`, plus one stale preview server); `asset-original` green on a rebuilt original-assets bundle; Vitest iOS
set 243/243. One test was updated, not weakened: the H1 Back journey used to click a repository row inside the detail
screen, which on the full page now lives in the sidebar.

### P5 follow-up — the feel (2026-09-23)

The owner's second review: "iOS navigations are way too slow and not smooth as other OS like Windows and macOS… should
give a premium smooth and fast feel". Measured on the preview build (in-page, from the pointer event to the last
transform the flight writes), an open took **464 ms** and a return Home **578–614 ms**, both running at about **30 fps**,
against a macOS window at ~300 ms and 60 fps. Three causes, all fixed:

1. **The flight repainted the whole live app every frame.** The surface is a full page clipped into the flying rect, so
   each frame re-rasterised the app's content. `surfaceMotion` now leaves the body laid out but unpainted until the
   flight is 72 % open — behind the launch layer there is nothing to see anyway — and a finger-driven or parked surface
   (the App Switcher card) keeps showing the real app. Frame pacing went from ~33 ms to ~16.7 ms in the A/B.
2. **The springs were tuned for the spec's table, not for the feel.** Open r 0.42 → 0.26 ζ 0.92, close 0.50 → 0.28,
   Home settle 0.45 → 0.28, sheets 0.38 → 0.32, banner 0.45 → 0.38, nav push 350 → 300 ms, banner-out and the Safari bar
   250 → 200 ms. The spring physics are unchanged — they simply land in about a third of a second. `plans/ios/03-motion.md`
   carries the new table, with the reason, and the ledger has the deviation.
3. **The spring chased zero.** Rest was declared at 0.0015 of the distance; sub-pixel is at rest, so it is 0.004 now,
   which removes an invisible tail of roughly 80 ms.

While measuring, one real bug surfaced: a **cold app lost its flight origin**. The kernel's effect could clear the
pending launch before the app's surface registered its motion handle, so the app flew from its icon instead of the rect
that was tapped — a banner opened from the Dock icon rather than from the banner. The origin is now held until a flight
consumes it (`pendingLaunch`).

Result, same measurement: **open 16 ms to the first frame and 307 ms to land; Home 24 ms and 314 ms** — quicker than the
macOS window on this machine, at 60 fps.
