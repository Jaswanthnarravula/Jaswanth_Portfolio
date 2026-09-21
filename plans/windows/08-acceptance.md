# Windows 11 / 08 — Acceptance ledger

Generated from the feature tables in this folder: every `WIN-*` ID appears **exactly once** here. The feature
description and its named acceptance test live in the spec file; this ledger tracks delivery.

Status: `planned` → `built` → `verified` (or `BLOCKED` + reason + owner sign-off). **Evidence** = passing test
name / CI run / capture. An OS is flipped to `released` only when every row is `verified`.

## Ledger

### `01-identity.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-ID-01` | Windows token scope complete | P4 | planned | | |
| `WIN-ID-02` | Mica as counter-translated pre-blurred image (no live filter on windows) | P4 | planned | | |
| `WIN-ID-03` | Acrylic on transient surfaces within the 3-surface cap; solid fallback | P4 | planned | | |
| `WIN-ID-04` | Caption buttons: sizes, hover fills, red close, inactive state | P4 | planned | | |
| `WIN-ID-05` | 8 px corners, 0 when maximized/snapped; 1 px card stroke | P4 | planned | | |
| `WIN-ID-06` | Light/dark parity | P4 | planned | | |

### `02-window-manager.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-WM-01` | Open from launcher rect, centred cascade, learned rects | P4 | planned | | |
| `WIN-WM-02` | Focus/layering + active Mica + taskbar pill widths | P4 | planned | | |
| `WIN-WM-03` | Drag with clamps; drag-from-maximized proportional restore | P4 | planned | | |
| `WIN-WM-04` | Snap by drag with previews (halves, quarters, top = maximize) | P4 | planned | | |
| `WIN-WM-05` | Snap layouts flyout (hover/focus + system menu) | P4 | planned | | |
| `WIN-WM-06` | Snapped state re-derives on viewport resize; drag-away restores pre-snap rect | P4 | planned | | |
| `WIN-WM-07` | Paired resize of ½+½ snapped windows | P4 | planned | | |
| `WIN-WM-08` | Minimize/restore to the taskbar button; active-click minimizes | P4 | planned | | |
| `WIN-WM-09` | Maximize/restore (radius 0, no shadow), title double-click | P4 | planned | | |
| `WIN-WM-10` | Close ends the app (pill removed) | P4 | planned | | |
| `WIN-WM-11` | System menu with Move / Size / Snap by keyboard; Alt+Shift+Arrow | P4 | planned | | |
| `WIN-WM-12` | Compact mode (min + close only, 48 × 44) | P4 | planned | | |
| `WIN-WM-13` | History rules per window event | P4 | planned | | |

### `surfaces/boot.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-BOOT-01` | Logo + orbiting-dots spinner (CSS transform only) | P4 | planned | | |
| `WIN-BOOT-02` | Appearance rules (first chooser entry only) | P4 | planned | | |
| `WIN-BOOT-03` | Any input skips; ≤ 1.5 s added | P4 | planned | | |
| `WIN-BOOT-04` | Slow/failure states (no fake crash screen) | P4 | planned | | |
| `WIN-BOOT-05` | Reduced motion removes boot | P4 | planned | | |

### `surfaces/context-menus.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-CTX-01` | Menu component with command row, glyph items, clamped positioning | P4 | planned | | |
| `WIN-CTX-02` | Menus per target incl. View/Sort/Refresh and Properties dialog | P4 | planned | | |
| `WIN-CTX-03` | "Show more options" legacy swap | P4 | planned | | |
| `WIN-CTX-04` | Three invocations + native menu preserved on text/Terminal | P4 | planned | | |
| `WIN-CTX-05` | APG menu semantics incl. command-row group | P4 | planned | | |

### `surfaces/desktop.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-DESK-01` | Wallpaper + top-left grid of data-driven shortcuts as links | P4 | planned | | |
| `WIN-DESK-02` | Selection tile, marquee, Ctrl+click multi-select (cosmetic) | P4 | planned | | |
| `WIN-DESK-03` | Select vs open by pointer type; Enter opens | P4 | planned | | |
| `WIN-DESK-04` | Roving keyboard grid in column-first order | P4 | planned | | |
| `WIN-DESK-05` | Compact/touch variants | P4 | planned | | |

### `surfaces/lock-screen.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-LOCK-01` | Lock layout: bottom-left clock, status cards from data | P4 | planned | | |
| `WIN-LOCK-02` | Appearance rules | P4 | planned | | |
| `WIN-LOCK-03` | Two-step continue → sign-in (no credential field), skippable instantly | P4 | planned | | |
| `WIN-LOCK-04` | Status card = shortcut that skips sign-in and opens the app | P4 | planned | | |
| `WIN-LOCK-05` | Identical for every profile | P4 | planned | | |

### `surfaces/notification-center.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-NOTIF-01` | Toast component, queue, dwell ≥ 6 s, pause on hover/focus | P4 | planned | | |
| `WIN-NOTIF-02` | Trigger table incl. continuity toast | P4 | planned | | |
| `WIN-NOTIF-03` | Notification Center + calendar flyout keeps every toast | P4 | planned | | |
| `WIN-NOTIF-04` | Quick Settings tiles wired to prefs (sound, motion, transparency, theme, Switch OS) | P4 | planned | | |
| `WIN-NOTIF-05` | Motion (333/167, 167/83) + reduced-motion fades | P4 | planned | | |
| `WIN-NOTIF-06` | Never steals focus; semantics for tiles, slider, calendar | P4 | planned | | |
| `WIN-NOTIF-07` | Compact combined sheet | P4 | planned | | |

### `surfaces/search.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-SEARCH-01` | Flyout with best match, grouped list, preview pane, chips | P4 | planned | | |
| `WIN-SEARCH-02` | Start ↔ Search in-place morph on typing | P4 | planned | | |
| `WIN-SEARCH-03` | Result opens via kernel from the flyout rect; one history entry | P4 | planned | | |
| `WIN-SEARCH-04` | Command results insert into Terminal; `winver` egg | P4 | planned | | |
| `WIN-SEARCH-05` | Compact single-pane sheet bounded by visual viewport | P4 | planned | | |
| `WIN-SEARCH-06` | Combobox semantics, chips radiogroup, count status | P4 | planned | | |

### `surfaces/start-menu.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-START-01` | Panel layout: search, pinned grid, recommended, footer | P4 | planned | | |
| `WIN-START-02` | Pinned + Recommended generated from registry and data | P4 | planned | | |
| `WIN-START-03` | Type-to-search hand-off | P4 | planned | | |
| `WIN-START-04` | All apps view with letter jump | P4 | planned | | |
| `WIN-START-05` | User tile + power menu (Lock, Switch OS / Shut down → chooser, Restart) | P4 | planned | | |
| `WIN-START-06` | Open/close motion (250 / 167 ms), window opens from the tile rect | P4 | planned | | |
| `WIN-START-07` | Compact full-height sheet, modal, Back closes | P4 | planned | | |
| `WIN-START-08` | Dialog semantics, 2-D roving grid, focus rules | P4 | planned | | |

### `surfaces/task-view.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-TV-01` | Overview grid incl. minimized windows; titles above tiles; ✕ per tile | P4 | planned | | |
| `WIN-TV-02` | Select / close / exit; reversible animation; snap groups | P4 | planned | | |
| `WIN-TV-03` | Compact card list as the primary switcher | P4 | planned | | |
| `WIN-TV-04` | Dialog semantics + keyboard model | P4 | planned | | |
| `WIN-TV-05` | Decorative single-desktop strip + empty state | P4 | planned | | |

### `surfaces/taskbar.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-TASK-01` | Centered taskbar with Start/Search/Task View + pinned apps as links | P4 | planned | | |
| `WIN-TASK-02` | Pill indicators (none / 6 px / 16 px accent / attention) animated by `scaleX` | P4 | planned | | |
| `WIN-TASK-03` | Hover thumbnail flyout + peek | P4 | planned | | |
| `WIN-TASK-04` | Jump lists (right-click / long-press) | P4 | planned | | |
| `WIN-TASK-05` | System tray → Quick Settings and Notification Center | P4 | planned | | |
| `WIN-TASK-06` | Show desktop sliver | P4 | planned | | |
| `WIN-TASK-07` | Pinned Résumé.pdf item | P4 | planned | | |
| `WIN-TASK-08` | Roving keyboard model + state suffixes | P4 | planned | | |
| `WIN-TASK-09` | Compact + landscape variants | P4 | planned | | |

### `apps/edge.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-EDGE-01` | Browser chrome with tabs in the title bar, address bar, sidebar strip | P4 | planned | | |
| `WIN-EDGE-02` | Overview tab reuses the shared Overview component | P4 | planned | | |
| `WIN-EDGE-03` | Routed tabs: about ↔ résumé | P4 | planned | | |
| `WIN-EDGE-04` | PDF toolbar: page, zoom, Save (download + toast), Print; text version first | P4 | planned | | |
| `WIN-EDGE-05` | Lenis/ScrollTrigger gating + cleanup | P4 | planned | | |
| `WIN-EDGE-06` | Compact layout | P4 | planned | | |

### `apps/file-explorer.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-EXP-01` | Window: tabbed Mica title bar, breadcrumb, command bar, nav pane, details list | P4 | planned | | |
| `WIN-EXP-02` | Select → details pane + URL; open → document view in tab | P4 | planned | | |
| `WIN-EXP-03` | Back/Forward/Up + breadcrumb crumbs and sibling menus | P4 | planned | | |
| `WIN-EXP-04` | Editable address bar with path parsing + error message | P4 | planned | | |
| `WIN-EXP-05` | Sortable table + Tiles/Large icons views | P4 | planned | | |
| `WIN-EXP-06` | Home page (Quick access + Recent from data) | P4 | planned | | |
| `WIN-EXP-07` | Shortcuts open the right apps | P4 | planned | | |
| `WIN-EXP-08` | Compact drill-down layout | P4 | planned | | |

### `apps/github.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-GH-01` | App shell with NavigationView rail, title-bar search, Overview cards | P4 | planned | | |
| `WIN-GH-02` | Project page with breadcrumb, pivots, info card | P4 | planned | | |
| `WIN-GH-03` | Enrichment + heatmap card with accessible alternative | P4 | planned | | |
| `WIN-GH-04` | Filters, sort, rail expand/collapse | P4 | planned | | |
| `WIN-GH-05` | Drill-in/out page motion, reversible | P4 | planned | | |
| `WIN-GH-06` | Compact layout | P4 | planned | | |

### `apps/outlook.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-OUT-01` | Shell: app rail, simplified ribbon, three panes, Focused/Other pivot | P4 | planned | | |
| `WIN-OUT-02` | Compose inside the reading pane with persisted draft + discard confirm | P4 | planned | | |
| `WIN-OUT-03` | Send = encoded `mailto:` + InfoBar + copy fallback | P4 | planned | | |
| `WIN-OUT-04` | Attachment chip → Edge PDF tab / download | P4 | planned | | |
| `WIN-OUT-05` | Compact push navigation + sticky Send | P4 | planned | | |
| `WIN-OUT-06` | Form semantics, status InfoBar, modal confirm | P4 | planned | | |

### `apps/settings.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-SET-01` | Settings window: NavigationView, breadcrumb headers, cards + expanders, search | P4 | planned | | |
| `WIN-SET-02` | Accessibility page controls apply instantly + persist | P4 | planned | | |
| `WIN-SET-03` | Personalization incl. **taskbar alignment Center/Left** | P4 | planned | | |
| `WIN-SET-04` | Privacy + Legal notices surfaces | P4 | planned | | |
| `WIN-SET-05` | Switch operating system page + Back to chooser | P4 | planned | | |
| `WIN-SET-06` | winver dialog egg | P4 | planned | | |
| `WIN-SET-07` | Semantics: switches, sliders, expanders, breadcrumb | P4 | planned | | |

### `apps/vscode.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-CODE-01` | Windows chrome: custom Mica title bar, in-window menubar, command centre, right caption buttons | P4 | planned | | |
| `WIN-CODE-02` | Shared editor body + shared generated files (no fork) | P4 | planned | | |
| `WIN-CODE-03` | Command centre opens Windows Search scoped to files | P4 | planned | | |
| `WIN-CODE-04` | Backslash paths + PowerShell-style terminal panel | P4 | planned | | |
| `WIN-CODE-05` | Menubar semantics without binding Alt/F10 | P4 | planned | | |
| `WIN-CODE-06` | Compact layout with ☰ menu | P4 | planned | | |

### `apps/windows-terminal.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-TERM-01` | Terminal skin: tab strip in title bar, profile dropdown, Acrylic body | P4 | planned | | |
| `WIN-TERM-02` | PowerShell/CMD prompts + backslash display adapter over the shared VFS | P4 | planned | | |
| `WIN-TERM-03` | Windows aliases (`dir`, `type`, `cls`, `start`, `ii`, `Get-Help`) | P4 | planned | | |
| `WIN-TERM-04` | PowerShell-voiced errors with suggestions | P4 | planned | | |
| `WIN-TERM-05` | `start`/`open` dispatches the owning Windows app | P4 | planned | | |
| `WIN-TERM-06` | Shared engine reuse + a11y contract parity | P4 | planned | | |
| `WIN-TERM-07` | "Ubuntu" profile offers the Linux OS | P4 | planned | | |

### `03-motion.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-MOTION-01` | Duration ladder + curves as tokens; table implemented from tokens | P4 | planned | | |
| `WIN-MOTION-02` | Reversible/interruptible transitions incl. Snap cancel | P4 | planned | | |
| `WIN-MOTION-03` | Compositor-only properties | P4 | planned | | |
| `WIN-MOTION-04` | Reduced-motion variants | P4 | planned | | |

### `04-responsive.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-RESP-01` | Full-fidelity posture | P4 | planned | | |
| `WIN-RESP-02` | Tablet posture (spacing, no hover previews, system-menu Snap, resize grip) | P4 | planned | | |
| `WIN-RESP-03` | Compact window mode (min+close, Start sheet, Task View list) | P4 | planned | | |
| `WIN-RESP-04` | Back closes transient sheets first, then navigates | P4 | planned | | |
| `WIN-RESP-05` | Safe areas + dvh; keyboard-aware sheets | P4 | planned | | |
| `WIN-RESP-06` | Size-class transitions keep snaps/floats | P4 | planned | | |
| `WIN-RESP-07` | 400 % zoom engages compact mode | P4 | planned | | |

### `05-accessibility.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-A11Y-01` | Landmark structure + DOM order | P4 | planned | | |
| `WIN-A11Y-02` | Windows semantics map rows | P4 | planned | | |
| `WIN-A11Y-03` | Keyboard-only journey incl. Snap by keyboard | P4 | planned | | |
| `WIN-A11Y-04` | Focus specifics | P4 | planned | | |
| `WIN-A11Y-05` | Contrast themes / forced-colors rendering | P4 | planned | | |
| `WIN-A11Y-06` | Screen-reader script recorded for release | P8 | planned | | |

### `06-edge-cases.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-CASE-01` | E1–E7 (taskbar spam, Snap, resize, compact boundary) | P4 | planned | | |
| `WIN-CASE-02` | E8–E11 (Start/preview/Show-desktop lifecycles) | P4 | planned | | |
| `WIN-CASE-03` | E12–E16 (refresh, deep link, Back, switch/return) | P4 | planned | | |
| `WIN-CASE-04` | E17–E22 (failure, storage, parser, arbiter, re-anchor) | P4 | planned | | |

### `07-cross-os-features.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `WIN-X-01` | Résumé fast path in all listed places | P4 | planned | | |
| `WIN-X-02` | Continuity toast (and lock-card variant) | P4 | planned | | |
| `WIN-X-03` | Tour offer + Windows script (incl. honest Snap demo) + restart points | P4 | planned | | |
| `WIN-X-04` | Eggs wired + found counter | P4 | planned | | |
| `WIN-X-05` | Switch OS entry points + exit beat | P4 | planned | | |

**Total feature IDs: 146**

## Definition-of-done audit (run before flipping this OS to `released` — requirement R49)

**Visual language**
- [ ] Tokens only (no magic numbers); system font stack; icons resolve in both asset modes with identical boxes.
- [ ] Focus ring ≥ 3:1; glyphs never rely on colour alone; forced-colors legible.
- [ ] Grayscale smell test against every already-released OS passes.

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
| | | | | |
