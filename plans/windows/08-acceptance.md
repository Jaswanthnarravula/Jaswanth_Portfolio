# Windows 11 / 08 — Acceptance ledger

Generated from the feature tables in this folder: every `WIN-*` ID appears **exactly once** here. The feature
description and its named acceptance test live in the spec file; this ledger tracks delivery.

Status: `planned` → `built` → `verified` (or `BLOCKED` + reason + owner sign-off). **Evidence** = passing test
name / CI run / capture. An OS is flipped to `released` only when every row is `verified`.

## Ledger

2026-09-25 regression (`WIN-START-05`, `WIN-CTX-01`): Windows menus now sit above the overlay layer so Start cannot cover its Power/user flyouts. The `WIN-START-04 · WIN-START-05` Playwright test checks pointer hit testing inside the overlapping Power menu before clicking Shut down; it failed on the prior build and passes on `.next-win-layer`. Start, desktop context menus, and the live-blur budget: 6/6 passed across chromium-desktop and reduced-motion. Production build/typecheck, targeted lint, and formatting passed.

### `01-identity.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-ID-01` | Windows token scope complete | P4 | verified | `e2e/windows.spec.ts` › WIN-ID-01 · WIN-ID-02 · WIN-ID-05 the wallpaper, 8 px windows with a 1 px stroke, 0 px maximized, no live b… · chromium-desktop, reduced-motion · `unit/design/tokens.test.ts` › DS-TOKEN-01 three-layer tokens + [data-os] scopes › WIN-ID-01 data-os=windows defines every semantic token … · green 2026-09-22 (preview build) |  |
| `WIN-ID-02` | Mica as counter-translated pre-blurred image (no live filter on windows) | P4 | verified | `e2e/windows.spec.ts` › WIN-ID-01 · WIN-ID-02 · WIN-ID-05 the wallpaper, 8 px windows with a 1 px stroke, 0 px maximized, no live b… · chromium-desktop, reduced-motion · green 2026-09-22 (preview build) | Deviations log 2026-09-22 |
| `WIN-ID-03` | Acrylic on transient surfaces within the 3-surface cap; solid fallback | P4 | verified | `e2e/windows.spec.ts` › WIN-ID-03 · PERF-BLUR-01 X5 at most 3 live backdrop-filter surfaces with Start and a menu open · chromium-desktop, reduced-motion · `unit/design/tokens.test.ts` › DS-SCRIM-01 guaranteed contrast over wallpaper › WIN-ID-03 Windows dim text on Acrylic flyouts ≥ 4.5:1 over… · green 2026-09-22 (preview build) |  |
| `WIN-ID-04` | Caption buttons: sizes, hover fills, red close, inactive state | P4 | built |  |  |
| `WIN-ID-05` | 8 px corners, 0 when maximized/snapped; 1 px card stroke | P4 | verified | `e2e/windows.spec.ts` › WIN-ID-01 · WIN-ID-02 · WIN-ID-05 the wallpaper, 8 px windows with a 1 px stroke, 0 px maximized, no live b… · chromium-desktop, reduced-motion · green 2026-09-22 (preview build) |  |
| `WIN-ID-06` | Light/dark parity | P4 | built |  |  |

### `02-window-manager.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-WM-01` | Open from launcher rect, centred cascade, learned rects | P4 | verified | `e2e/windows.spec.ts` › WIN-WM-01 N1 the window opens from its taskbar button and lands where the storyboard puts File Explorer · chromium-desktop, reduced-motion · `unit/kernel/windows-wm.test.ts` › WIN-WM-01 placement: centred at the app size above the 48 px taskbar; Explorer at the frame fraction › rese… · green 2026-09-22 (preview build) | Deviations log 2026-09-22 |
| `WIN-WM-02` | Focus/layering + active Mica + taskbar pill widths | P4 | verified | `e2e/windows.spec.ts` › WIN-WM-02 · WIN-TASK-02 N2 pills: active 16 px accent, running 6 px; focus and z-order follow presses · chromium-desktop, reduced-motion · green 2026-09-22 (preview build) |  |
| `WIN-WM-03` | Drag with clamps; drag-from-maximized proportional restore | P4 | verified | `e2e/windows.spec.ts` › WIN-WM-03 · WIN-WM-04 N2 drag with clamps; drag to the right edge shows the snap preview; release snaps; Es… · chromium-desktop, reduced-motion · green 2026-09-22 (preview build) |  |
| `WIN-WM-04` | Snap by drag with previews (halves, quarters, top = maximize) | P4 | verified | `e2e/windows.spec.ts` › WIN-WM-03 · WIN-WM-04 N2 drag with clamps; drag to the right edge shows the snap preview; release snaps; Es… · chromium-desktop, reduced-motion · `unit/kernel/windows-wm.test.ts` › WIN-WM-04 · WIN-WM-06 · WIN-WM-07 · WIN-WM-09 snap in the kernel › snapping keeps the pre-snap rect; a comm… · green 2026-09-22 (preview build) |  |
| `WIN-WM-05` | Snap layouts flyout (hover/focus + system menu) | P4 | verified | `e2e/windows.spec.ts` › WIN-WM-05 · WIN-WM-11 snap by keyboard: the system menu Snap ▸, the snap layouts flyout, Alt+Shift+Arrow · chromium-desktop, reduced-motion · green 2026-09-22 (preview build) |  |
| `WIN-WM-06` | Snapped state re-derives on viewport resize; drag-away restores pre-snap rect | P4 | verified | `e2e/windows.spec.ts` › WIN-RESP-06 · WIN-WM-06 O1 a viewport resize re-derives snapped windows and re-clamps floats · chromium-desktop, reduced-motion · `unit/kernel/windows-wm.test.ts` › WIN-WM-06 snap geometry: zones derive from the workspace › halves, quarters and thirds tile the workspace e… · green 2026-09-22 (preview build) |  |
| `WIN-WM-07` | Paired resize of ½+½ snapped windows | P4 | verified | `e2e/windows.spec.ts` › WIN-WM-07 paired resize: the shared edge of a ½ + ½ pair moves both windows · chromium-desktop, reduced-motion · `unit/kernel/windows-wm.test.ts` › WIN-WM-04 · WIN-WM-06 · WIN-WM-07 · WIN-WM-09 snap in the kernel › snapping keeps the pre-snap rect; a comm… · green 2026-09-22 (preview build) |  |
| `WIN-WM-08` | Minimize/restore to the taskbar button; active-click minimizes | P4 | verified | `e2e/windows.spec.ts` › WIN-WM-08 · WIN-WM-10 taskbar clicks: open · minimize when active · restore · close ends the app (pill gone) · chromium-desktop, reduced-motion · `unit/windows/model.test.ts` › WIN-WM-08 the taskbar click decision table › not running → open · minimized → restore · behind → focus · ac… · green 2026-09-22 (preview build) |  |
| `WIN-WM-09` | Maximize/restore (radius 0, no shadow), title double-click | P4 | verified | `e2e/windows.spec.ts` › WIN-WM-03 · WIN-WM-09 dragging a maximized window restores it under the pointer; title double-click toggles · chromium-desktop, reduced-motion · `unit/kernel/windows-wm.test.ts` › WIN-WM-04 · WIN-WM-06 · WIN-WM-07 · WIN-WM-09 snap in the kernel › snapping keeps the pre-snap rect; a comm… · green 2026-09-22 (preview build) |  |
| `WIN-WM-10` | Close ends the app (pill removed) | P4 | verified | `e2e/windows.spec.ts` › WIN-WM-08 · WIN-WM-10 taskbar clicks: open · minimize when active · restore · close ends the app (pill gone) · chromium-desktop, reduced-motion · green 2026-09-22 (preview build) |  |
| `WIN-WM-11` | System menu with Move / Size / Snap by keyboard; Alt+Shift+Arrow | P4 | verified | `e2e/windows.spec.ts` › WIN-WM-05 · WIN-WM-11 snap by keyboard: the system menu Snap ▸, the snap layouts flyout, Alt+Shift+Arrow · chromium-desktop, reduced-motion · `unit/kernel/windows-platform.test.ts` › WIN-WM-11 · WIN-A11Y-03 Alt+Shift+Arrow snap chords › match the four snap shortcuts, outside text fields on… · green 2026-09-22 (preview build) |  |
| `WIN-WM-12` | Compact mode (min + close only, 48 × 44) | P4 | verified | `e2e/windows.spec.ts` › WIN-WM-12 · WIN-START-07 · WIN-RESP-03 · WIN-RESP-04 N3 compact: one maximized window, min + close at 48 × … · iphone, pixel · green 2026-09-22 (preview build) |  |
| `WIN-WM-13` | History rules per window event | P4 | verified | `e2e/windows.spec.ts` › WIN-WM-13 · ROUTE-EVENT-01 H1 history per window event on Windows; Back never closes windows · chromium-desktop, reduced-motion · `unit/kernel/windows-wm.test.ts` › WIN-WM-13 history rule per window event on Windows › open / focus / close / minimize go(); snap, split, max… · green 2026-09-22 (preview build) |  |

### `surfaces/boot.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-BOOT-01` | Logo + orbiting-dots spinner (CSS transform only) | P4 | built |  |  |
| `WIN-BOOT-02` | Appearance rules (first chooser entry only) | P4 | verified | `e2e/windows.spec.ts` › ROUTE-DEEP-01 · WIN-BOOT-02 · WIN-LOCK-02 D1 cold deep links open only the named app — no boot, no lock · chromium-desktop, iphone, pixel, reduced-motion · green 2026-09-22 (preview build) |  |
| `WIN-BOOT-03` | Any input skips; ≤ 1.5 s added | P4 | verified | `e2e/windows.spec.ts` › WIN-LOCK-01 · WIN-LOCK-03 · WIN-LOCK-04 · WIN-BOOT-03 first chooser entry: lock → sign-in → desktop; a card… · chromium-desktop, reduced-motion · green 2026-09-22 (preview build) |  |
| `WIN-BOOT-04` | Slow/failure states (no fake crash screen) | P4 | built |  | Deviations log 2026-09-22 |
| `WIN-BOOT-05` | Reduced motion removes boot | P4 | built |  |  |

### `surfaces/context-menus.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-CTX-01` | Menu component with command row, glyph items, clamped positioning | P4 | verified | `component/primitives/menu-submenu.test.tsx` › WIN-CTX-01 · WIN-CTX-05 the command row › a labelled group of named icon menuitems first; Left/Right walk i… · green 2026-09-22 (preview build) |  |
| `WIN-CTX-02` | Menus per target incl. View/Sort/Refresh and Properties dialog | P4 | verified | `e2e/windows.spec.ts` › WIN-CTX-02 · WIN-CTX-03 · WIN-CTX-04 menus: desktop View ▸ resizes icons; item Properties; Show more option… · chromium-desktop, reduced-motion · `component/windows/shell.test.tsx` › WIN-CTX-02 the desktop context menu › View ▸ · Sort by ▸ · Refresh · Display settings · Personalize · Switc… · green 2026-09-22 (preview build) |  |
| `WIN-CTX-03` | "Show more options" legacy swap | P4 | verified | `e2e/windows.spec.ts` › WIN-CTX-02 · WIN-CTX-03 · WIN-CTX-04 menus: desktop View ▸ resizes icons; item Properties; Show more option… · chromium-desktop, reduced-motion · green 2026-09-22 (preview build) |  |
| `WIN-CTX-04` | Three invocations + native menu preserved on text/Terminal | P4 | verified | `e2e/windows.spec.ts` › WIN-CTX-02 · WIN-CTX-03 · WIN-CTX-04 menus: desktop View ▸ resizes icons; item Properties; Show more option… · chromium-desktop, reduced-motion · green 2026-09-22 (preview build) |  |
| `WIN-CTX-05` | APG menu semantics incl. command-row group | P4 | verified | `component/primitives/menu-submenu.test.tsx` › A11Y-PRIM-02 · WIN-CTX-05 submenus › Right opens on the first item; Left and Esc close back to the parent i… · green 2026-09-22 (preview build) |  |

### `surfaces/desktop.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-DESK-01` | Wallpaper + top-left grid of data-driven shortcuts as links | P4 | verified | `e2e/windows.spec.ts` › WIN-TASK-01 · WIN-DESK-01 · WIN-TASK-07 the home: centred taskbar and desktop shortcuts as real links @smoke · chromium-desktop, iphone, pixel, reduced-motion · green 2026-09-22 (preview build) |  |
| `WIN-DESK-02` | Selection tile, marquee, Ctrl+click multi-select (cosmetic) | P4 | built |  |  |
| `WIN-DESK-03` | Select vs open by pointer type; Enter opens | P4 | built |  |  |
| `WIN-DESK-04` | Roving keyboard grid in column-first order | P4 | built |  |  |
| `WIN-DESK-05` | Compact/touch variants | P4 | built |  |  |

### `surfaces/lock-screen.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-LOCK-01` | Lock layout: bottom-left clock, status cards from data | P4 | verified | `e2e/windows.spec.ts` › WIN-LOCK-01 · WIN-LOCK-03 · WIN-LOCK-04 · WIN-BOOT-03 first chooser entry: lock → sign-in → desktop; a card… · chromium-desktop, reduced-motion · `unit/windows/model.test.ts` › WIN-LOCK-01 · WIN-LOCK-05 lock-screen cards from data, the same for every visitor › Résumé ready · the proj… · green 2026-09-22 (preview build) |  |
| `WIN-LOCK-02` | Appearance rules | P4 | verified | `e2e/windows.spec.ts` › ROUTE-DEEP-01 · WIN-BOOT-02 · WIN-LOCK-02 D1 cold deep links open only the named app — no boot, no lock · chromium-desktop, iphone, pixel, reduced-motion · green 2026-09-22 (preview build) |  |
| `WIN-LOCK-03` | Two-step continue → sign-in (no credential field), skippable instantly | P4 | verified | `e2e/windows.spec.ts` › WIN-LOCK-01 · WIN-LOCK-03 · WIN-LOCK-04 · WIN-BOOT-03 first chooser entry: lock → sign-in → desktop; a card… · chromium-desktop, reduced-motion · `component/windows/shell.test.tsx` › WIN-LOCK-01 · WIN-LOCK-03 the lock screen › first chooser entry: cards from data; Continue → sign-in card w… · green 2026-09-22 (preview build) |  |
| `WIN-LOCK-04` | Status card = shortcut that skips sign-in and opens the app | P4 | verified | `e2e/windows.spec.ts` › WIN-LOCK-01 · WIN-LOCK-03 · WIN-LOCK-04 · WIN-BOOT-03 first chooser entry: lock → sign-in → desktop; a card… · chromium-desktop, reduced-motion · green 2026-09-22 (preview build) |  |
| `WIN-LOCK-05` | Identical for every profile | P4 | verified | `unit/windows/model.test.ts` › WIN-LOCK-01 · WIN-LOCK-05 lock-screen cards from data, the same for every visitor › Résumé ready · the proj… · green 2026-09-22 (preview build) |  |

### `surfaces/notification-center.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-NOTIF-01` | Toast component, queue, dwell ≥ 6 s, pause on hover/focus | P4 | verified | `unit/windows/model.test.ts` › WIN-NOTIF-01 · WIN-NOTIF-02 · WIN-NOTIF-03 the toast machine › one shown at a time; the rest queue (≤ 3, ov… · green 2026-09-22 (preview build) |  |
| `WIN-NOTIF-02` | Trigger table incl. continuity toast | P4 | verified | `e2e/windows.spec.ts` › CONT-ACCEPT-01 · CONT-NEVER-01 · WIN-X-02 · WIN-NOTIF-02 C1 continuity from macOS: a toast offers, never op… · chromium-desktop, reduced-motion · `unit/windows/model.test.ts` › WIN-NOTIF-01 · WIN-NOTIF-02 · WIN-NOTIF-03 the toast machine › one shown at a time; the rest queue (≤ 3, ov… · green 2026-09-22 (preview build) |  |
| `WIN-NOTIF-03` | Notification Center + calendar flyout keeps every toast | P4 | built | partial: `unit/windows/model.test.ts` › WIN-NOTIF-01 · WIN-NOTIF-02 · WIN-NOTIF-03 the toast machine › one shown at a time; the rest queue (≤ 3, ov… · green 2026-09-22 (preview build) |  |
| `WIN-NOTIF-04` | Quick Settings tiles wired to prefs (sound, motion, transparency, theme, Switch OS) | P4 | verified | `e2e/windows.spec.ts` › WIN-TASK-05 · WIN-NOTIF-04 the tray: Quick Settings tiles toggle and persist; the clock opens the Center · chromium-desktop, reduced-motion · green 2026-09-22 (preview build) |  |
| `WIN-NOTIF-05` | Motion (333/167, 167/83) + reduced-motion fades | P4 | built |  |  |
| `WIN-NOTIF-06` | Never steals focus; semantics for tiles, slider, calendar | P4 | built |  |  |
| `WIN-NOTIF-07` | Compact combined sheet | P4 | built |  |  |

### `surfaces/search.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-SEARCH-01` | Flyout with best match, grouped list, preview pane, chips | P4 | built |  |  |
| `WIN-SEARCH-02` | Start ↔ Search in-place morph on typing | P4 | verified | `e2e/windows.spec.ts` › WIN-START-01 · WIN-START-03 · WIN-SEARCH-02 N1 Start above the centred taskbar; typing morphs it into Search · chromium-desktop, reduced-motion · `component/windows/launcher-lazy.test.tsx` › WIN-SEARCH-02 · WIN-START-03 keys typed while Start / Search loads all reach the Search box · green 2026-09-22 (preview build) |  |
| `WIN-SEARCH-03` | Result opens via kernel from the flyout rect; one history entry | P4 | verified | `e2e/windows.spec.ts` › WIN-SEARCH-03 · SRCH-ACT-01 S1 a result opens through the kernel with exactly one history entry · chromium-desktop, reduced-motion · green 2026-09-22 (preview build) |  |
| `WIN-SEARCH-04` | Command results insert into Terminal; `winver` egg | P4 | verified | `e2e/windows.spec.ts` › WIN-SEARCH-04 · SRCH-TERM-01 a command is inserted into Terminal, never run; winver opens the About dialog · chromium-desktop, reduced-motion · green 2026-09-22 (preview build) |  |
| `WIN-SEARCH-05` | Compact single-pane sheet bounded by visual viewport | P4 | built |  |  |
| `WIN-SEARCH-06` | Combobox semantics, chips radiogroup, count status | P4 | verified | `component/windows/shell.test.tsx` › WIN-START-01 · WIN-START-08 · WIN-SEARCH-02 · WIN-SEARCH-06 Start and Search › typing in Start morphs it into Search… chips are a radiogroup · `e2e/windows.spec.ts` › WIN-A11Y-02 · A11Y-AXE-01 · WIN-START-08 · WIN-SEARCH-06 X1 axe clean with Search open · chromium-desktop, reduced-motion (3 of 3 runs each) · green 2026-09-22 (preview build) |  |

### `surfaces/start-menu.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-START-01` | Panel layout: search, pinned grid, recommended, footer | P4 | verified | `e2e/windows.spec.ts` › WIN-START-01 · WIN-START-03 · WIN-SEARCH-02 N1 Start above the centred taskbar; typing morphs it into Search · chromium-desktop, reduced-motion · `component/windows/shell.test.tsx` › WIN-START-01 · WIN-START-08 · WIN-SEARCH-02 · WIN-SEARCH-06 Start and Search › Start: a dialog with the sea… · green 2026-09-22 (preview build) |  |
| `WIN-START-02` | Pinned + Recommended generated from registry and data | P4 | verified | `unit/windows/model.test.ts` › WIN-START-02 Start from the registry and data › Pinned: every Windows app, then Résumé, Projects, Experienc… · green 2026-09-22 (preview build) | Deviations log 2026-09-22 |
| `WIN-START-03` | Type-to-search hand-off | P4 | verified | `e2e/windows.spec.ts` › WIN-START-01 · WIN-START-03 · WIN-SEARCH-02 N1 Start above the centred taskbar; typing morphs it into Search · chromium-desktop, reduced-motion · `component/windows/launcher-lazy.test.tsx` › WIN-SEARCH-02 · WIN-START-03 keys typed while Start / Search loads all reach the Search box · green 2026-09-22 (preview build) |  |
| `WIN-START-04` | All apps view with letter jump | P4 | verified | `e2e/windows.spec.ts` › WIN-START-04 · WIN-START-05 All apps with the letter jump; Shut down returns to the chooser, the session pa… · chromium-desktop, reduced-motion · green 2026-09-22 (preview build) |  |
| `WIN-START-05` | User tile + power menu (Lock, Switch OS / Shut down → chooser, Restart) | P4 | verified | `e2e/windows.spec.ts` › WIN-START-04 · WIN-START-05 All apps with the letter jump; Shut down returns to the chooser, the session pa… · chromium-desktop, reduced-motion · green 2026-09-22 (preview build) |  |
| `WIN-START-06` | Open/close motion (250 / 167 ms), window opens from the tile rect | P4 | built |  |  |
| `WIN-START-07` | Compact full-height sheet, modal, Back closes | P4 | verified | `e2e/windows.spec.ts` › WIN-WM-12 · WIN-START-07 · WIN-RESP-03 · WIN-RESP-04 N3 compact: one maximized window, min + close at 48 × … · iphone, pixel · green 2026-09-22 (preview build) |  |
| `WIN-START-08` | Dialog semantics, 2-D roving grid, focus rules | P4 | verified | `component/windows/shell.test.tsx` › WIN-START-01 · WIN-START-08 · WIN-SEARCH-02 · WIN-SEARCH-06 Start and Search › Start: a dialog with the search box, a pinned grid of links… Esc → Start button · `e2e/windows.spec.ts` › WIN-A11Y-02 · A11Y-AXE-01 · WIN-START-08 · WIN-SEARCH-06 X1 axe clean with Start open · chromium-desktop, reduced-motion (3 of 3 runs each) · green 2026-09-22 (preview build) |  |
| `WIN-START-09` | "Now" as the first Recommended item, opens Edge About | P8 | verified | `unit/windows/model.test.ts` › WIN-START-09 · Recommended: Now first (title, Updated Sep 2026, opens About in Edge), then Résumé.pdf … six slots · Windows e2e chromium-desktop 47 passed · green 2026-09-25 (production build) | |

### `surfaces/task-view.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-TV-01` | Overview grid incl. minimized windows; titles above tiles; ✕ per tile | P4 | verified | `e2e/windows.spec.ts` › WIN-TV-01 · WIN-TV-02 · WIN-TV-04 Task View: every window incl. minimized, titles above tiles; close regrid… · chromium-desktop, reduced-motion · green 2026-09-22 (preview build) |  |
| `WIN-TV-02` | Select / close / exit; reversible animation; snap groups | P4 | verified | `e2e/windows.spec.ts` › WIN-TV-01 · WIN-TV-02 · WIN-TV-04 Task View: every window incl. minimized, titles above tiles; close regrid… · chromium-desktop, reduced-motion · green 2026-09-22 (preview build) |  |
| `WIN-TV-03` | Compact card list as the primary switcher | P4 | built |  |  |
| `WIN-TV-04` | Dialog semantics + keyboard model | P4 | verified | `e2e/windows.spec.ts` › WIN-TV-01 · WIN-TV-02 · WIN-TV-04 Task View: every window incl. minimized, titles above tiles; close regrid… · chromium-desktop, reduced-motion · `component/windows/shell.test.tsx` › WIN-TV-04 · WIN-TV-05 Task View › a modal dialog; windows as buttons incl. minimized; the disabled New desk… · green 2026-09-22 (preview build) |  |
| `WIN-TV-05` | Decorative single-desktop strip + empty state | P4 | verified | `component/windows/shell.test.tsx` › WIN-TV-04 · WIN-TV-05 Task View › a modal dialog; windows as buttons incl. minimized; the disabled New desk… · green 2026-09-22 (preview build) |  |

### `surfaces/taskbar.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-TASK-01` | Centered taskbar with Start/Search/Task View + pinned apps as links | P4 | verified | `e2e/windows.spec.ts` › WIN-TASK-01 · WIN-DESK-01 · WIN-TASK-07 the home: centred taskbar and desktop shortcuts as real links @smoke · chromium-desktop, iphone, pixel, reduced-motion · `component/windows/shell.test.tsx` › WIN-TASK-01 · WIN-TASK-08 the taskbar › real links, one tab stop, Left/Right, state suffixes, the active ap… · green 2026-09-22 (preview build) | Deviations log 2026-09-22 |
| `WIN-TASK-02` | Pill indicators (none / 6 px / 16 px accent / attention) animated by `scaleX` | P4 | verified | `e2e/windows.spec.ts` › WIN-WM-02 · WIN-TASK-02 N2 pills: active 16 px accent, running 6 px; focus and z-order follow presses · chromium-desktop, reduced-motion · `unit/windows/model.test.ts` › WIN-TASK-02 pills and names › none · running (grey, also minimized) · active (accent) with the spoken suffixes · green 2026-09-22 (preview build) |  |
| `WIN-TASK-03` | Hover thumbnail flyout + peek | P4 | verified | `e2e/windows.spec.ts` › WIN-TASK-03 N2 hover 400 ms shows the thumbnail card; hovering it dims the other windows · chromium-desktop · green 2026-09-22 (preview build) |  |
| `WIN-TASK-04` | Jump lists (right-click / long-press) | P4 | verified | `e2e/windows.spec.ts` › WIN-TASK-04 the GitHub jump list opens a featured project (right-click, Shift+F10) · chromium-desktop, reduced-motion · `unit/windows/model.test.ts` › WIN-TASK-04 jump lists come from data › GitHub lists the featured projects; Explorer lists Experience and E… · green 2026-09-22 (preview build) |  |
| `WIN-TASK-05` | System tray → Quick Settings and Notification Center | P4 | verified | `e2e/windows.spec.ts` › WIN-TASK-05 · WIN-NOTIF-04 the tray: Quick Settings tiles toggle and persist; the clock opens the Center · chromium-desktop, reduced-motion · `component/windows/shell.test.tsx` › WIN-TASK-01 · WIN-TASK-08 the taskbar › WIN-TASK-05 the tray: Quick Settings and the Notification Center (w… · green 2026-09-22 (preview build) |  |
| `WIN-TASK-06` | Show desktop sliver | P4 | verified | `e2e/windows.spec.ts` › WIN-TASK-06 Show desktop minimizes every window, a second press restores them; an open in between resets it · chromium-desktop, reduced-motion · green 2026-09-22 (preview build) |  |
| `WIN-TASK-07` | Pinned Résumé.pdf item | P4 | verified | `e2e/windows.spec.ts` › WIN-TASK-01 · WIN-DESK-01 · WIN-TASK-07 the home: centred taskbar and desktop shortcuts as real links @smoke · chromium-desktop, iphone, pixel, reduced-motion · green 2026-09-22 (preview build) |  |
| `WIN-TASK-08` | Roving keyboard model + state suffixes | P4 | verified | `component/windows/shell.test.tsx` › WIN-TASK-01 · WIN-TASK-08 the taskbar › real links, one tab stop, Left/Right, state suffixes, the active ap… · green 2026-09-22 (preview build) |  |
| `WIN-TASK-09` | Compact + landscape variants | P4 | built |  |  |

### `apps/edge.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-EDGE-01` | Browser chrome with tabs in the title bar, address bar, sidebar strip | P4 | verified | `e2e/windows-edge-github.spec.ts` › WIN-EDGE-01 N2 window renders; strip opens apps · chromium-desktop, reduced-motion · `component/windows/edge.test.tsx` › WIN-EDGE-01 browser chrome: tabs in the title bar, address field, sidebar strip › puts the tabs in the titl… · green 2026-09-22 (preview build) | Deviations log 2026-09-22 |
| `WIN-EDGE-02` | Overview tab reuses the shared Overview component | P4 | verified | `component/windows/edge.test.tsx` › WIN-EDGE-02 the Overview tab is the shared Overview component › imports AboutOverview from the shared conte… · green 2026-09-22 (preview build) |  |
| `WIN-EDGE-03` | Routed tabs: about ↔ résumé | P4 | verified | `e2e/windows-edge-github.spec.ts` › WIN-EDGE-03 D1 /windows/edge/resume opens the PDF tab; Back returns to About · chromium-desktop, iphone, pixel, reduced-motion · `unit/kernel/windows-wm.test.ts` › Edge’s home route: /windows/edge is the About tab (WIN-EDGE-03) › root ↔ /windows/edge, résumé ↔ /windows/e… · green 2026-09-22 (preview build) |  |
| `WIN-EDGE-04` | PDF toolbar: page, zoom, Save (download + toast), Print; text version first | P4 | verified | `e2e/windows-edge-github.spec.ts` › WIN-EDGE-04 RES-DL-01 on Windows: Save downloads the named file; X1 axe clean · chromium-desktop, iphone, pixel, reduced-motion · `component/windows/edge.test.tsx` › WIN-EDGE-04 the PDF viewer: page, zoom, Save, Print; text version first › Save is a real download named dow… · green 2026-09-22 (preview build) | Deviations log 2026-09-22 |
| `WIN-EDGE-05` | Lenis/ScrollTrigger gating + cleanup | P4 | verified | `e2e/windows-edge-github.spec.ts` › WIN-EDGE-05 perf: no lenis / ScrollTrigger requests under reduced motion · chromium-desktop, reduced-motion · `component/windows/edge.test.tsx` › WIN-EDGE-05 Lenis / ScrollTrigger gating and cleanup › declined gate (reduced motion, touch, tier 0): nothi… · green 2026-09-22 (preview build) |  |
| `WIN-EDGE-06` | Compact layout | P4 | verified | `e2e/windows-edge-github.spec.ts` › WIN-EDGE-06 N3 compact Edge: tabs row under a compact title, PDF toolbar Save · ⋯, no strip · iphone, pixel · `component/windows/edge.test.tsx` › WIN-EDGE-06 compact layout › tabs become a row under a compact title, the PDF toolbar is Save · ⋯ and there… · green 2026-09-22 (preview build) |  |

### `apps/file-explorer.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-EXP-01` | Window: tabbed Mica title bar, breadcrumb, command bar, nav pane, details list | P4 | verified | `e2e/windows-explorer.spec.ts` › WIN-EXP-01 N2 Experience lists roles from data: tab, breadcrumb, command bar, nav pane, Details list · chromium-desktop, reduced-motion · `component/windows/explorer.test.tsx` › WIN-EXP-01 tabbed Mica title bar, breadcrumb, command bar, nav pane, Details list › lists one {Company}.doc… · green 2026-09-22 (preview build) | Deviations log 2026-09-22 |
| `WIN-EXP-02` | Select → details pane + URL; open → document view in tab | P4 | verified | `e2e/windows-explorer.spec.ts` › WIN-EXP-02 D1 /windows/explorer/experience/{slug} opens only File Explorer, on that role in the same tab · chromium-desktop, iphone, pixel, reduced-motion · `component/windows/explorer.test.tsx` › WIN-EXP-02 select → details pane + URL; open → document view in the tab › a click selects: the URL follows … · green 2026-09-22 (preview build) |  |
| `WIN-EXP-03` | Back/Forward/Up + breadcrumb crumbs and sibling menus | P4 | verified | `e2e/windows-explorer.spec.ts` › WIN-EXP-03 H1 in-app back = browser Back: Explorer Back/Forward and the browser walk one history · chromium-desktop, reduced-motion · `component/windows/explorer.test.tsx` › WIN-EXP-03 Back / Forward / Up, crumbs and sibling menus › Back and Forward walk the nav stack; Up goes to … · green 2026-09-22 (preview build) | Deviations log 2026-09-22 |
| `WIN-EXP-04` | Editable address bar with path parsing + error message | P4 | verified | `e2e/windows-explorer.spec.ts` › WIN-EXP-04 · E19 the address bar takes a typed path: invalid-path message, then normalized navigation · chromium-desktop, iphone, pixel, reduced-motion · `unit/windows/explorer-path.test.ts` › WIN-EXP-04 formatExplorerPath › names Home as Windows 11 does and puts folders and files under the profile … · green 2026-09-22 (preview build) |  |
| `WIN-EXP-05` | Sortable table + Tiles/Large icons views | P4 | verified | `component/windows/explorer.test.tsx` › WIN-EXP-05 sortable details table + Tiles / Large icons › header buttons sort and move aria-sort; the order… · green 2026-09-22 (preview build) |  |
| `WIN-EXP-06` | Home page (Quick access + Recent from data) | P4 | verified | `component/windows/explorer.test.tsx` › WIN-EXP-06 Home: Quick access + Recent derive from data › Quick access = Experience, Education, Projects, R… · green 2026-09-22 (preview build) | Deviations log 2026-09-22 |
| `WIN-EXP-07` | Shortcuts open the right apps | P4 | verified | `e2e/windows-explorer.spec.ts` › WIN-EXP-07 Résumé.pdf opens Edge's PDF tab; Projects opens GitHub · chromium-desktop, iphone, pixel, reduced-motion · `component/windows/explorer.test.tsx` › WIN-EXP-07 shortcuts open the right apps › Résumé opens Edge on the PDF tab; Projects opens GitHub · green 2026-09-22 (preview build) |  |
| `WIN-EXP-08` | Compact drill-down layout | P4 | verified | `e2e/windows-explorer.spec.ts` › WIN-EXP-08 N3 compact drill-down: places first, a folder with a back arrow in the title row, a file as its … · iphone, pixel · `component/windows/explorer.test.tsx` › WIN-EXP-08 compact drill-down › places first; a folder drills down with a back arrow in the title row; a fi… · green 2026-09-22 (preview build) |  |

### `apps/github.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-GH-01` | App shell with NavigationView rail, title-bar search, Overview cards | P4 | verified | `e2e/windows-edge-github.spec.ts` › WIN-GH-01 N2 projects match data · chromium-desktop, reduced-motion · `component/windows/github.test.tsx` › WIN-GH-01 NavigationView rail, title-bar search, Overview cards › lists Overview · Repositories · the featu… · green 2026-09-22 (preview build) | Deviations log 2026-09-22 |
| `WIN-GH-02` | Project page with breadcrumb, pivots, info card | P4 | verified | `e2e/windows-edge-github.spec.ts` › WIN-GH-02 D1 /windows/github/{slug} · chromium-desktop, iphone, pixel, reduced-motion · `component/windows/github.test.tsx` › WIN-GH-02 project page: breadcrumb, pivots, info card › opens a real project, shows its breadcrumb, pivots … · green 2026-09-22 (preview build) |  |
| `WIN-GH-03` | Enrichment + heatmap card with accessible alternative | P4 | verified | `component/windows/github.test.tsx` › WIN-GH-03 enrichment and the contribution heatmap › without GitHub data there are no stats, no Stars count … · green 2026-09-22 (preview build) | Deviations log 2026-09-22 |
| `WIN-GH-04` | Filters, sort, rail expand/collapse | P4 | verified | `component/windows/github.test.tsx` › WIN-GH-04 filters, sort and rail expand / collapse (session state) › chips filter, the empty state clears, … · green 2026-09-22 (preview build) |  |
| `WIN-GH-05` | Drill-in/out page motion, reversible | P4 | verified | `e2e/windows-edge-github.spec.ts` › WIN-GH-05 back mid-transition lands cleanly · chromium-desktop, reduced-motion · `component/windows/github.test.tsx` › WIN-GH-05 drill-in / drill-out page motion › going back leaves an inert, id-free copy of the page to drill … · green 2026-09-22 (preview build) |  |
| `WIN-GH-06` | Compact layout | P4 | verified | `e2e/windows-edge-github.spec.ts` › WIN-GH-06 N3 compact GitHub: hamburger overlay rail, one column, scrolling pivots · iphone, pixel · `component/windows/github.test.tsx` › WIN-GH-06 compact layout › the rail is a hamburger overlay (Esc closes it and focus returns), pages are one… · green 2026-09-22 (preview build) |  |
| `WIN-GH-07` | Case study pivot (expanders + metric cards) + docs drill-in for deep dives | P8 | verified | `component/windows/github.test.tsx` › WIN-GH-07 the Case study pivot holds expanders and metric cards; a doc drills in and Back drills out to its row (axe clean) · a project without a case study has no Case study pivot · e2e WIN-GH-02 D1 green (pre-existing WIN-SET-02/03/04 failures unchanged) · green 2026-09-25 (production build) | |

### `apps/outlook.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-OUT-01` | Shell: app rail, simplified ribbon, three panes, Focused/Other pivot | P4 | verified | `unit/content/inbox.test.ts` › WIN-OUT-01 · MAC-MAIL-01 the inbox derives from the fixture › holds exactly the three messages, pinned "Let… · green 2026-09-22 (preview build) | Deviations log 2026-09-22 |
| `WIN-OUT-02` | Compose inside the reading pane with persisted draft + discard confirm | P4 | verified | `e2e/windows-outlook.spec.ts` › WIN-OUT-02 P1 draft survives reload: compose comes back in the reading pane with its subject and message · chromium-desktop, iphone, pixel, reduced-motion · `component/windows/outlook.test.tsx` › WIN-OUT-02 compose inside the reading pane, persisted draft, discard confirm › New mail swaps the reading p… · green 2026-09-22 (preview build) | Deviations log 2026-09-22 |
| `WIN-OUT-03` | Send = encoded `mailto:` + InfoBar + copy fallback | P4 | verified | `e2e/windows-outlook.spec.ts` › WIN-OUT-03 Send hands an encoded mailto: to the email app (the page never leaves); the InfoBar offers Copy · chromium-desktop, iphone, pixel, reduced-motion · `unit/content/inbox.test.ts` › WIN-OUT-03 · MAC-MAIL-03 Send = an encoded mailto: hand-off › encodes the subject and body (CRLF line break… · green 2026-09-22 (preview build) |  |
| `WIN-OUT-04` | Attachment chip → Edge PDF tab / download | P4 | verified | `e2e/windows-outlook.spec.ts` › WIN-OUT-04 the attachment chip opens /windows/edge/resume — the résumé as a PDF tab in Edge · chromium-desktop, iphone, pixel, reduced-motion · `component/windows/outlook.test.tsx` › WIN-OUT-04 attachment chip → Edge PDF tab / download › the chip is a real link to /windows/edge/resume that… · green 2026-09-22 (preview build) |  |
| `WIN-OUT-05` | Compact push navigation + sticky Send | P4 | verified | `e2e/windows-outlook.spec.ts` › WIN-OUT-05 N3 phones: list → message push with a back arrow; compose full-height, Send sticky at the bottom · iphone, pixel · `component/windows/outlook.test.tsx` › WIN-OUT-05 compact: push navigation, sticky Send, ribbon folded into ⋯ › list → message push with a back ar… · green 2026-09-22 (preview build) | Deviations log 2026-09-22 |
| `WIN-OUT-06` | Form semantics, status InfoBar, modal confirm | P4 | verified | `e2e/windows-outlook.spec.ts` › WIN-OUT-06 X1 axe clean: the reading pane, compose and the discard dialog · chromium-desktop, iphone, pixel, reduced-motion · `component/windows/outlook.test.tsx` › WIN-OUT-06 form semantics, status InfoBar, modal confirm, axe clean › reading, compose and the discard dial… · green 2026-09-22 (preview build) |  |

### `apps/settings.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-SET-01` | Settings window: NavigationView, breadcrumb headers, cards + expanders, search | P4 | verified | `e2e/windows-settings.spec.ts` › WIN-SET-01 N2 pages render; search flashes a card · chromium-desktop, iphone, pixel, reduced-motion · `component/windows/settings.test.tsx` › WIN-SET-01 NavigationView, breadcrumb headers, cards + expanders, search › lists every page; each page rend… · green 2026-09-22 (preview build) | Deviations log 2026-09-22 |
| `WIN-SET-02` | Accessibility page controls apply instantly + persist | P4 | verified | `e2e/windows-settings.spec.ts` › WIN-SET-02 A11Y-PREF-01 on Windows: Accessibility controls apply to <html> at once and persist across reload · chromium-desktop, iphone, pixel, reduced-motion · `unit/kernel/windows-platform.test.ts` › WIN-SET-02 · WIN-SET-03 preferences added for Windows Settings › defaults: centre taskbar, no accent overri… · green 2026-09-22 (preview build) |  |
| `WIN-SET-03` | Personalization incl. **taskbar alignment Center/Left** | P4 | verified | `e2e/windows-settings.spec.ts` › WIN-SET-03 the alignment toggle moves the taskbar group; persists · chromium-desktop, iphone, pixel, reduced-motion · `unit/kernel/windows-platform.test.ts` › WIN-SET-02 · WIN-SET-03 preferences added for Windows Settings › defaults: centre taskbar, no accent overri… · green 2026-09-22 (preview build) | Deviations log 2026-09-22 |
| `WIN-SET-04` | Privacy + Legal notices surfaces | P4 | verified | `e2e/windows-settings.spec.ts` › WIN-SET-04 Privacy and Legal notices: reachable; content from the manifest · chromium-desktop, iphone, pixel, reduced-motion · `component/windows/settings.test.tsx` › WIN-SET-04 Privacy + Legal notices surfaces › Privacy shows what is counted, DNT/GPC status and no cookies;… · green 2026-09-22 (preview build) |  |
| `WIN-SET-05` | Switch operating system page + Back to chooser | P4 | verified | `e2e/windows-settings.spec.ts` › WIN-SET-05 switch parks the session: to macOS and back, then Back to chooser and in again — the windows stay · chromium-desktop, iphone, pixel, reduced-motion, asset-original (3 full runs + an 8-worker repeat, iphone green each time) · `component/windows/settings.test.tsx` › WIN-SET-05 Switch operating system page + Back to chooser › each OS card switches (SWITCH_OS via switch); B… · green 2026-09-22 (preview build) |  |
| `WIN-SET-06` | winver dialog egg | P4 | verified | `e2e/windows-settings.spec.ts` › WIN-SET-06 EGG-WINVER-01 winver: data-driven About dialog; the found counter increments once · chromium-desktop, iphone, pixel, reduced-motion, asset-original · `component/windows/settings.test.tsx` › WIN-SET-06 winver dialog (EGG-WINVER-01) › shows the data-driven version, focuses OK, closes on Esc, record… · › closed while Search is still fading out, focus skips the leaving panel for the focused window — never <body> · › a press outside that lands on a control keeps focus there (input wins) · green 2026-09-22 (preview build) | Deviations log 2026-09-22 |
| `WIN-SET-07` | Semantics: switches, sliders, expanders, breadcrumb | P4 | verified | `e2e/windows-settings.spec.ts` › WIN-SET-07 X1 axe clean (WCAG 2.2 AA): every Settings page, open expanders and the winver dialog · chromium-desktop, iphone, pixel, reduced-motion, asset-original; iphone 16/16 at 8 workers · `unit/design/tokens.test.ts` › WIN-SET-07 on-accent text ≥ 4.5:1 on every Windows accent fill, at rest and on hover, light and dark · `component/windows/settings.test.tsx` › WIN-SET-07 semantics: switches, sliders, radio groups, expanders, breadcrumb; axe clean › every page is axe… · green 2026-09-22 (preview build) |  |

### `apps/vscode.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-CODE-01` | Windows chrome: custom Mica title bar, in-window menubar, command centre, right caption buttons | P4 | verified | `e2e/windows-vscode.spec.ts` › WIN-CODE-01 N2 menubar inside the window; caption buttons right — also snapped, where the menus collapse in… · chromium-desktop, reduced-motion · `component/windows/vscode.test.tsx` › WIN-CODE-01 Windows chrome: Mica title bar, in-window menu bar, command centre, right caption buttons › the… · green 2026-09-22 (preview build) | Deviations log 2026-09-22 |
| `WIN-CODE-02` | Shared editor body + shared generated files (no fork) | P4 | verified | `unit/content/workspace.test.ts` › MAC-CODE-02 / WIN-CODE-02 generated files › lists every planned file, with its language · green 2026-09-22 (preview build) | Deviations log 2026-09-22 |
| `WIN-CODE-03` | Command centre opens Windows Search scoped to files | P4 | verified | `e2e/windows-vscode.spec.ts` › WIN-CODE-03 S1 from VS Code on Windows: the command centre opens Search scoped to files; a result opens wit… · chromium-desktop, reduced-motion · `component/windows/vscode.test.tsx` › WIN-CODE-03 the command centre opens Windows Search scoped to files › command centre click, Ctrl+K inside t… · green 2026-09-22 (preview build) | Deviations log 2026-09-22 |
| `WIN-CODE-04` | Backslash paths + PowerShell-style terminal panel | P4 | verified | `component/windows/vscode.test.tsx` › WIN-CODE-04 backslash paths and the PowerShell terminal panel › breadcrumbs and tab tooltips use C:\Users\{… · green 2026-09-22 (preview build) |  |
| `WIN-CODE-05` | Menubar semantics without binding Alt/F10 | P4 | verified | `component/windows/vscode.test.tsx` › WIN-CODE-05 in-window Menubar: APG keys, Windows skin, Alt and F10 unbound › one Tab stop; Right/Left move … · green 2026-09-22 (preview build) |  |
| `WIN-CODE-06` | Compact layout with ☰ menu | P4 | verified | `e2e/windows-vscode.spec.ts` › WIN-CODE-06 N3 compact: ☰ menu, bottom activity bar, Explorer first, files push in; Back leaves · iphone, pixel · `component/windows/vscode.test.tsx` › WIN-CODE-06 compact: ☰ menu, bottom activity bar, drill-down Explorer, files push in › the menus collapse i… · green 2026-09-22 (preview build) |  |

### `apps/windows-terminal.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-TERM-01` | Terminal skin: tab strip in title bar, profile dropdown, Acrylic body | P4 | verified | `e2e/windows-terminal.spec.ts` › WIN-TERM-01 N2 tabs + dropdown; blur count within cap · chromium-desktop, iphone, pixel, reduced-motion · `component/windows/terminal.test.tsx` › WIN-TERM-01 Terminal skin: tab strip in the title bar, profile dropdown, Acrylic body › N2 tabs + dropdown:… · green 2026-09-22 (preview build) | Deviations log 2026-09-22 |
| `WIN-TERM-02` | PowerShell/CMD prompts + backslash display adapter over the shared VFS | P4 | verified | `unit/terminal/powershell.test.ts` › WIN-TERM-02 PowerShell/CMD prompts + the backslash display adapter over the shared VFS › writes paths exact… · green 2026-09-22 (preview build) | Deviations log 2026-09-22 |
| `WIN-TERM-03` | Windows aliases (`dir`, `type`, `cls`, `start`, `ii`, `Get-Help`) | P4 | verified | `unit/terminal/powershell.test.ts` › WIN-TERM-03 Windows aliases (dir, type, cls, start, ii, Get-Help) resolve to engine commands › alias table … · green 2026-09-22 (preview build) | Deviations log 2026-09-22 |
| `WIN-TERM-04` | PowerShell-voiced errors with suggestions | P4 | verified | `unit/terminal/powershell.test.ts` › WIN-TERM-04 PowerShell-voiced errors with suggestions › error formatter snapshot: not-recognized + "Did you… · green 2026-09-22 (preview build) |  |
| `WIN-TERM-05` | `start`/`open` dispatches the owning Windows app | P4 | verified | `e2e/windows-terminal.spec.ts` › WIN-TERM-05 start resume → Edge PDF tab · chromium-desktop, iphone, pixel, reduced-motion · `component/windows/terminal.test.tsx` › WIN-TERM-05 start/open dispatches the owning Windows app › the effect mapper: open resume → the Edge résumé… · green 2026-09-22 (preview build) |  |
| `WIN-TERM-06` | Shared engine reuse + a11y contract parity | P4 | verified | `component/windows/terminal.test.tsx` › WIN-TERM-06 shared engine reuse + a11y contract parity › static: Terminal.tsx takes terminal behaviour only… · green 2026-09-22 (preview build) |  |
| `WIN-TERM-07` | "Ubuntu" profile offers the Linux OS | P4 | verified | `e2e/windows-terminal.spec.ts` › WIN-TERM-07 choosing it asks to switch; never switches silently · chromium-desktop, iphone, pixel, reduced-motion · `component/windows/terminal.test.tsx` › WIN-TERM-07 "Ubuntu" profile offers the Linux OS › choosing it asks to switch; Cancel / Esc never switch; S… · green 2026-09-22 (preview build) |  |

### `03-motion.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-MOTION-01` | Duration ladder + curves as tokens; table implemented from tokens | P4 | verified | `unit/windows/model.test.ts` › WIN-MOTION-01 the Windows motion tokens match plans/windows/03 › ladder 83/167/250/333/500 ms and the three… · green 2026-09-22 (preview build) |  |
| `WIN-MOTION-02` | Reversible/interruptible transitions incl. Snap cancel | P4 | built | partial: `component/windows/window-strict.test.tsx` › WIN-WM-01 · WIN-MOTION-02 the open animation survives Strict Mode (development) › opens to phase normal at … · green 2026-09-22 (preview build) |  |
| `WIN-MOTION-03` | Compositor-only properties | P4 | built |  |  |
| `WIN-MOTION-04` | Reduced-motion variants | P4 | verified | `e2e/windows.spec.ts` › WIN-MOTION-04 · MOTION-RM-01 R1 reduced motion: nothing longer than 200 ms runs; end states match · reduced-motion · green 2026-09-22 (preview build) |  |

### `04-responsive.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-RESP-01` | Full-fidelity posture | P4 | built |  |  |
| `WIN-RESP-02` | Tablet posture (spacing, no hover previews, system-menu Snap, resize grip) | P4 | built |  |  |
| `WIN-RESP-03` | Compact window mode (min+close, Start sheet, Task View list) | P4 | verified | `e2e/windows.spec.ts` › WIN-WM-12 · WIN-START-07 · WIN-RESP-03 · WIN-RESP-04 N3 compact: one maximized window, min + close at 48 × … · iphone, pixel · green 2026-09-22 (preview build) |  |
| `WIN-RESP-04` | Back closes transient sheets first, then navigates | P4 | verified | `e2e/windows.spec.ts` › WIN-WM-12 · WIN-START-07 · WIN-RESP-03 · WIN-RESP-04 N3 compact: one maximized window, min + close at 48 × … · iphone, pixel · `unit/kernel/windows-platform.test.ts` › WIN-RESP-04 transient sheet entries: Back closes the sheet first › Back from the sheet entry calls onBack a… · green 2026-09-22 (preview build) |  |
| `WIN-RESP-05` | Safe areas + dvh; keyboard-aware sheets | P4 | built |  |  |
| `WIN-RESP-06` | Size-class transitions keep snaps/floats | P4 | verified | `e2e/windows.spec.ts` › WIN-RESP-06 · WIN-WM-06 O1 a viewport resize re-derives snapped windows and re-clamps floats · chromium-desktop, reduced-motion · green 2026-09-22 (preview build) |  |
| `WIN-RESP-07` | 400 % zoom engages compact mode | P4 | verified | `e2e/windows.spec.ts` › WIN-RESP-07 · RESP-ZOOM-01 400 % zoom engages compact mode · chromium-desktop, reduced-motion · green 2026-09-22 (preview build) |  |

### `05-accessibility.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-A11Y-01` | Landmark structure + DOM order | P4 | verified | `e2e/windows.spec.ts` › WIN-A11Y-01 · A11Y-SEM-01 X2 landmarks in reading order: main, then the taskbar nav, then the status regions · chromium-desktop, reduced-motion · `component/windows/shell.test.tsx` › WIN-A11Y-01 landmarks in reading order › main (h1, desktop, windows in open order) → the taskbar nav last →… · green 2026-09-22 (preview build) |  |
| `WIN-A11Y-02` | Windows semantics map rows | P4 | verified | `e2e/windows.spec.ts` › WIN-A11Y-02 · A11Y-AXE-01 X1 axe clean: home, File Explorer, Start, Search and Task View open · chromium-desktop, reduced-motion · `component/windows/explorer.test.tsx` › WIN-A11Y-02 Explorer semantics: axe clean in the folder view › heading order, lists, table headers, ARIA at… · green 2026-09-22 (preview build) |  |
| `WIN-A11Y-03` | Keyboard-only journey incl. Snap by keyboard | P4 | built | partial: `unit/kernel/windows-platform.test.ts` › WIN-WM-11 · WIN-A11Y-03 Alt+Shift+Arrow snap chords › match the four snap shortcuts, outside text fields on… · green 2026-09-22 (preview build) |  |
| `WIN-A11Y-04` | Focus specifics | P4 | built |  | Deviations log 2026-09-22 |
| `WIN-A11Y-05` | Contrast themes / forced-colors rendering | P4 | built |  |  |
| `WIN-A11Y-06` | Screen-reader script recorded for release | P8 | planned |  |  |

### `06-edge-cases.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-CASE-01` | E1–E7 (taskbar spam, Snap, resize, compact boundary) | P4 | built |  |  |
| `WIN-CASE-02` | E8–E11 (Start/preview/Show-desktop lifecycles) | P4 | built |  |  |
| `WIN-CASE-03` | E12–E16 (refresh, deep link, Back, switch/return) | P4 | verified | `e2e/windows.spec.ts` › WIN-CASE-03 · KRN-SES-01 P1 reload restores windows, snaps and the focused app; storage corrupt never break… · chromium-desktop, reduced-motion, asset-original; 30/30 repeated · green 2026-09-22 (preview build) |  |
| `WIN-CASE-04` | E17–E22 (failure, storage, parser, arbiter, re-anchor) | P4 | built |  | Deviations log 2026-09-22 |

### `07-cross-os-features.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-X-01` | Résumé fast path in all listed places | P4 | verified | `e2e/windows.spec.ts` › RES-COMPACT-01 · WIN-X-01 Q1 the résumé is one click from the taskbar, the desktop, Start and Search · chromium-desktop, iphone, pixel, reduced-motion · green 2026-09-22 (preview build) |  |
| `WIN-X-02` | Continuity toast (and lock-card variant) | P4 | verified | `e2e/windows.spec.ts` › CONT-ACCEPT-01 · CONT-NEVER-01 · WIN-X-02 · WIN-NOTIF-02 C1 continuity from macOS: a toast offers, never op… · chromium-desktop, reduced-motion · green 2026-09-22 (preview build) |  |
| `WIN-X-03` | Tour offer + Windows script (incl. honest Snap demo) + restart points | P4 | built |  |  |
| `WIN-X-04` | Eggs wired + found counter | P4 | verified | `e2e/windows.spec.ts` › WIN-X-04 · EGG-KONAMI-01 the Konami code shimmers the taskbar and counts once · chromium-desktop, reduced-motion · green 2026-09-22 (preview build) |  |
| `WIN-X-05` | Switch OS entry points + exit beat | P4 | verified | `e2e/windows.spec.ts` › WIN-X-05 Switch OS from Settings-free paths: Alt+Shift+S and the desktop menu lead to the chooser · chromium-desktop, reduced-motion · green 2026-09-22 (preview build) |  |

**Total feature IDs: 146**

## Definition-of-done audit (run before flipping this OS to `released` — requirement R49)

**Visual language**
- [ ] Tokens only (no magic numbers); system font stack; icons resolve in both asset modes with identical boxes.
- [ ] Focus ring ≥ 3:1; glyphs never rely on colour alone; forced-colors legible.
- [ ] Grayscale smell test against every already-released OS passes.
- [ ] Storyboard test (north-star smell test 8): the reference state side by side with `windows-desktop.png` in `plans/visual-targets/` — only real data and real-OS details differ (`01-identity.md` → Visual target).

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

**Journeys green:** N1 · N2 · N3 · N-keyboard · H1 · D1 · P1 · R1 · O1 · S1 · T1 · C1 · Q1 · X1–X5 on Windows

**Plan conformance**
- [ ] Every row above is `verified` with evidence, or `BLOCKED` with owner sign-off.
- [ ] Every "Not like the others" clause in this folder is demonstrably true.
- [ ] Deviations below are complete and signed.

## Deviations log
| Date | ID | What changed vs the spec | Why | Owner sign-off |
|---|---|---|---|---|
| 2026-09-22 | `WIN-WM-01` | File Explorer opens at the storyboard frame's place (x 2 %, y 3 %, 48 % × 83 % of the page); every other app opens centred at its spec size with the 32 px cascade | The frame (`plans/visual-targets/windows-desktop.png`) is the reference state; the owner asked for the storyboard composition | Owner authorization 2026-09-21 (plans/README); for review at the P4 gate |
| 2026-09-22 | `WIN-TASK-01` | Settings is pinned on the taskbar (File Explorer · Edge · GitHub · Outlook · VS Code · Terminal · Settings · Résumé), the frame's order | The storyboard frame shows Settings pinned | Owner authorization 2026-09-21 (plans/README); for review at the P4 gate |
| 2026-09-22 | `WIN-ID-02` | Mica is a static, counter-positioned copy of the CSS-gradient wallpaper under a tint layer, with no pre-blurred image asset | The wallpaper is a smooth gradient, so a blurred copy looks the same as the unblurred one: no image to ship, no live filter, same look | Owner authorization 2026-09-21 (plans/README); for review at the P4 gate |
| 2026-09-22 | `WIN-BOOT-04` | A slow or failed Windows chunk shows the chooser's shared boot frame and its calm Retry card (plus the plain-portfolio link); there is no separate Windows failure screen | One recovery path for every OS (P1 `ChooserSlot` / `OSHost` retry); no fake crash screen, as the spec asks | Owner authorization 2026-09-21 (plans/README); for review at the P4 gate |
| 2026-09-22 | `WIN-EXP-01` | Role files are named `{Company}.docx` (the frame), not `{Company} - {Role}.docx`; Windows-illegal characters and a trailing dot are removed; the address bar accepts both forms. Rows are 36 px (the identity token), 40 px on touch. Education columns are Name · Degree · Dates. Default sort: Dates, newest first | Storyboard frame; the data has no education location; the frame's order | Owner authorization 2026-09-21 (plans/README); for review at the P4 gate |
| 2026-09-22 | `WIN-EXP-01` | The title bar keeps the window-menu icon left of the tab, which the frame omits | The browser owns Alt+Space, so this button is the only keyboard route to Move / Size / Snap (`WIN-WM-11`) | Owner authorization 2026-09-21 (plans/README); for review at the P4 gate |
| 2026-09-22 | `WIN-EXP-06` | Home tiles open on one click; Details rows keep click-to-select, double-click-to-open | Reachability: every section ≤ 2 actions from the OS home | Owner authorization 2026-09-21 (plans/README); for review at the P4 gate |
| 2026-09-22 | `WIN-EXP-03` | A folder change uses the drill-in (8 px rise, 250 ms) instead of the "83 ms out / 167 ms in" split | The split is not in the Windows motion tokens (`WIN-MOTION-01`); one reversible drill keeps input first | Owner authorization 2026-09-21 (plans/README); for review at the P4 gate |
| 2026-09-22 | `WIN-EDGE-01` | The address bar shows the section's real link (`{site}/go/about`, the URL Copy link copies) and `file:///C:/Users/{given name}/Résumé.pdf`, not the literal `https://jaswanth.dev/about`. "Open plain version" opens the preset in-Edge tab, which links to `/plain` | One fact, one place: the name comes from the selectors and the domain from `NEXT_PUBLIC_SITE_URL`; what the bar shows is what Copy link copies | Owner authorization 2026-09-21 (plans/README); for review at the P4 gate |
| 2026-09-22 | `WIN-EDGE-04` | With the PDF present, the text version comes first in the DOM, visually hidden until keyboard focus enters it | The macOS Preview rule: text first for assistive tech, and focus is never invisible | Owner authorization 2026-09-21 (plans/README); for review at the P4 gate |
| 2026-09-22 | `WIN-GH-01` | Skeleton cards appear only while the GitHub app chunk loads (AppBody); there is no runtime data loading | GitHub data is a build-time snapshot; a fake loading state would delay information | Owner authorization 2026-09-21 (plans/README); for review at the P4 gate |
| 2026-09-22 | `WIN-GH-03` | The contribution heatmap uses the Windows accent ramp, not GitHub greens | Keeps it visibly different from the macOS GitHub app (distinctness contract) | Owner authorization 2026-09-21 (plans/README); for review at the P4 gate |
| 2026-09-22 | `WIN-OUT-01` | All three messages are dated `resume.updated` and start unread (Inbox (3)); nothing is selected at launch ("Select an item to read", as the new Outlook does); one draft at a time; Reply by email opens the in-app compose | The data publishes no other date; no date is invented | Owner authorization 2026-09-21 (plans/README); for review at the P4 gate |
| 2026-09-22 | `WIN-OUT-02` | A draft left in a closed Outlook window comes back when Outlook reopens in the same page session. A reload after closing the window does not bring it back (a reload while the window is open does) | The kernel drops a closed window with its draft; macOS Mail follows the same rule; the spec asks for "closing → kept; reopening restores" | Owner authorization 2026-09-21 (plans/README); for review at the P4 gate |
| 2026-09-22 | `WIN-OUT-05` | Outlook also adapts to its own window width: under 900 px the folder pane shows icons only; under 720 px it uses the compact list → message push | A snapped or narrow window must stay usable (beyond the spec, which describes viewport postures only) | Owner authorization 2026-09-21 (plans/README); for review at the P4 gate |
| 2026-09-22 | `WIN-SET-01` | About is a sub-page reached from a "›" card on System (System › About); Sound is an expander on System, not a sub-page. The navigation pane also collapses behind ☰ in any window narrower than 760 px | Follows plans/windows/07 ("Settings → System → About"); keeps snapped Settings usable | Owner authorization 2026-09-21 (plans/README); for review at the P4 gate |
| 2026-09-22 | `WIN-SET-03` | Theme, accent and taskbar alignment are native radio groups and Contrast themes is a toggle (real Windows uses dropdowns); text size applies at once with no Apply button; the sliders commit with `dispatch`, toggles with `dispatchSoon` | Native controls give the best semantics (`WIN-SET-07`); input always wins | Owner authorization 2026-09-21 (plans/README); for review at the P4 gate |
| 2026-09-22 | `WIN-SET-06` | The About Windows dialog adds a one-line "not affiliated with Microsoft" note and a ✕ caption button | Third-party marks never imply endorsement (shared/11); ✕ is the pointer alternative to Esc / OK | Owner authorization 2026-09-21 (plans/README); for review at the P4 gate |
| 2026-09-22 | `WIN-TERM-02` | Prompts use the engine's lowercase user (`C:\Users\jaswanth>`); the Command Prompt tab changes prompt and colours but keeps PowerShell-voiced errors; the error voice is PowerShell 7's, not Windows PowerShell 5.1's | One shared engine (`WIN-TERM-06`): the VFS user and the voices are shared; the engine has no cmd voice | Owner authorization 2026-09-21 (plans/README); for review at the P4 gate |
| 2026-09-22 | `WIN-TERM-01` | The banner text is original (no Microsoft copyright line); the cursor is a bar; the bright Campbell colours are used; the PowerShell and CMD tabs use the Fluent console glyph and the Ubuntu menu item has no icon | No official PowerShell / CMD / Ubuntu artwork in the asset manifest, and a stand-in icon is never shown; bright Campbell keeps 4.5 : 1 over the tint | Owner authorization 2026-09-21 (plans/README); for review at the P4 gate |
| 2026-09-22 | `WIN-TERM-03` | `sudo hire-me` prints "sudo: not on Windows — but the answer is still yes." before the `EGG-SUDO-01` block; any other `sudo` keeps the engine's own answer | "The answer is still yes" only fits the egg; elsewhere the engine answers "permission denied — and none needed" | Owner authorization 2026-09-21 (plans/README); for review at the P4 gate |
| 2026-09-22 | `WIN-CODE-02` | VS Code opens on `skills.json` with the README preview next to it; README renders as a Markdown preview, other `.md` files as source; tabs are session state only (not restored after a reload); skill-group folding and "How I work" bullets are not built | The kernel gives an app that owns one section that section as its route; the data has no "how I work" field and about 60 lines of skills | Owner authorization 2026-09-21 (plans/README); for review at the P4 gate |
| 2026-09-22 | `WIN-CODE-03` | Search inside the editor uses the shared matcher over file lines, not the shared content index | The index holds titles only and cannot point at a line | Owner authorization 2026-09-21 (plans/README); for review at the P4 gate |
| 2026-09-22 | `WIN-CODE-01` | In-window menus use the solid Windows menu tint (no live blur); line numbers, inactive tab text and dim text are darkened where Dark Modern / Light Modern fall below 4.5 : 1 | Blur budget (≤ 3) and WCAG AA | Owner authorization 2026-09-21 (plans/README); for review at the P4 gate |
| 2026-09-22 | `WIN-A11Y-04` | A window becomes active on a pointer press or a Windows action (taskbar, Task View, next / previous window), never because Tab moved into it | Activating on Tab would reorder windows and write a history entry on every Tab; macOS follows the same rule | Owner authorization 2026-09-21 (plans/README); for review at the P4 gate |
| 2026-09-22 | `WIN-CASE-04` | The "That item is no longer available" InfoBar in File Explorer shows for cold deep links and in-session opens; a repaired request that leaves the kernel state unchanged shows none | The kernel repairs removed slugs silently (shared/05); a "repaired" event would need a kernel change | Owner authorization 2026-09-21 (plans/README); for review at the P4 gate |
| 2026-09-22 | `WIN-TASK-01` · `WIN-START-02` | Besides hover / focus prefetch, the pinned apps' code loads one app at a time in idle time after the desktop paints (skipped under Data Saver; a failed warm-up stays silent until a window opens) | A first open never waits on the network; also warms the dev server's on-demand compile | Owner, 2026-09-22 ("inside OS navigations are way too slow — it's gotta be super smooth") |
