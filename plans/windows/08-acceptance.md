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
