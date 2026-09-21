# macOS / 08 — Acceptance ledger

Generated from the feature tables in this folder: every `MAC-*` ID appears **exactly once** here. The feature
description and its named acceptance test live in the spec file; this ledger tracks delivery.

Status: `planned` → `built` → `verified` (or `BLOCKED` + reason + owner sign-off). **Evidence** = passing test
name / CI run / capture. An OS is flipped to `released` only when every row is `verified`.

## Ledger

### `01-identity.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-ID-01` | macOS token scope complete | P2 | planned | | |
| `MAC-ID-02` | Active vs inactive window appearance | P2 | planned | | |
| `MAC-ID-03` | Traffic lights: size, hit pitch, glyph visibility rules | P2 | planned | | |
| `MAC-ID-04` | Wallpaper static, light/dark, tier-2 parallax only | P2 | planned | | |
| `MAC-ID-05` | Vibrancy materials within the 3-surface cap | P3 | planned | | |
| `MAC-ID-06` | Light/dark parity | P3 | planned | | |

### `02-window-manager.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-WM-01` | Open from launcher rect with cascade + learned rects | P2 | planned | | |
| `MAC-WM-02` | Focus + layering + inactive appearance; click acts in one press | P2 | planned | | |
| `MAC-WM-03` | Drag with clamps, commit once, zero React renders | P2 | planned | | |
| `MAC-WM-04` | Eight-zone resize with min size; ghost at T0 | P3 | planned | | |
| `MAC-WM-05` | Minimize (Scale) into Dock + restore, reversible mid-flight | P2 | planned | | |
| `MAC-WM-06` | Zoom / restore via green button and title double-click | P2 | planned | | |
| `MAC-WM-07` | Close keeps app running; Quit removes dot | P3 | planned | | |
| `MAC-WM-08` | Dock click semantics (open / restore / focus / no-op) | P2 | planned | | |
| `MAC-WM-09` | Window menu: Move / Size / Center by keyboard | P3 | planned | | |
| `MAC-WM-10` | Compact mode: single maximized window, controls menu | P2 | planned | | |
| `MAC-WM-11` | History rules per window event | P2 | planned | | |
| `MAC-WM-12` | Hide others / Show all | P3 | planned | | |

### `surfaces/boot.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-BOOT-01` | Boot visuals with real-milestone progress | P3 | planned | | |
| `MAC-BOOT-02` | Appearance rules (first chooser entry only; never deep link/refresh/re-entry) | P3 | planned | | |
| `MAC-BOOT-03` | Any input skips; ≤ 1.5 s added | P3 | planned | | |
| `MAC-BOOT-04` | Slow/failure states with /plain link | P3 | planned | | |
| `MAC-BOOT-05` | Reduced motion removes boot | P3 | planned | | |

### `surfaces/context-menus.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-CTX-01` | Menu component + positioning/clamping | P3 | planned | | |
| `MAC-CTX-02` | Menus per target (table above) | P3 | planned | | |
| `MAC-CTX-03` | Three invocations: contextmenu event, long-press, visible ⋯ | P3 | planned | | |
| `MAC-CTX-04` | Native menu preserved on text, inputs, Terminal | P3 | planned | | |
| `MAC-CTX-05` | Get Info panel + Copy Link (canonical URL) | P3 | planned | | |
| `MAC-CTX-06` | APG menu keyboard model, focus return | P3 | planned | | |

### `surfaces/desktop.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-DESK-01` | Wallpaper + data-driven desktop items as links | P2 | planned | | |
| `MAC-DESK-02` | Select vs open by pointer type; keyboard opens immediately | P3 | planned | | |
| `MAC-DESK-03` | Marquee selection, no layout writes | P3 | planned | | |
| `MAC-DESK-04` | Roving 2-D keyboard navigation + type-ahead | P3 | planned | | |
| `MAC-DESK-05` | Empty-desktop click focuses Finder in the menu bar | P3 | planned | | |
| `MAC-DESK-06` | Compact/touch variants | P3 | planned | | |

### `surfaces/dock.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-DOCK-01` | Dock pill with pinned apps as links, running dots | P2 | planned | | |
| `MAC-DOCK-02` | Magnification (formula, transform-only, spring envelope) | P3 | planned | | |
| `MAC-DOCK-03` | Launch bounce only while loading | P3 | planned | | |
| `MAC-DOCK-04` | Minimized tiles + restore | P2 | planned | | |
| `MAC-DOCK-05` | Labels on hover and on focus-visible | P3 | planned | | |
| `MAC-DOCK-06` | Dock context menu | P3 | planned | | |
| `MAC-DOCK-07` | Résumé stack (Open / Download) | P3 | planned | | |
| `MAC-DOCK-08` | Handoff slot for continuity offers | P4 | planned | | |
| `MAC-DOCK-09` | Roving keyboard model, names with state suffix | P2 | planned | | |
| `MAC-DOCK-10` | Compact bottom scroll + landscape left rail | P3 | planned | | |

### `surfaces/lock-screen.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-LOCK-01` | Lock screen layout with data-driven notifications | P3 | planned | | |
| `MAC-LOCK-02` | Appearance rules (first chooser entry per session only) | P3 | planned | | |
| `MAC-LOCK-03` | Any input unlocks; explicit Enter button | P3 | planned | | |
| `MAC-LOCK-04` | Notification = shortcut that unlocks and opens the app | P3 | planned | | |
| `MAC-LOCK-05` | Identical for every profile | P3 | planned | | |

### `surfaces/menu-bar.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-MENU-01` | Static bar with Apple menu, app name, status items | P2 | planned | | |
| `MAC-MENU-02` | Menus follow the focused app (data-driven per app) | P3 | planned | | |
| `MAC-MENU-03` | Instant open, hover-switch, blink + fade close | P3 | planned | | |
| `MAC-MENU-04` | APG menubar keyboard model | P3 | planned | | |
| `MAC-MENU-05` | Apple menu items (About, Settings, Switch OS, Tour, Lock, Restart) | P3 | planned | | |
| `MAC-MENU-06` | Status items: Résumé, Spotlight, Control Center, clock | P3 | planned | | |
| `MAC-MENU-07` | Compact collapse to a single menu | P3 | planned | | |
| `MAC-MENU-08` | Shortcut hints show real bindings only | P3 | planned | | |

### `surfaces/mission-control.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-MC-01` | Overview grid from live windows via flight (pure packing function) | P3 | planned | | |
| `MAC-MC-02` | Select / exit / reversible animation | P3 | planned | | |
| `MAC-MC-03` | Compact carousel as the primary switcher + close buttons | P2 | planned | | |
| `MAC-MC-04` | Keyboard model + dialog semantics | P3 | planned | | |
| `MAC-MC-05` | Empty state with shortcuts | P3 | planned | | |

### `surfaces/notifications.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-NOTIF-01` | Banner component, queue (1 visible, max 3), dwell ≥ 6 s, pause on hover/focus | P3 | planned | | |
| `MAC-NOTIF-02` | Trigger table (deterministic, identical for all visitors) | P3 | planned | | |
| `MAC-NOTIF-03` | Notification Center keeps every banner; clear actions | P3 | planned | | |
| `MAC-NOTIF-04` | Spring in / ease out / swipe with velocity hand-off | P3 | planned | | |
| `MAC-NOTIF-05` | Never steals focus; status region semantics | P3 | planned | | |
| `MAC-NOTIF-06` | Compact variants | P3 | planned | | |

### `surfaces/spotlight.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-SPOT-01` | Panel with zero state, grouped results, preview pane | P3 | planned | | |
| `MAC-SPOT-02` | Invocation (Ctrl/Cmd+K, menu-bar icon, `/`) and Esc clear-then-close | P3 | planned | | |
| `MAC-SPOT-03` | Result opens via kernel from the panel rect; one history entry | P3 | planned | | |
| `MAC-SPOT-04` | Command results insert into Terminal, never execute | P3 | planned | | |
| `MAC-SPOT-05` | Compact top sheet bounded by visual viewport | P3 | planned | | |
| `MAC-SPOT-06` | Combobox semantics + debounced count | P3 | planned | | |

### `apps/finder.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-FIND-01` | Window with sidebar, toolbar, column view fed by selectors | P2 | planned | | |
| `MAC-FIND-02` | Select → preview column + URL; open → document view | P2 | planned | | |
| `MAC-FIND-03` | Back/Forward nav stack tied to history collapse | P2 | planned | | |
| `MAC-FIND-04` | Icons / List (sortable table) / Columns views | P3 | planned | | |
| `MAC-FIND-05` | Quick Look (Space) | P3 | planned | | |
| `MAC-FIND-06` | Aliases open the right apps | P3 | planned | | |
| `MAC-FIND-07` | Compact drill-down layout | P2 | planned | | |
| `MAC-FIND-08` | Empty/loading states | P3 | planned | | |
| `MAC-FIND-09` | Menu-bar menus wired | P3 | planned | | |

### `apps/github.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-GH-01` | App shell: sidebar profile, pinned grid, repository list | P3 | planned | | |
| `MAC-GH-02` | Project detail with README / Stack / Links tabs + About rail | P3 | planned | | |
| `MAC-GH-03` | GitHub enrichment + heatmap with accessible alternative | P3 | planned | | |
| `MAC-GH-04` | Stack filter chips | P3 | planned | | |
| `MAC-GH-05` | List ↔ detail flight, reversible | P3 | planned | | |
| `MAC-GH-06` | External link treatment | P3 | planned | | |
| `MAC-GH-07` | Compact pushed-page layout | P3 | planned | | |

### `apps/mail.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-MAIL-01` | Three-pane client with data-generated inbox | P3 | planned | | |
| `MAC-MAIL-02` | Compose sheet with persisted draft | P3 | planned | | |
| `MAC-MAIL-03` | Send = encoded `mailto:` hand-off + confirmation + copy fallback | P3 | planned | | |
| `MAC-MAIL-04` | Copy address with clipboard fallback + banner | P3 | planned | | |
| `MAC-MAIL-05` | Compact push navigation + full-height compose | P3 | planned | | |
| `MAC-MAIL-06` | Form semantics, keyboard send, polite confirmation | P3 | planned | | |

### `apps/preview.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-PREV-01` | Viewer window with toolbar, thumbnails, page canvas | P3 | planned | | |
| `MAC-PREV-02` | Inline PDF with page-image fallback | P3 | planned | | |
| `MAC-PREV-03` | Download with filename + analytics + banner | P3 | planned | | |
| `MAC-PREV-04` | Text version first in DOM; toggle | P3 | planned | | |
| `MAC-PREV-05` | Zoom scoped to the canvas | P3 | planned | | |
| `MAC-PREV-06` | Print stylesheet hides OS chrome | P3 | planned | | |

### `apps/safari.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-SAF-01` | Browser chrome: toolbar, address pill, tabs, favourites | P3 | planned | | |
| `MAC-SAF-02` | Overview content from `AboutOverview` | P3 | planned | | |
| `MAC-SAF-03` | Lenis + ScrollTrigger scoped to this scroller, gated by pointer/tier/motion | P3 | planned | | |
| `MAC-SAF-04` | Effects are enhancement only | P3 | planned | | |
| `MAC-SAF-05` | Tabs (APG) incl. inline plain version | P3 | planned | | |
| `MAC-SAF-06` | Lifecycle cleanup (destroy on close/minimize) | P3 | planned | | |
| `MAC-SAF-07` | Compact layout with bottom segmented control | P3 | planned | | |

### `apps/system-settings.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-SET-01` | Settings window with panes + search | P3 | planned | | |
| `MAC-SET-02` | Accessibility & motion controls apply instantly and persist | P3 | planned | | |
| `MAC-SET-03` | Appearance, Sound, Desktop & Dock prefs wired | P3 | planned | | |
| `MAC-SET-04` | Privacy + Legal notices surfaces | P3 | planned | | |
| `MAC-SET-05` | Switch Operating System + Back to chooser | P3 | planned | | |
| `MAC-SET-06` | About This Mac egg | P3 | planned | | |
| `MAC-SET-07` | Semantics: switches, radio swatches, headings | P3 | planned | | |

### `apps/terminal.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-TERM-01` | Terminal window skin (zsh prompt, profiles, live cols×rows title) | P3 | planned | | |
| `MAC-TERM-02` | Shared engine reuse (no fork of logic) | P3 | planned | | |
| `MAC-TERM-03` | `open` dispatches the owning macOS app | P3 | planned | | |
| `MAC-TERM-04` | Lazy engine chunk with instant static first line | P3 | planned | | |
| `MAC-TERM-05` | Session persistence (cwd, history, scrollback cap) | P3 | planned | | |
| `MAC-TERM-06` | Accessibility contract parity with Linux | P3 | planned | | |

### `apps/vscode.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-CODE-01` | Editor shell: activity bar, Explorer tree, tabs, status bar | P3 | planned | | |
| `MAC-CODE-02` | Files generated from data by formatters | P3 | planned | | |
| `MAC-CODE-03` | Lightweight syntax tokenizers (no editor library) | P3 | planned | | |
| `MAC-CODE-04` | Read-only message, inlay skill hints | P3 | planned | | |
| `MAC-CODE-05` | Search view on the shared index; palette = Spotlight | P3 | planned | | |
| `MAC-CODE-06` | Embedded Terminal panel (lazy engine) | P3 | planned | | |
| `MAC-CODE-07` | Tree/tabs semantics + plain skills alternative | P3 | planned | | |
| `MAC-CODE-08` | Compact layout | P3 | planned | | |

### `03-motion.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-MOTION-01` | Timing table implemented as tokens (no magic numbers in components) | P3 | planned | | |
| `MAC-MOTION-02` | Every transition reversible/interruptible as specified | P3 | planned | | |
| `MAC-MOTION-03` | Compositor-only properties in all flights | P3 | planned | | |
| `MAC-MOTION-04` | Reduced-motion variants | P3 | planned | | |

### `04-responsive.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-RESP-01` | Full-fidelity posture (`expanded`/`large`) | P3 | planned | | |
| `MAC-RESP-02` | Touch desktop posture: touch drag, resize corner, Tile menu, long-press | P3 | planned | | |
| `MAC-RESP-03` | Compact window mode (single window, controls menu, Windows button) | P2 | planned | | |
| `MAC-RESP-04` | Compact landscape left-rail Dock | P3 | planned | | |
| `MAC-RESP-05` | Safe areas + dvh; keyboard-aware sheets | P3 | planned | | |
| `MAC-RESP-06` | Size-class transitions restore/maximize without storms | P3 | planned | | |
| `MAC-RESP-07` | 400 % zoom engages compact mode | P3 | planned | | |

### `05-accessibility.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-A11Y-01` | Landmark structure + DOM order = open order | P2 | planned | | |
| `MAC-A11Y-02` | macOS semantics map rows | P3 | planned | | |
| `MAC-A11Y-03` | Keyboard-only journey M1 | P3 | planned | | |
| `MAC-A11Y-04` | Focus specifics (Dock icon/tile targets, menus return focus) | P3 | planned | | |
| `MAC-A11Y-05` | Increase contrast / forced-colors rendering | P3 | planned | | |
| `MAC-A11Y-06` | Screen-reader script recorded for release | P8 | planned | | |

### `06-edge-cases.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-EDGE-01` | Scenarios E1–E7 (window abuse + resize) | P2 | planned | | |
| `MAC-EDGE-02` | Scenarios E8–E12 (refresh, deep link, Back, OS switch/return) | P3 | planned | | |
| `MAC-EDGE-03` | Scenarios E13–E18 (failure, storage, stale data, hidden tab) | P3 | planned | | |
| `MAC-EDGE-04` | Scenarios E19–E22 + overlay arbiter | P3 | planned | | |

### `07-cross-os-features.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `MAC-X-01` | Résumé fast path in all six places | P3 | planned | | |
| `MAC-X-02` | Dock Handoff slot for continuity | P4 | planned | | |
| `MAC-X-03` | Tour offer + macOS script + restart entry points | P3 | planned | | |
| `MAC-X-04` | Eggs wired (About This Mac, Konami, terminal eggs) + found counter | P3 | planned | | |
| `MAC-X-05` | Switch OS entry points + exit beat | P3 | planned | | |

**Total feature IDs: 157**

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

**Journeys green:** M1 · M2 · M3 · H1 · D1 · P1 · R1 · O1 · S1 · T1 · C1 · Q1 · X1–X5 on macOS

**Plan conformance**
- [ ] Every row above is `verified` with evidence, or `BLOCKED` with owner sign-off.
- [ ] Every "Not like the others" clause in this folder is demonstrably true.
- [ ] Deviations below are complete and signed.

## Deviations log
| Date | ID | What changed vs the spec | Why | Owner sign-off |
|---|---|---|---|---|
| | | | | |
