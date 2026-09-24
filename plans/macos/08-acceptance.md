| Deviations log 2026-09-22 || Deviations log 2026-09-22 || Deviations log 2026-09-22 || Deviations log 2026-09-22 || Deviations log 2026-09-22 |# macOS / 08 — Acceptance ledger

Generated from the feature tables in this folder: every `MAC-*` ID appears **exactly once** here. The feature
description and its named acceptance test live in the spec file; this ledger tracks delivery.

Status: `planned` → `built` → `verified` (or `BLOCKED` + reason + owner sign-off). **Evidence** = passing test
name / CI run / capture. An OS is flipped to `released` only when every row is `verified`.

## Ledger

### `01-identity.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-ID-01` | macOS token scope complete | P2 | verified | `unit/design/tokens.test.ts` › MAC-ID-01 the macOS token scope carries plans/macos/01-identity · `e2e/macos.spec.ts` › A11Y-AXE-01 · VIEW-HEAD-01 X1 axe WCAG 2.2 AA: macOS home and Finder, no heading-order issue in a window · green locally 2026-09-22 (preview build) | Deviations log 2026-09-22 |
| `MAC-ID-02` | Active vs inactive window appearance | P2 | verified | `e2e/macos.spec.ts` › MAC-WM-02 · MAC-ID-02 z-order follows presses; the inactive window is grey-lit with a lighter shadow; one press acts · green locally 2026-09-22 (preview build) | Deviations log 2026-09-22 |
| `MAC-ID-03` | Traffic lights: size, hit pitch, glyph visibility rules | P2 | verified | `e2e/macos.spec.ts` › MAC-ID-03 traffic lights: 24 px hit areas on a 20 px pitch; glyphs on focus and under increased contrast · green locally 2026-09-22 (preview build) |  |
| `MAC-ID-04` | Wallpaper static, light/dark, tier-2 parallax only | P2 | verified | `e2e/macos.spec.ts` › MAC-ID-04 the wallpaper is the storyboard gradient and static at T0/T1; tier 2 adds ±8 px parallax · green locally 2026-09-22 (preview build) |  |
| `MAC-ID-05` | Vibrancy materials within the 3-surface cap | P3 | verified | `e2e/macos-p3.spec.ts` › PERF-BLUR-01 X5 at most 3 live backdrop-filter surfaces with Spotlight and a banner open · `e2e/macos.spec.ts` › PERF-BLUR-01 · DS-GLASS-01 X5 at most 3 live backdrop-filter surfaces (menu bar + Dock) · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-ID-06` | Light/dark parity | P3 | built | dark tokens for every P3 surface (styles/os/macos.css, surface modules); no dark-mode visual run yet — pending the nightly `forced-colors`/visual projects |  |

### `02-window-manager.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-WM-01` | Open from launcher rect with cascade + learned rects | P2 | verified | `unit/kernel/macos-wm.test.ts` › MAC-WM-01 open placement, cascade and learned rects · `e2e/macos.spec.ts` › MAC-WM-01 the storyboard placement, the 24 px cascade and learned rects on reopen · green locally 2026-09-22 (preview build) |  |
| `MAC-WM-02` | Focus + layering + inactive appearance; click acts in one press | P2 | verified | `e2e/macos.spec.ts` › MAC-WM-02 · MAC-ID-02 z-order follows presses; the inactive window is grey-lit with a lighter shadow; one press acts · green locally 2026-09-22 (preview build) |  |
| `MAC-WM-03` | Drag with clamps, commit once, zero React renders | P2 | verified | `e2e/macos.spec.ts` › MAC-WM-03 · MOTION-DRAG-01 drag: clamped under the menu bar, ≥ 48 px reachable, one commit, zero window renders · `e2e/macos.spec.ts` › RESP-ROT-01 O1 a resize mid-drag commits the last valid rect and re-clamps · green locally 2026-09-22 (preview build) |  |
| `MAC-WM-04` | Eight-zone resize with min size; ghost at T0 | P3 | verified | `e2e/macos-p3.spec.ts` › MAC-WM-04 the bottom-right corner resizes, never below the minimum size · `e2e/macos-p3b.spec.ts` › MAC-WM-04 tier 0 resizes a ghost outline and commits once on release · `component/macos/p3-shell.test.tsx` › MAC-WM-04: each zone grows from its edges, never below minPx, never outside the workspace · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-WM-05` | Minimize (Scale) into Dock + restore, reversible mid-flight | P2 | verified | `e2e/macos.spec.ts` › MAC-WM-05 · MAC-DOCK-04 minimize (Scale) into a Dock tile; the tile restores; clicking mid-flight reverses · green locally 2026-09-22 (preview build) |  |
| `MAC-WM-06` | Zoom / restore via green button and title double-click | P2 | verified | `e2e/macos.spec.ts` › MAC-WM-06 zoom fills the workspace without distorting text; the title bar double-click restores · green locally 2026-09-22 (preview build) |  |
| `MAC-WM-07` | Close keeps app running; Quit removes dot | P3 | verified | `unit/kernel/macos-p3.test.ts` › MAC-WM-07 close keeps the app running; Quit removes the dot · `e2e/macos-p3.spec.ts` › MAC-WM-07 · MAC-DOCK-06 closing keeps the app running; Quit from the Dock menu removes the dot · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-WM-08` | Dock click semantics (open / restore / focus / no-op) | P2 | verified | `unit/kernel/macos-wm.test.ts` › MAC-WM-08 Dock click decision table · `e2e/macos.spec.ts` › MAC-WM-08 Dock clicks: open, then no-op when focused, focus when behind, restore when minimized · green locally 2026-09-22 (preview build) |  |
| `MAC-WM-09` | Window menu: Move / Size / Center by keyboard | P3 | verified | `e2e/macos-p3.spec.ts` › MAC-WM-09 M1 keyboard-only move and size from the Window menu · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-WM-10` | Compact mode: single maximized window, controls menu | P2 | verified | `component/macos/shell.test.tsx` › MAC-WM-10 compact: one controls menu · `e2e/macos.spec.ts` › MAC-WM-10 · MAC-RESP-03 · MAC-MC-03 M3 compact: one maximized window, a 44 px controls menu, the Windows switcher · green locally 2026-09-22 (preview build) |  |
| `MAC-WM-11` | History rules per window event | P2 | verified | `unit/kernel/macos-wm.test.ts` › MAC-WM-11 history rule per window event · `e2e/macos.spec.ts` › MAC-FIND-03 · ROUTE-EVENT-01 · MAC-WM-11 H1: in-app Back equals browser Back; window events follow the history table · green locally 2026-09-22 (preview build) |  |
| `MAC-WM-12` | Hide others / Show all | P3 | verified | `unit/kernel/macos-p3.test.ts` › MAC-WM-12 Hide Others / Show All · `e2e/macos-p3b.spec.ts` › MAC-WM-12 Hide Others and Show All act at once, without an animation storm · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |

### `surfaces/boot.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-BOOT-01` | Boot visuals with real-milestone progress | P3 | verified | `e2e/macos-chooser.spec.ts` › CHOOSE-ENTER-02 a slow chunk shows the boot frame; any key skips its extra beats; once per session · the boot frame lives in the chooser stage (components/welcome, P2) · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-BOOT-02` | Appearance rules (first chooser entry only; never deep link/refresh/re-entry) | P3 | verified | `e2e/macos-chooser.spec.ts` › CHOOSE-ENTER-02 a cached chunk shows no boot frame · `e2e/macos.spec.ts` › ROUTE-DEEP-01 · MAC-FIND-02 D1 cold deep link: only Finder opens, the selection is restored, no boot screen · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-BOOT-03` | Any input skips; ≤ 1.5 s added | P3 | verified | `e2e/macos-chooser.spec.ts` › CHOOSE-ENTER-02 a slow chunk shows the boot frame; any key skips its extra beats; once per session · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-BOOT-04` | Slow/failure states with /plain link | P3 | BLOCKED | failure state covered by the chooser (CHOOSE-FAIL-01 · `e2e/macos-chooser.spec.ts` › KRN-SWITCH-02 an OS switch while offline shows Retry and the plain portfolio, and recovers online); the > 4 s "Still starting up…" line needs a change to the chooser boot frame, which the P3 instruction keeps unchanged — owner decision needed | Deviations log 2026-09-22 |
| `MAC-BOOT-05` | Reduced motion removes boot | P3 | built | chooser stage: no boot frame under reduced motion (`components/welcome/chooser-stage.ts`); the reduced-motion project skips the boot-frame test instead of asserting its absence — an explicit R1 assertion is pending |  |

### `surfaces/context-menus.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-CTX-01` | Menu component + positioning/clamping | P3 | verified | `unit/macos/p3-surfaces.test.ts` › MAC-CTX-01 context menu placement · `component/macos/p3-surfaces.test.tsx` › MAC-CTX-01/06: a labelled menu, first item focused, placed inside the workspace; Esc closes · green locally 2026-09-22 (vitest) |  |
| `MAC-CTX-02` | Menus per target (table above) | P3 | verified | `unit/macos/p3-surfaces.test.ts` › MAC-CTX-02 menus per target · `e2e/macos-p3.spec.ts` › MAC-CTX-02/03/05 Shift+F10 on a desktop item; Copy Link writes the /go URL; Terminal keeps the native menu · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-CTX-03` | Three invocations: contextmenu event, long-press, visible ⋯ | P3 | verified | `e2e/macos-p3.spec.ts` › MAC-CTX-02/03/05 Shift+F10 on a desktop item; Copy Link writes the /go URL; Terminal keeps the native menu · `component/macos/p3-apps2.test.tsx` › a 500 ms long-press on an item opens its menu; the ⋯ on the selected item does too · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) | Deviations log 2026-09-22 |
| `MAC-CTX-04` | Native menu preserved on text, inputs, Terminal | P3 | verified | `e2e/macos-p3.spec.ts` › MAC-CTX-02/03/05 Shift+F10 on a desktop item; Copy Link writes the /go URL; Terminal keeps the native menu · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-CTX-05` | Get Info panel + Copy Link (canonical URL) | P3 | verified | `e2e/macos-p3.spec.ts` › MAC-CTX-02/03/05 Shift+F10 on a desktop item; Copy Link writes the /go URL; Terminal keeps the native menu · `component/macos/p3-surfaces.test.tsx` › MAC-CTX-05: Get Info shows the kind and the canonical /go link · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-CTX-06` | APG menu keyboard model, focus return | P3 | verified | `component/macos/p3-surfaces.test.tsx` › MAC-CTX-01/06: a labelled menu, first item focused, placed inside the workspace; Esc closes · the `Menu` primitive APG suite (`component/primitives`) · green locally 2026-09-22 (vitest) |  |

### `surfaces/desktop.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-DESK-01` | Wallpaper + data-driven desktop items as links | P2 | verified | `e2e/macos.spec.ts` › MAC-MENU-01 · MAC-DESK-01 · MAC-DOCK-01 the home: static menu bar, desktop items and Dock as real links · green locally 2026-09-22 (preview build) |  |
| `MAC-DESK-02` | Select vs open by pointer type; keyboard opens immediately | P3 | verified | `component/macos/p3-apps2.test.tsx` › MAC-DESK-02: a mouse click selects (no window); a double-click opens from the item · `component/macos/p3-apps2.test.tsx` › MAC-DESK-02: the keyboard (detail 0) opens at once · `e2e/macos.spec.ts` › RES-OPEN-01 the résumé opens in Preview through the kernel from the desktop, the menu bar and the Dock stack · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-DESK-03` | Marquee selection, no layout writes | P3 | built | marquee on a full-size clip-path layer, written in drag() on the ticker (surfaces/Desktop.tsx); the "no Layout during marquee drag" perf trace has not been run |  |
| `MAC-DESK-04` | Roving 2-D keyboard navigation + type-ahead | P3 | verified | `component/macos/p3-apps2.test.tsx` › MAC-DESK-04: one tab stop; arrows move; Ctrl+A selects all · green locally 2026-09-22 (vitest) |  |
| `MAC-DESK-05` | Empty-desktop click focuses Finder in the menu bar | P3 | verified | `component/macos/p3-apps2.test.tsx` › MAC-DESK-05: a press on the empty desktop clears the selection and gives the menu bar back to Finder · green locally 2026-09-22 (vitest) |  |
| `MAC-DESK-06` | Compact/touch variants | P3 | verified | `e2e/macos.spec.ts` › RES-OPEN-01 the résumé opens in Preview through the kernel from the desktop, the menu bar and the Dock stack · pixel + iphone: a tap opens, single column · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |

### `surfaces/dock.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-DOCK-01` | Dock pill with pinned apps as links, running dots | P2 | verified | `e2e/macos.spec.ts` › MAC-MENU-01 · MAC-DESK-01 · MAC-DOCK-01 the home: static menu bar, desktop items and Dock as real links · green locally 2026-09-22 (preview build) | Deviations log 2026-09-22 |
| `MAC-DOCK-02` | Magnification (formula, transform-only, spring envelope) | P3 | verified | `unit/macos/dock-magnify.test.ts` › MAC-DOCK-02 magnification maths · `e2e/macos-p3.spec.ts` › MAC-DOCK-02/05 magnification is transforms only (no window renders); labels on hover and focus · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) | Deviations log 2026-09-22 |
| `MAC-DOCK-03` | Launch bounce only while loading | P3 | built | `component/macos/p3-surfaces.test.tsx` › MAC-DOCK-03: the app is "loading" (its Dock icon bounces) only while its chunk is in flight · the throttled-chunk e2e is pending | Deviations log 2026-09-22 |
| `MAC-DOCK-04` | Minimized tiles + restore | P2 | verified | `e2e/macos.spec.ts` › MAC-WM-05 · MAC-DOCK-04 minimize (Scale) into a Dock tile; the tile restores; clicking mid-flight reverses · green locally 2026-09-22 (preview build) |  |
| `MAC-DOCK-05` | Labels on hover and on focus-visible | P3 | verified | `e2e/macos-p3.spec.ts` › MAC-DOCK-02/05 magnification is transforms only (no window renders); labels on hover and focus · `e2e/macos-p3b.spec.ts` › MAC-DOCK-05 the focused Dock icon shows its label (keyboard) · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-DOCK-06` | Dock context menu | P3 | verified | `unit/macos/p3-surfaces.test.ts` › MAC-DOCK-06: Quit only for a running app; Hide only with a visible window; Options ▸ is decorative · `e2e/macos-p3.spec.ts` › MAC-WM-07 · MAC-DOCK-06 closing keeps the app running; Quit from the Dock menu removes the dot · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-DOCK-07` | Résumé stack (Open / Download) | P3 | verified | `e2e/macos-p3.spec.ts` › MAC-X-01 Q1 the résumé from Spotlight, the lock screen and the Dock stack menu (Open / Download) · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) | Deviations log 2026-09-22 |
| `MAC-DOCK-08` | Handoff slot for continuity offers | P4 | planned | | |
| `MAC-DOCK-09` | Roving keyboard model, names with state suffix | P2 | verified | `component/macos/shell.test.tsx` › MAC-DOCK-09 the Dock: roving keyboard model and names with state · green locally 2026-09-22 (preview build) |  |
| `MAC-DOCK-10` | Compact bottom scroll + landscape left rail | P3 | built | `e2e/macos-p3.spec.ts` › MAC-MENU-07 · MAC-DOCK-10 M3 compact: one app menu, status items, a scrolling Dock · pixel + iphone green; the landscape left rail needs the nightly iphone-landscape project |  |

### `surfaces/lock-screen.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-LOCK-01` | Lock screen layout with data-driven notifications | P3 | verified | `component/macos/p3-surfaces.test.tsx` › MAC-LOCK-01/05: three notifications from data, identical for every profile · green locally 2026-09-22 (vitest) |  |
| `MAC-LOCK-02` | Appearance rules (first chooser entry per session only) | P3 | verified | `e2e/macos-p3.spec.ts` › MAC-LOCK-02 a deep link and a reload never show the lock screen · `component/macos/p3-shell.test.tsx` › MAC-LOCK-02/03: the first chooser entry locks; unlocking lands focus on the heading and says welcome · `e2e/macos-chooser.spec.ts` › CHOOSE-HIST-01 · CHOOSE-EXIT-01 Back from macOS: exit beat, the snapshot flies home into its card, session parked · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-LOCK-03` | Any input unlocks; explicit Enter button | P3 | verified | `component/macos/p3-surfaces.test.tsx` › MAC-LOCK-03: focus starts on Enter macOS; Tab navigates; a character key unlocks · `e2e/macos-chooser.spec.ts` › CHOOSE-ENTER-02 a cached chunk shows no boot frame · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-LOCK-04` | Notification = shortcut that unlocks and opens the app | P3 | verified | `component/macos/p3-surfaces.test.tsx` › MAC-LOCK-04: a notification is a link that unlocks and opens its app from the card · green locally 2026-09-22 (vitest) |  |
| `MAC-LOCK-05` | Identical for every profile | P3 | verified | `component/macos/p3-surfaces.test.tsx` › MAC-LOCK-01/05: three notifications from data, identical for every profile · green locally 2026-09-22 (vitest) |  |

### `surfaces/menu-bar.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-MENU-01` | Static bar with Apple menu, app name, status items | P2 | verified | `e2e/macos.spec.ts` › MAC-MENU-01 · MAC-DESK-01 · MAC-DOCK-01 the home: static menu bar, desktop items and Dock as real links · `component/macos/shell.test.tsx` › MAC-FIND-01 Finder lists come from the selectors; MAC-MENU-01 the app name follows focus · green locally 2026-09-22 (preview build) |  |
| `MAC-MENU-02` | Menus follow the focused app (data-driven per app) | P3 | verified | `unit/macos/menus-notifications.test.ts` › MAC-MENU-02 menus follow the focused app · `e2e/macos-p3.spec.ts` › MAC-MENU-02/03/05 menus follow the focused app, open instantly, hover switches, items act · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-MENU-03` | Instant open, hover-switch, blink + fade close | P3 | verified | `e2e/macos-p3.spec.ts` › MAC-MENU-02/03/05 menus follow the focused app, open instantly, hover switches, items act · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) | Deviations log 2026-09-22 |
| `MAC-MENU-04` | APG menubar keyboard model | P3 | verified | `e2e/macos-p3.spec.ts` › MAC-MENU-04 APG menubar keyboard: Down opens, arrows move, Esc returns to the title · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-MENU-05` | Apple menu items (About, Settings, Switch OS, Tour, Lock, Restart) | P3 | verified | `unit/macos/menus-notifications.test.ts` › MAC-MENU-05 Apple menu · `component/macos/p3-shell.test.tsx` › Lock Screen shows the lock screen; Restart confirms, replays the startup, then locks · `e2e/macos-p3.spec.ts` › MAC-MENU-02/03/05 menus follow the focused app, open instantly, hover switches, items act · `e2e/macos-p3.spec.ts` › MAC-X-03 T1 the tour runs real app openings; any input ends it and leaves the app open · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-MENU-06` | Status items: Résumé, Spotlight, Control Center, clock | P3 | verified | `e2e/macos-p3.spec.ts` › MAC-MENU-06 Control Center toggles persist; the clock opens the Notification Center · `component/macos/p3-surfaces.test.tsx` › MAC-MENU-06: toggles write prefs at once and persist · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-MENU-07` | Compact collapse to a single menu | P3 | verified | `unit/macos/menus-notifications.test.ts` › MAC-MENU-07 compact collapses to one menu · `e2e/macos-p3.spec.ts` › MAC-MENU-07 · MAC-DOCK-10 M3 compact: one app menu, status items, a scrolling Dock · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-MENU-08` | Shortcut hints show real bindings only | P3 | verified | `unit/macos/menus-notifications.test.ts` › MAC-MENU-08 shortcut hints come from the keymap registry · `unit/macos/p3-surfaces.test.ts` › MAC-MENU-08 shortcut hints are the registry chords macOS handles · green locally 2026-09-22 (vitest) |  |

### `surfaces/mission-control.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-MC-01` | Overview grid from live windows via flight (pure packing function) | P3 | verified | `unit/macos/overview-arbiter.test.ts` › MAC-MC-01 packing · `e2e/macos-p3.spec.ts` › MAC-MC-01/02/04 Alt+Shift+O: live windows fly into tiles; arrows + Enter choose; Esc returns them · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-MC-02` | Select / exit / reversible animation | P3 | verified | `e2e/macos-p3.spec.ts` › MAC-MC-01/02/04 Alt+Shift+O: live windows fly into tiles; arrows + Enter choose; Esc returns them · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-MC-03` | Compact carousel as the primary switcher + close buttons | P2 | verified | `e2e/macos.spec.ts` › MAC-WM-10 · MAC-RESP-03 · MAC-MC-03 M3 compact: one maximized window, a 44 px controls menu, the Windows switcher · `e2e/macos.spec.ts` › A11Y-AXE-01 X1 axe on the compact window switcher (an open overlay) · green locally 2026-09-22 (preview build) |  |
| `MAC-MC-04` | Keyboard model + dialog semantics | P3 | verified | `e2e/macos-p3.spec.ts` › MAC-MC-01/02/04 Alt+Shift+O: live windows fly into tiles; arrows + Enter choose; Esc returns them · `component/macos/p3-shell.test.tsx` › MAC-MC-04/05: Alt+Shift+O opens Mission Control; no windows gives shortcuts · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-MC-05` | Empty state with shortcuts | P3 | verified | `e2e/macos-p3.spec.ts` › MAC-MC-05 no windows → "No open windows" with shortcuts · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |

### `surfaces/notifications.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-NOTIF-01` | Banner component, queue (1 visible, max 3), dwell ≥ 6 s, pause on hover/focus | P3 | built | `unit/macos/menus-notifications.test.ts` › MAC-NOTIF-01 queue and Center; MAC-EDGE-04 overlays · `component/macos/p3-surfaces.test.tsx` › MAC-NOTIF-01/05: one banner at a time; focus stays put; announced through the status region · hover / focus pause implemented (native pointerenter/focusin holds); no timed assertion yet |  |
| `MAC-NOTIF-02` | Trigger table (deterministic, identical for all visitors) | P3 | verified | `unit/macos/menus-notifications.test.ts` › MAC-NOTIF-02 trigger table · green locally 2026-09-22 (vitest) |  |
| `MAC-NOTIF-03` | Notification Center keeps every banner; clear actions | P3 | verified | `component/macos/p3-surfaces.test.tsx` › MAC-NOTIF-03: every notification lands in the Center, grouped by app, and can be cleared · green locally 2026-09-22 (vitest) |  |
| `MAC-NOTIF-04` | Spring in / ease out / swipe with velocity hand-off | P3 | built | spring in / 250 ms out / swipe with velocity hand-off (surfaces/Notifications.tsx); swipe + R1 fade e2e pending |  |
| `MAC-NOTIF-05` | Never steals focus; status region semantics | P3 | verified | `component/macos/p3-surfaces.test.tsx` › MAC-NOTIF-01/05: one banner at a time; focus stays put; announced through the status region · green locally 2026-09-22 (vitest) |  |
| `MAC-NOTIF-06` | Compact variants | P3 | built | compact full-width banner + sheet Center (notifications.module.css); M3 assertion pending |  |

### `surfaces/spotlight.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-SPOT-01` | Panel with zero state, grouped results, preview pane | P3 | verified | `component/macos/p3-surfaces.test.tsx` › MAC-SPOT-01: opens on the zero state — Résumé, Projects, Contact first — in a labelled group · `e2e/macos-p3.spec.ts` › MAC-SPOT-01/02/03/06 S1 Spotlight: three invocations, zero state, a result opens with one history entry · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) | Deviations log 2026-09-22 |
| `MAC-SPOT-02` | Invocation (Ctrl/Cmd+K, menu-bar icon, `/`) and Esc clear-then-close | P3 | verified | `e2e/macos-p3.spec.ts` › MAC-SPOT-01/02/03/06 S1 Spotlight: three invocations, zero state, a result opens with one history entry · `component/macos/p3-shell.test.tsx` › MAC-SPOT-02: Ctrl+K opens Spotlight and makes the page behind inert · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-SPOT-03` | Result opens via kernel from the panel rect; one history entry | P3 | verified | `e2e/macos-p3.spec.ts` › MAC-SPOT-01/02/03/06 S1 Spotlight: three invocations, zero state, a result opens with one history entry · `component/macos/p3-surfaces.test.tsx` › MAC-SPOT-03: Enter opens the result through the kernel from the panel; Spotlight closes · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-SPOT-04` | Command results insert into Terminal, never execute | P3 | verified | `e2e/macos-p3.spec.ts` › MAC-SPOT-04 · SRCH-TERM-01 a command result opens Terminal with the command inserted, never run · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-SPOT-05` | Compact top sheet bounded by visual viewport | P3 | built | compact top sheet bounded by `--vvh` (lib/motion/visual-viewport.ts); the keyboard-up assertion needs a real device |  |
| `MAC-SPOT-06` | Combobox semantics + debounced count | P3 | verified | `component/macos/p3-surfaces.test.tsx` › MAC-SPOT-06: typing groups results with a Top Hit; the active option is the activedescendant · `e2e/macos-p3.spec.ts` › MAC-SPOT-01/02/03/06 S1 Spotlight: three invocations, zero state, a result opens with one history entry · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |

### `apps/finder.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-FIND-01` | Window with sidebar, toolbar, column view fed by selectors | P2 | verified | `component/macos/shell.test.tsx` › MAC-FIND-01 Finder lists come from the selectors; MAC-MENU-01 the app name follows focus · `e2e/macos.spec.ts` › MAC-FIND-01 · MAC-FIND-02 Finder: sidebar, columns from data, select → URL + preview, open → document · green locally 2026-09-22 (preview build) |  |
| `MAC-FIND-02` | Select → preview column + URL; open → document view | P2 | verified | `e2e/macos.spec.ts` › MAC-FIND-01 · MAC-FIND-02 Finder: sidebar, columns from data, select → URL + preview, open → document · `e2e/macos.spec.ts` › ROUTE-DEEP-01 · MAC-FIND-02 D1 cold deep link: only Finder opens, the selection is restored, no boot screen · green locally 2026-09-22 (preview build) |  |
| `MAC-FIND-03` | Back/Forward nav stack tied to history collapse | P2 | verified | `e2e/macos.spec.ts` › MAC-FIND-03 · ROUTE-EVENT-01 · MAC-WM-11 H1: in-app Back equals browser Back; window events follow the history table · green locally 2026-09-22 (preview build) |  |
| `MAC-FIND-04` | Icons / List (sortable table) / Columns views | P3 | verified | `component/macos/p3-apps2.test.tsx` › MAC-FIND-04: View as List is a real table with sortable headers (aria-sort) · `component/macos/p3-apps2.test.tsx` › MAC-FIND-04/06: View as Icons shows the home folder with its aliases; the menu command switches views · green locally 2026-09-22 (vitest) |  |
| `MAC-FIND-05` | Quick Look (Space) | P3 | verified | `component/macos/p3-surfaces.test.tsx` › MAC-FIND-05: Quick Look shows the content view; Space closes and focus returns to the row · green locally 2026-09-22 (vitest) |  |
| `MAC-FIND-06` | Aliases open the right apps | P3 | verified | `component/macos/p3-apps2.test.tsx` › MAC-FIND-04/06: View as Icons shows the home folder with its aliases; the menu command switches views · green locally 2026-09-22 (vitest) |  |
| `MAC-FIND-07` | Compact drill-down layout | P2 | verified | `e2e/macos.spec.ts` › MAC-FIND-07 M3 compact Finder drill-down: favourites → folder → document, back chevron up each level · green locally 2026-09-22 (preview build) |  |
| `MAC-FIND-08` | Empty/loading states | P3 | built | `component/macos/p3-surfaces.test.tsx` › E13: a chunk that fails shows a calm in-window state with Try again and the plain portfolio · "No items" empty folder not asserted (the data has entries) |  |
| `MAC-FIND-09` | Menu-bar menus wired | P3 | verified | `component/macos/p3-apps2.test.tsx` › MAC-FIND-09: the path and status bars, and their View-menu toggles · green locally 2026-09-22 (vitest) |  |

### `apps/github.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-GH-01` | App shell: sidebar profile, pinned grid, repository list | P3 | verified | `component/macos/p3-apps2.test.tsx` › MAC-GH-01/04: profile, pinned cards from data, stack filters narrow the list · green locally 2026-09-22 (vitest) |  |
| `MAC-GH-02` | Project detail with README / Stack / Links tabs + About rail | P3 | verified | `component/macos/p3-apps2.test.tsx` › MAC-GH-02/06: a project detail has README · Stack · Links tabs; external links open a new tab, announced · green locally 2026-09-22 (vitest) |  |
| `MAC-GH-03` | GitHub enrichment + heatmap with accessible alternative | P3 | built | enrichment merge + heatmap with table alternative (apps/GitHub.tsx); the committed snapshot has no contributions, so the heatmap is not exercised |  |
| `MAC-GH-04` | Stack filter chips | P3 | verified | `component/macos/p3-apps2.test.tsx` › MAC-GH-01/04: profile, pinned cards from data, stack filters narrow the list · green locally 2026-09-22 (vitest) |  |
| `MAC-GH-05` | List ↔ detail flight, reversible | P3 | built | card → header flight, reversed by the in-app back chevron (apps/GitHub.tsx); mid-flight e2e pending |  |
| `MAC-GH-06` | External link treatment | P3 | verified | `component/macos/p3-apps2.test.tsx` › MAC-GH-02/06: a project detail has README · Stack · Links tabs; external links open a new tab, announced · green locally 2026-09-22 (vitest) |  |
| `MAC-GH-07` | Compact pushed-page layout | P3 | built | compact pushed page + segmented tabs (github.module.css); M3 assertion pending |  |

### `apps/mail.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-MAIL-01` | Three-pane client with data-generated inbox | P3 | verified | `component/macos/p3-apps.test.tsx` › MAC-MAIL-01: three messages generated from data, unread and named for assistive tech · green locally 2026-09-22 (vitest) |  |
| `MAC-MAIL-02` | Compose sheet with persisted draft | P3 | verified | `component/macos/p3-apps.test.tsx` › MAC-MAIL-02/06: compose is a labelled dialog form; the draft lives in the window and Enter never sends · `e2e/macos-p3.spec.ts` › MAC-MAIL-02 P1 the compose draft survives reload; Ctrl+Enter hands off to mailto: · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-MAIL-03` | Send = encoded `mailto:` hand-off + confirmation + copy fallback | P3 | verified | `component/macos/p3-apps.test.tsx` › MAC-MAIL-03: Ctrl+Enter sends an encoded mailto:, shows the confirmation and clears the draft · `component/macos/p3-apps.test.tsx` › MAC-MAIL-03: a body too long for mailto: is cut with a note and copied in full · green locally 2026-09-22 (vitest) |  |
| `MAC-MAIL-04` | Copy address with clipboard fallback + banner | P3 | verified | `component/macos/p3-apps.test.tsx` › MAC-MAIL-04: Copy Address uses the clipboard; blocked → a selected read-only field · green locally 2026-09-22 (vitest) |  |
| `MAC-MAIL-05` | Compact push navigation + full-height compose | P3 | built | compact push navigation + full-height compose with sticky Send (mail.module.css); M3 assertion pending |  |
| `MAC-MAIL-06` | Form semantics, keyboard send, polite confirmation | P3 | verified | `component/macos/p3-apps.test.tsx` › MAC-MAIL-02/06: compose is a labelled dialog form; the draft lives in the window and Enter never sends · `e2e/macos-p3.spec.ts` › MAC-MAIL-02 P1 the compose draft survives reload; Ctrl+Enter hands off to mailto: · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |

### `apps/preview.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-PREV-01` | Viewer window with toolbar, thumbnails, page canvas | P3 | verified | `component/macos/p3-apps2.test.tsx` › MAC-PREV-01/03/04/06: toolbar; Download names the file; the text version is first in DOM and printable · green locally 2026-09-22 (vitest) |  |
| `MAC-PREV-02` | The PDF's pages as page images (shared/03 `VIEW-RESUME-01`) | P3 | verified | `e2e/resume.spec.ts` › macos: the résumé viewer shows the published PDF's page (/macos/preview) · webkit-desktop + iphone (WebKit), chromium-desktop, pixel, firefox-desktop green 2026-09-23 (preview build .next-resume) · `component/macos/p3-apps2.test.tsx` › MAC-PREV-01/03/04/06 (no `<object>`) | shared/22 Deviations log 2026-09-23 |
| `MAC-PREV-03` | Download with filename + analytics + banner | P3 | verified | `e2e/macos.spec.ts` › RES-DL-01 Download saves Jaswanth-Resume.pdf and records resume_downloaded · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-PREV-04` | Text version first in DOM; toggle | P3 | verified | `component/macos/p3-apps2.test.tsx` › MAC-PREV-01/03/04/06: toolbar; Download names the file; the text version is first in DOM and printable · green locally 2026-09-22 (vitest) |  |
| `MAC-PREV-05` | Zoom scoped to the canvas | P3 | verified | `component/macos/p3-apps2.test.tsx` › MAC-PREV-05: Ctrl + wheel zooms the pages (the canvas), never the page · green locally 2026-09-22 (vitest) |  |
| `MAC-PREV-06` | Print stylesheet hides OS chrome | P3 | verified | `e2e/macos-p3b.spec.ts` › MAC-PREV-06 printing Preview prints only the résumé · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |

### `apps/safari.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-SAF-01` | Browser chrome: toolbar, address pill, tabs, favourites | P3 | verified | `component/macos/p3-apps2.test.tsx` › MAC-SAF-01/02/05: address pill, APG tabs (About · Now · Plain version), the Overview from data; axe clean · green locally 2026-09-22 (vitest) |  |
| `MAC-SAF-02` | Overview content from `AboutOverview` | P3 | verified | `component/macos/p3-apps2.test.tsx` › MAC-SAF-01/02/05: address pill, APG tabs (About · Now · Plain version), the Overview from data; axe clean · green locally 2026-09-22 (vitest) |  |
| `MAC-SAF-03` | Lenis + ScrollTrigger scoped to this scroller, gated by pointer/tier/motion | P3 | verified | `e2e/macos-p3b.spec.ts` › MAC-SAF-03/06 · MOTION-SCROLL-01 smooth scroll runs on the Overview scroller only where allowed, and is torn down on close · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-SAF-04` | Effects are enhancement only | P3 | verified | `component/macos/p3-apps2.test.tsx` › MAC-SAF-03/04: the scroll effects are gated (never in jsdom: no fine pointer); content is complete without them · green locally 2026-09-22 (vitest) |  |
| `MAC-SAF-05` | Tabs (APG) incl. inline plain version | P3 | verified | `component/macos/p3-apps2.test.tsx` › MAC-SAF-01/02/05: address pill, APG tabs (About · Now · Plain version), the Overview from data; axe clean · green locally 2026-09-22 (vitest) |  |
| `MAC-SAF-06` | Lifecycle cleanup (destroy on close/minimize) | P3 | verified | `e2e/macos-p3b.spec.ts` › MAC-SAF-03/06 · MOTION-SCROLL-01 smooth scroll runs on the Overview scroller only where allowed, and is torn down on close · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-SAF-07` | Compact layout with bottom segmented control | P3 | verified | `component/macos/p3-apps2.test.tsx` › MAC-SAF-07: compact puts the tabs in a bottom segmented control · green locally 2026-09-22 (vitest) |  |

### `apps/system-settings.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-SET-01` | Settings window with panes + search | P3 | verified | `component/macos/p3-apps.test.tsx` › MAC-SET-01: search filters the panes and highlights the matching control · `e2e/macos-p3.spec.ts` › MAC-SET-01/02 A11Y-PREF-01 Settings: search highlights; Reduce motion applies at once and persists · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-SET-02` | Accessibility & motion controls apply instantly and persist | P3 | verified | `component/macos/p3-apps.test.tsx` › MAC-SET-02: Reduce motion, Increase contrast and Larger text apply at once and persist in prefs · `e2e/macos-p3.spec.ts` › MAC-SET-01/02 A11Y-PREF-01 Settings: search highlights; Reduce motion applies at once and persists · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-SET-03` | Appearance, Sound, Desktop & Dock prefs wired | P3 | verified | `component/macos/p3-apps.test.tsx` › MAC-SET-03: Dock magnification and size; theme and accent · green locally 2026-09-22 (vitest) | Deviations log 2026-09-22 |
| `MAC-SET-04` | Privacy + Legal notices surfaces | P3 | verified | `component/macos/p3-apps.test.tsx` › MAC-SET-04: Privacy states what is counted; General shows About facts, eggs n / N and the legal notice · green locally 2026-09-22 (vitest) |  |
| `MAC-SET-05` | Switch Operating System + Back to chooser | P3 | verified | `component/macos/p3-apps.test.tsx` › MAC-SET-05: Switch Operating System lists the visible OSes and Back to chooser · `e2e/macos-p3b.spec.ts` › MAC-X-05 Alt+Shift+S opens the Switch OS sheet; switching parks the session; coming back restores it · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-SET-06` | About This Mac egg | P3 | verified | `component/macos/p3-surfaces.test.tsx` › MAC-SET-06 / EGG-ABOUT-01: About This Mac lists Jaswanth as the hardware and counts the egg once · green locally 2026-09-22 (vitest) | Deviations log 2026-09-22 |
| `MAC-SET-07` | Semantics: switches, radio swatches, headings | P3 | verified | `component/macos/p3-apps.test.tsx` › MAC-SET-01/07: a nav list of panes, a labelled pane region with headings, axe clean · `e2e/macos-p3.spec.ts` › A11Y-AXE-01 X1 axe clean with Spotlight, Settings and Mission Control open · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |

### `apps/terminal.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-TERM-01` | Terminal window skin (zsh prompt, profiles, live cols×rows title) | P3 | verified | `component/macos/p3-apps.test.tsx` › MAC-TERM-01/04: the zsh window title with cols × rows, the static first line before the engine · `e2e/macos-p3.spec.ts` › MAC-TERM-01/03/05 P1 zsh prompt, live title, `open resume` → Preview; history survives reload · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-TERM-02` | Shared engine reuse (no fork of logic) | P3 | verified | apps/Terminal.tsx renders the shared TerminalView (lib/terminal, no fork) · `unit/terminal/*` (the L1 command suite, 211 tests) · green locally 2026-09-22 (vitest) |  |
| `MAC-TERM-03` | `open` dispatches the owning macOS app | P3 | verified | `unit/macos/p3-surfaces.test.ts` › MAC-TERM-03: `open` dispatches OPEN_APP for the app that owns the content · `e2e/macos-p3.spec.ts` › MAC-TERM-01/03/05 P1 zsh prompt, live title, `open resume` → Preview; history survives reload · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-TERM-04` | Lazy engine chunk with instant static first line | P3 | verified | `component/terminal/terminal-view.test.tsx` › MAC-TERM-04 the static first line shows before the engine chunk resolves; commands typed meanwhile run later · green locally 2026-09-22 (vitest) |  |
| `MAC-TERM-05` | Session persistence (cwd, history, scrollback cap) | P3 | verified | `e2e/macos-p3.spec.ts` › MAC-TERM-01/03/05 P1 zsh prompt, live title, `open resume` → Preview; history survives reload · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-TERM-06` | Accessibility contract parity with Linux | P3 | verified | `component/terminal/terminal-view.test.tsx` › MAC-TERM-06 terminal accessibility contract · green locally 2026-09-22 (vitest) |  |

### `apps/vscode.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-CODE-01` | Editor shell: activity bar, Explorer tree, tabs, status bar | P3 | verified | `component/macos/p3-apps2.test.tsx` › MAC-CODE-01/02/07: the Explorer tree lists files generated from data; the command centre opens Spotlight · green locally 2026-09-22 (vitest) |  |
| `MAC-CODE-02` | Files generated from data by formatters | P3 | verified | `unit/content/workspace.test.ts` (shared generator) · `component/macos/p3-apps2.test.tsx` › MAC-CODE-01/02/07: the Explorer tree lists files generated from data; the command centre opens Spotlight · green locally 2026-09-22 (vitest) |  |
| `MAC-CODE-03` | Lightweight syntax tokenizers (no editor library) | P3 | built | `unit/content/syntax.test.ts` (shared tokenizers); the ≤ 15 KB gz chunk budget has not been measured for the macOS VS Code chunk |  |
| `MAC-CODE-04` | Read-only message, inlay skill hints | P3 | built | read-only notice + inlay hints live in the shared EditorBody (components/os/shared/editor); no macOS-hosted assertion yet |  |
| `MAC-CODE-05` | Search view on the shared index; palette = Spotlight | P3 | built | `component/macos/p3-apps2.test.tsx` › MAC-CODE-01/02/07: the Explorer tree lists files generated from data; the command centre opens Spotlight · the Search view (shared EditorBody) is not asserted in the macOS host |  |
| `MAC-CODE-06` | Embedded Terminal panel (lazy engine) | P3 | verified | `component/macos/p3-apps2.test.tsx` › MAC-CODE-06: Terminal → New Terminal mounts the panel with the shared terminal (lazy) · green locally 2026-09-22 (vitest) |  |
| `MAC-CODE-07` | Tree/tabs semantics + plain skills alternative | P3 | built | tree / tabs roles from the shared EditorBody; no macOS axe or keyboard-tree run yet |  |
| `MAC-CODE-08` | Compact layout | P3 | built | compact layout from the shared EditorBody (`compact` prop); M3 assertion pending |  |

### `03-motion.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-MOTION-01` | Timing table implemented as tokens (no magic numbers in components) | P3 | verified | `unit/macos/p3-surfaces.test.ts` › MAC-MOTION-01 the macOS timing table as tokens (plans/macos/03-motion.md) · green locally 2026-09-22 (vitest) |  |
| `MAC-MOTION-02` | Every transition reversible/interruptible as specified | P3 | built | `e2e/macos.spec.ts` › KRN-EDGE-01 · MAC-EDGE-01 impatience (E1–E7): spam, cancel, reverse, cycle, resize — state stays valid · `e2e/macos-p3.spec.ts` › MAC-MC-01/02/04 Alt+Shift+O: live windows fly into tiles; arrows + Enter choose; Esc returns them · the full impatience script over Mission Control is pending |  |
| `MAC-MOTION-03` | Compositor-only properties in all flights | P3 | built | `e2e/performance.spec.ts` › MOTION-RULE-02 no Layout > 1 ms inside a tagged macOS flight (open, minimize, restore, zoom, close) · green locally 2026-09-22 (preview build, perf project) · P3 flights (Mission Control, banners, sheets) are not yet tagged in that trace |  |
| `MAC-MOTION-04` | Reduced-motion variants | P3 | verified | every macOS e2e suite (`macos.spec.ts`, `macos-p3.spec.ts`, `macos-p3b.spec.ts`, `macos-chooser.spec.ts`) green in the reduced-motion project · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |

### `04-responsive.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-RESP-01` | Full-fidelity posture (`expanded`/`large`) | P3 | verified | every macOS e2e suite green at 1440 × 900 (chromium-desktop) · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) | Deviations log 2026-09-22 |
| `MAC-RESP-02` | Touch desktop posture: touch drag, resize corner, Tile menu, long-press | P3 | built | touch posture: 44 px resize corner, Tile Left / Right / Fill, long-press menus (window.module.css, menus.ts); the ipad-landscape M2-touch run is pending |  |
| `MAC-RESP-03` | Compact window mode (single window, controls menu, Windows button) | P2 | verified | `e2e/macos.spec.ts` › MAC-WM-10 · MAC-RESP-03 · MAC-MC-03 M3 compact: one maximized window, a 44 px controls menu, the Windows switcher · green locally 2026-09-22 (preview build) |  |
| `MAC-RESP-04` | Compact landscape left-rail Dock | P3 | built | left-rail Dock + left workspace inset in compact landscape (lib/kernel/registry.ts, macos.module.css); needs the nightly iphone-landscape project |  |
| `MAC-RESP-05` | Safe areas + dvh; keyboard-aware sheets | P3 | built | safe areas + `--vvh` tracking (lib/motion/visual-viewport.ts); keyboard-up check needs a real device |  |
| `MAC-RESP-06` | Size-class transitions restore/maximize without storms | P3 | verified | `e2e/macos-p3b.spec.ts` › MAC-RESP-06 crossing into compact maximizes without a storm; crossing back restores the floating rect · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-RESP-07` | 400 % zoom engages compact mode | P3 | verified | `e2e/macos-p3b.spec.ts` › MAC-RESP-07 · RESP-ZOOM-01 400 % zoom (a 360 × 225 CSS viewport) engages compact mode · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |

### `05-accessibility.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-A11Y-01` | Landmark structure + DOM order = open order | P2 | verified | `component/macos/shell.test.tsx` › MAC-A11Y-01 · VIEW-HEAD-01 landmarks, regions and heading order · `e2e/macos.spec.ts` › MAC-A11Y-01 · A11Y-SEM-01 X2 landmarks in reading order, windows as labelled regions in open order · green locally 2026-09-22 (preview build) |  |
| `MAC-A11Y-02` | macOS semantics map rows | P3 | built | semantics per the map (menubar, dialogs, regions, trees, tabs, switches); the ARIA-snapshot review of every surface is pending |  |
| `MAC-A11Y-03` | Keyboard-only journey M1 | P3 | built | keyboard paths tested piecewise (menubar, Move / Size, Shift+F10, Mission Control, Spotlight); a single end-to-end M1 keyboard journey is pending |  |
| `MAC-A11Y-04` | Focus specifics (Dock icon/tile targets, menus return focus) | P3 | verified | `e2e/macos-p3.spec.ts` › MAC-MENU-04 APG menubar keyboard: Down opens, arrows move, Esc returns to the title · `e2e/macos-p3.spec.ts` › MAC-MENU-02/03/05 menus follow the focused app, open instantly, hover switches, items act · `component/macos/p3-surfaces.test.tsx` › MAC-FIND-05: Quick Look shows the content view; Space closes and focus returns to the row · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-A11Y-05` | Increase contrast / forced-colors rendering | P3 | built | increase contrast tokens (styles/os/macos.css) + forced-colors rules in every P3 module; the nightly forced-colors project has not been run |  |
| `MAC-A11Y-06` | Screen-reader script recorded for release | P8 | planned | | |

### `06-edge-cases.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-EDGE-01` | Scenarios E1–E7 (window abuse + resize) | P2 | verified | `e2e/macos.spec.ts` › KRN-EDGE-01 · MAC-EDGE-01 impatience (E1–E7): spam, cancel, reverse, cycle, resize — state stays valid · green locally 2026-09-22 (preview build) |  |
| `MAC-EDGE-02` | Scenarios E8–E12 (refresh, deep link, Back, OS switch/return) | P3 | verified | `e2e/macos.spec.ts` › MAC-FIND-03 · ROUTE-EVENT-01 · MAC-WM-11 H1: in-app Back equals browser Back; window events follow the history table · `e2e/macos-p3b.spec.ts` › MAC-X-05 Alt+Shift+S opens the Switch OS sheet; switching parks the session; coming back restores it · `e2e/macos-p3.spec.ts` › MAC-TERM-01/03/05 P1 zsh prompt, live title, `open resume` → Preview; history survives reload · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-EDGE-03` | Scenarios E13–E18 (failure, storage, stale data, hidden tab) | P3 | built | `component/macos/p3-surfaces.test.tsx` › E13: a chunk that fails shows a calm in-window state with Try again and the plain portfolio · storage-off note (Settings), stale data and hidden-tab cases not asserted |  |
| `MAC-EDGE-04` | Scenarios E19–E22 + overlay arbiter | P3 | built | `unit/macos/overview-arbiter.test.ts` › MAC-EDGE-04 overlay arbiter (modal dialog › menu › Spotlight › Mission Control › banner) · E19–E22 scenario run pending |  |

### `07-cross-os-features.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-X-01` | Résumé fast path in all six places | P3 | verified | `e2e/macos-p3.spec.ts` › MAC-X-01 Q1 the résumé from Spotlight, the lock screen and the Dock stack menu (Open / Download) · `e2e/macos.spec.ts` › RES-OPEN-01 the résumé opens in Preview through the kernel from the desktop, the menu bar and the Dock stack · `component/macos/p3-surfaces.test.tsx` › MAC-LOCK-04: a notification is a link that unlocks and opens its app from the card · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-X-02` | Dock Handoff slot for continuity | P4 | planned | | |
| `MAC-X-03` | Tour offer + macOS script + restart entry points | P3 | verified | `e2e/macos-p3.spec.ts` › MAC-X-03 T1 the tour runs real app openings; any input ends it and leaves the app open · `unit/macos/tour-eggs.test.ts` › TOUR-REAL-01 the macOS script drives real kernel actions · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-X-04` | Eggs wired (About This Mac, Konami, terminal eggs) + found counter | P3 | verified | `e2e/macos-p3b.spec.ts` › MAC-X-04 · EGG-COUNT-01 terminal eggs and About This Mac count once each in Settings → General · `component/macos/p3-shell.test.tsx` › EGG-KONAMI-01: the Konami code on the desktop counts the egg once and shows the banner · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |
| `MAC-X-05` | Switch OS entry points + exit beat | P3 | verified | `e2e/macos-p3b.spec.ts` › MAC-X-05 Alt+Shift+S opens the Switch OS sheet; switching parks the session; coming back restores it · `e2e/macos-chooser.spec.ts` › CHOOSE-HIST-01 · CHOOSE-EXIT-01 Back from macOS: exit beat, the snapshot flies home into its card, session parked · green locally 2026-09-22 (preview build; chromium-desktop · reduced-motion · pixel · iphone) |  |

**Total feature IDs: 157**

## Definition-of-done audit (run before flipping this OS to `released` — requirement R49)

**Visual language**
- [ ] Tokens only (no magic numbers); system font stack; icons resolve in both asset modes with identical boxes.
- [ ] Focus ring ≥ 3:1; glyphs never rely on colour alone; forced-colors legible.
- [ ] Grayscale smell test against every already-released OS passes.
- [ ] Storyboard test (north-star smell test 8): the reference state side by side with `macos-desktop.png` in `plans/visual-targets/` — only real data and real-OS details differ (`01-identity.md` → Visual target).

**Interactions**
- [ ] Every gesture has its non-gesture alternative; nothing hover-only, drag-only or double-click-only.
- [ ] Context actions reachable by keyboard, long-press and a visible affordance.
- [ ] Impatience test: spam clicks, Back, rotate, resize during every animation — nothing breaks or traps.

**Applications and discoverability**
- [ ] Every section reachable in ≤ 2 actions from the OS home; résumé in 1 action from every surface.
- [ ] Deep link, refresh, Back/Forward and persistence work for every app.
- [ ] Recruiter test: Projects, Résumé and Contact found in < 15 s, uninstructed.
- [ ] No portfolio fact typed into an OS component (selectors + content views only).

**Responsive**
- [ ] All five matrix columns pass; rotation mid-animation; 320 px reflow; 200 % text; 400 % zoom.
- [ ] Real iPhone + Android check with the keyboard up; tap-target audit green.

**Accessibility**
- [ ] axe 0 violations (home + one app + open overlays); "incomplete" contrast results reviewed.
- [ ] ARIA snapshot approved; keyboard-only journey passes; focus never on `<body>`.
- [ ] Screen-reader script passes (NVDA + VoiceOver); reduced motion, reduced transparency, increased contrast verified.

**Performance**
- [ ] Lighthouse CI + INP gates green on this OS's home and one deep link; shell within its JS budget.
- [ ] ≤ 3 live `backdrop-filter` surfaces; no three.js chunk requested; leak loop stable.

**Journeys green:** M1 · M2 · M3 · H1 · D1 · P1 · R1 · O1 · S1 · T1 · C1 · Q1 · X1–X5 on macOS

**Plan conformance**
- [ ] Every row above is `verified` with evidence, or `BLOCKED` with owner sign-off.
- [ ] Every "Not like the others" clause in this folder is demonstrably true.
- [ ] Deviations below are complete and signed.

## Deviations log
| Date | ID | What changed vs the spec | Why | Owner sign-off |
|---|---|---|---|---|
| 2026-09-22 | `MAC-ID-01` | Link and accent **text** inside window bodies uses `--mac-link` (`#0066d6` light · `#4aa0ff` dark), not the accent `oklch(0.62 0.19 255)`; fills, selection and focus rings keep the accent | The accent as text on the white window surface is 3.7 : 1, below WCAG AA 4.5 : 1 (`DS-SCRIM-01`, `A11Y-AXE-01` failed on it); macOS itself draws links in a darker blue than its accent | Owner authorization 2026-09-21 (plans/README); for review at the P2 gate |
| 2026-09-22 | `MAC-ID-02` | Inactive window title text is a solid grey (`#68686c` light · `#a4a4aa` dark) instead of the title colour at 50 % opacity | 50 % opacity measured below 4.5 : 1 on the inactive title bar; the solid grey reads as the same dimmed title and passes AA (`A11Y-AXE-01`) | Owner authorization 2026-09-21 (plans/README); for review at the P2 gate |
| 2026-09-22 | `MAC-BOOT-04` | The > 4 s "Still starting up…" line with the /plain link is **not built**; the failure state (Retry + /plain) is the chooser's (`CHOOSE-FAIL-01`, `KRN-SWITCH-02`) | The boot frame is drawn by the chooser stage (components/welcome); the P3 instruction keeps the welcome and chooser unchanged. Row is `BLOCKED` until the owner allows the one-line chooser change | Owner decision needed |
| 2026-09-22 | `MAC-DOCK-01` | Trash is omitted from the Dock | No genuine Trash artwork in the asset set, and stand-in tiles are not allowed (owner preference: real icons only). It was decorative, so no journey loses anything | For review at the P3 gate |
| 2026-09-22 | `MAC-DOCK-02` | The Dock plate does not widen with magnification; icons grow up and out of the plate | A widening plate re-lays out the blurred surface every frame; keeping it fixed keeps magnification transform-only and inside the blur budget (`PERF-BLUR-01`) | For review at the P3 gate |
| 2026-09-22 | `MAC-DOCK-03` | Idle-time warming of app chunks (`warmApps`, after first paint, skipped under Save-Data) plus preload on hover/focus, so the bounce is rarely seen | Owner direction relayed by the P4 session (fast opens beat the loading cue); the bounce still shows whenever a chunk is genuinely in flight | Owner direction (relayed 2026-09-22) |
| 2026-09-22 | `MAC-DOCK-07` | The Résumé stack opens Preview in **one click**; Open in Preview · Download PDF live in its context menu (right-click, Shift+F10, long-press) instead of a click fan | Résumé in one action from every surface (`RES-IDIOM-01`, DoD); a click fan would make it two | For review at the P3 gate |
| 2026-09-22 | `MAC-SPOT-01` | Spotlight adds a "Portfolio" group (Résumé · Projects · Contact) to the zero state and results | The recruiter path must be the first thing Spotlight offers; the other groups keep the spec order | For review at the P3 gate |
| 2026-09-22 | `MAC-SET-06` | About This Mac shows the Memory row ("{years} years experience") only when the data has start dates | The years are computed from `data/portfolio.ts`; with no dates the row would be invented text | For review at the P3 gate |
| 2026-09-22 | `MAC-SET-03` | Accent swatches: six shown; the shared palette's plum is labelled "Pink"; navy, teal and graphite all map to Graphite on macOS | macOS names its own accents; the shared pref values stay the same across OSes | For review at the P3 gate |
| 2026-09-22 | `MAC-MENU-03` | The menu-item blink and fade run on a ghost copy of the menu (`[data-mac-ghosts]`), not on the menu itself | The real menu closes and focus returns at once (input always wins); the ghost is aria-hidden and only animates opacity | For review at the P3 gate |
| 2026-09-22 | `MAC-CTX-03` | The ⋯ window-menu button in the title bar is visible only on focus or on a coarse pointer | Keeps the storyboard title bar clean on desktop; it is always in the DOM and reachable by Tab | For review at the P3 gate |
| 2026-09-22 | `MAC-RESP-01` | Compact mode collapses the menu bar to `Apple · AppName ▾`; this is the one DOM difference between postures (`RESP-DOM-01`) | The collapsed menu is a different menubar model; everything else is hidden by CSS only | For review at the P3 gate |
| 2026-09-22 | — | The P2 placeholder `apps/AppBody.tsx` is removed; every app has its own chunk | All eight apps are built in P3 | For review at the P3 gate |
| 2026-09-22 | — | P2 e2e tests adapted to P3 behaviour: desktop items open on double-click, the first chooser entry now shows the lock screen (an unlock step in `macos-chooser.spec.ts` and in `chooser.spec.ts` R1 · X1), the GitHub window is named "GitHub — Repositories", the drag grab point avoids the new ⋯ button | The P2 assertions described the vertical slice; the behaviours they check are unchanged | For review at the P3 gate |
