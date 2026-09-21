# Android / 08 — Acceptance ledger

Generated from the feature tables in this folder: every `AND-*` ID appears **exactly once** here. The feature
description and its named acceptance test live in the spec file; this ledger tracks delivery.

Status: `planned` → `built` → `verified` (or `BLOCKED` + reason + owner sign-off). **Evidence** = passing test
name / CI run / capture. An OS is flipped to `released` only when every row is `verified`.

## Ledger

### `01-identity.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `AND-ID-01` | M3 token scope complete incl. tonal surface containers | P6 | planned | | |
| `AND-ID-02` | Build-time dynamic colour from 4 wallpaper seeds, light + dark, contrast-validated | P6 | planned | | |
| `AND-ID-03` | State layers at M3 opacities + focus outline | P6 | planned | | |
| `AND-ID-04` | **Zero `backdrop-filter`** on Android; scrims only | P6 | planned | | |
| `AND-ID-05` | Adaptive icon mask + themed-icons option; identical boxes across asset modes | P6 | planned | | |
| `AND-ID-06` | Roboto Flex loaded only in the Android chunk | P6 | planned | | |

### `02-app-lifecycle.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `AND-LIFE-01` | Container transform open: ripple → sync splash → fade-through, 450 ms emphasized | P6 | planned | | |
| `AND-LIFE-02` | **Predictive Back** preview (interactive on swipe, animated otherwise) | P6 | planned | | |
| `AND-LIFE-03` | Back is hierarchical: IME/menu/sheet → in-app stack → leave app; **browser Back = system Back** | P6 | planned | | |
| `AND-LIFE-04` | Leave → reverse transform into the icon; drawer/folder/absent fallbacks | P6 | planned | | |
| `AND-LIFE-05` | Home keeps the app's stack in Recents; warm LRU(3) | P6 | planned | | |
| `AND-LIFE-06` | In-app shared-axis / fade-through / bottom-sheet patterns | P6 | planned | | |
| `AND-LIFE-07` | History rules (push on open/forward; Back collapses) | P6 | planned | | |
| `AND-LIFE-08` | Focus choreography (title → inert launcher → animate; icon on return) | P6 | planned | | |

### `surfaces/app-drawer.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `AND-DRAWER-01` | Interactive swipe-up sheet with suggestions row + A–Z grid | P6 | planned | | |
| `AND-DRAWER-02` | Search in the drawer = system search skin; results sections | P6 | planned | | |
| `AND-DRAWER-03` | **Back clears query, then closes**; Esc same | P6 | planned | | |
| `AND-DRAWER-04` | Apps launched from the drawer return via centre-bottom shrink | P6 | planned | | |
| `AND-DRAWER-05` | Keyboard-aware results (`--vvh`), pad column | P6 | planned | | |
| `AND-DRAWER-06` | Dialog + combobox/roving semantics | P6 | planned | | |

### `surfaces/app-shortcuts.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `AND-SHORT-01` | Shortcuts popup (pill rows + App info), data-driven, clamped | P6 | planned | | |
| `AND-SHORT-02` | Four invocations (long-press, right-click, keyboard, visible ⋮); Back closes | P6 | planned | | |
| `AND-SHORT-03` | M3 content menus on rows; native menu preserved in text | P6 | planned | | |
| `AND-SHORT-04` | App info page per app in Settings | P6 | planned | | |
| `AND-SHORT-05` | Menu semantics + focus return | P6 | planned | | |

### `surfaces/boot.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `AND-BOOT-01` | Animated mark in the dynamic palette + indeterminate linear progress (CSS-only) | P6 | planned | | |
| `AND-BOOT-02` | Circular reveal into the next surface + fade-through arrival | P6 | planned | | |
| `AND-BOOT-03` | Appearance rules | P6 | planned | | |
| `AND-BOOT-04` | Skip, slow and failure states | P6 | planned | | |
| `AND-BOOT-05` | Reduced motion removes boot | P6 | planned | | |

### `surfaces/favorites-dock.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `AND-FAV-01` | Favorites row: four links, no plate/labels, notification dot state | P6 | planned | | |
| `AND-FAV-02` | Files favorite = résumé fast path | P6 | planned | | |
| `AND-FAV-03` | Search bar opens the drawer focused, with bar → field morph | P6 | planned | | |
| `AND-FAV-04` | Landscape column + pad taskbar dock with recents | P6 | planned | | |
| `AND-FAV-05` | Roving keyboard model + names with state | P6 | planned | | |

### `surfaces/heads-up-notifications.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `AND-HUN-01` | Heads-up card: queue, dwell ≥ 6 s, pause, swipe dismiss, text-button actions | P6 | planned | | |
| `AND-HUN-02` | Trigger table incl. snackbars and silent continuity | P6 | planned | | |
| `AND-HUN-03` | Everything recorded in the shade | P6 | planned | | |
| `AND-HUN-04` | M3 snackbar behaviour (single, timed, non-essential) | P6 | planned | | |
| `AND-HUN-05` | Motion + reduced-motion variants; never steals focus | P6 | planned | | |

### `surfaces/launcher-home.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `AND-HOME-01` | Sparse configured grid + At-a-glance with résumé/continuity chip | P6 | planned | | |
| `AND-HOME-02` | Swipe-up drawer / swipe-down shade with visible button alternatives | P6 | planned | | |
| `AND-HOME-03` | M3 folder popup (container transform, Back closes) | P6 | planned | | |
| `AND-HOME-04` | Roving keyboard grid + semantics | P6 | planned | | |
| `AND-HOME-05` | Phone landscape + full-page layouts (tablet, laptop, desktop — taskbar, no frame) | P6 | planned | | |
| `AND-HOME-06` | Empty-area long-press popup | P6 | planned | | |

### `surfaces/lock-screen.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `AND-LOCK-01` | Lock layout: two-line dynamic-colour clock, At-a-glance, grouped M3 cards, corner shortcuts | P6 | planned | | |
| `AND-LOCK-02` | Appearance rules | P6 | planned | | |
| `AND-LOCK-03` | Unlock by interactive swipe, tap, key or button | P6 | planned | | |
| `AND-LOCK-04` | Card = shortcut with container transform from the card | P6 | planned | | |
| `AND-LOCK-05` | Identical for every profile | P6 | planned | | |

### `surfaces/notification-shade.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `AND-SHADE-01` | One shade: QS row + notifications (State 1), full QS grid (State 2) | P6 | planned | | |
| `AND-SHADE-02` | Tiles wired to prefs incl. Android-only (themed icons, 3-button nav) | P6 | planned | | |
| `AND-SHADE-03` | Interactive pull + button/keyboard open; **Back steps State 2 → 1 → closed** | P6 | planned | | |
| `AND-SHADE-04` | Notification cards: open, expand, dismiss, Clear all; history of heads-up | P6 | planned | | |
| `AND-SHADE-05` | Switch OS + Résumé tiles | P6 | planned | | |
| `AND-SHADE-06` | Two-pane pad layout; dialog semantics | P6 | planned | | |

### `surfaces/recents.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `AND-RECENTS-01` | Carousel of live cards with icon chips, centred most-recent, scroll-snap | P6 | planned | | |
| `AND-RECENTS-02` | Select (transform from card), swipe-up / Delete / chip menu to close, Clear all | P6 | planned | | |
| `AND-RECENTS-03` | Three invocations incl. pill hold; Back/Esc exit | P6 | planned | | |
| `AND-RECENTS-04` | Pad grid layout; dialog semantics | P6 | planned | | |
| `AND-RECENTS-05` | Draft survives Clear all | P6 | planned | | |

### `surfaces/status-and-navigation-bars.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `AND-BARS-01` | Status bar: edge-to-edge colouring, full page width on larger screens, **no punch-hole/camera dot/bezel at any size**, shade button | P6 | planned | | |
| `AND-BARS-02` | **Two navigation modes** with defaults by pointer type and a live toggle | P6 | planned | | |
| `AND-BARS-03` | Back / Home / Recents behaviours incl. pill gestures and quick-switch | P6 | planned | | |
| `AND-BARS-04` | Edge-swipe zones respect the 24 px browser strip | P6 | planned | | |
| `AND-BARS-05` | All three controls keyboard-reachable in gesture mode | P6 | planned | | |
| `AND-BARS-06` | Landscape/pad placements | P6 | planned | | |

### `apps/chrome.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `AND-CHROME-01` | Chrome chrome: top omnibox toolbar that hides on scroll, tab count, ⋮ menu | P6 | planned | | |
| `AND-CHROME-02` | Shared Overview content in Material composition; native scroll only | P6 | planned | | |
| `AND-CHROME-03` | ⋮ menu, Share bottom sheet, Bookmarks open apps, Find in page | P6 | planned | | |
| `AND-CHROME-04` | Tab switcher grid | P6 | planned | | |
| `AND-CHROME-05` | Pad tab strip layout; semantics | P6 | planned | | |

### `apps/files.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `AND-FILES-01` | Browse (recents, category cards, storage) + Starred via bottom nav | P6 | planned | | |
| `AND-FILES-02` | Folder list/grid with sort + item menus; forward navigation + URLs | P6 | planned | | |
| `AND-FILES-03` | Document reader view | P6 | planned | | |
| `AND-FILES-04` | **PDF viewer**: pages, indicator chip, extended FAB Download, Text version | P6 | planned | | |
| `AND-FILES-05` | Synthesized stack on deep open; Back → Browse → launcher | P6 | planned | | |
| `AND-FILES-06` | Star with Undo snackbar; Info bottom sheet | P6 | planned | | |
| `AND-FILES-07` | Pad rail + list-detail; semantics | P6 | planned | | |

### `apps/github.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `AND-GH-01` | M3 app: bottom nav with indicator pills, Home/Projects/Profile | P6 | planned | | |
| `AND-GH-02` | Card → detail container transform; Back reverses into the card (predictive) | P6 | planned | | |
| `AND-GH-03` | Filter chips, card menus, swipeable M3 tabs | P6 | planned | | |
| `AND-GH-04` | Enrichment + heatmap with accessible alternative | P6 | planned | | |
| `AND-GH-05` | Pad navigation rail + list-detail layout | P6 | planned | | |
| `AND-GH-06` | Semantics | P6 | planned | | |

### `apps/gmail.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `AND-GMAIL-01` | Inbox with top search bar, drawer, data-generated messages | P6 | planned | | |
| `AND-GMAIL-02` | **Extended FAB** that shrinks on scroll; FAB → compose container transform | P6 | planned | | |
| `AND-GMAIL-03` | Compose activity with persisted draft + "Draft saved" | P6 | planned | | |
| `AND-GMAIL-04` | Send = encoded `mailto:` + snackbar with Copy action | P6 | planned | | |
| `AND-GMAIL-05` | Attachment chip → Files PDF viewer / download | P6 | planned | | |
| `AND-GMAIL-06` | Keyboard-safe compose; pad rail + list-detail + card compose | P6 | planned | | |
| `AND-GMAIL-07` | Semantics (dialog form, snackbar status, swipe alternative) | P6 | planned | | |

### `apps/keep-notes.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `AND-KEEP-01` | Masonry board via CSS columns with pinned/others, coloured M3 cards, label chips | P6 | planned | | |
| `AND-KEEP-02` | Notes generated by the **shared** formatters (same as iOS Notes) | P6 | planned | | |
| `AND-KEEP-03` | Card ↔ note container transform; Back reverses | P6 | planned | | |
| `AND-KEEP-04` | Search, labels drawer filter, grid/list toggle | P6 | planned | | |
| `AND-KEEP-05` | Read-only FAB dialog → Gmail; read-only snackbar | P6 | planned | | |
| `AND-KEEP-06` | Pad columns + rail; semantics + plain skills alternative | P6 | planned | | |

### `apps/settings.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `AND-SET-01` | Settings with collapsing large app bar, search with breadcrumbs, tonal-circle list | P6 | planned | | |
| `AND-SET-02` | **Wallpaper & style** re-themes the whole UI live (Material You) + themed icons | P6 | planned | | |
| `AND-SET-03` | Accessibility / Sound controls apply instantly + persist | P6 | planned | | |
| `AND-SET-04` | Navigation mode radio cards switch the nav bar live | P6 | planned | | |
| `AND-SET-05` | Apps → App info; About phone; Legal; Privacy | P6 | planned | | |
| `AND-SET-06` | Switch operating system + Tour | P6 | planned | | |
| `AND-SET-07` | Pad two-pane; semantics | P6 | planned | | |

### `03-motion.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `AND-MOTION-01` | M3 easing + duration tokens incl. the emphasized CustomEase path | P6 | planned | | |
| `AND-MOTION-02` | Pattern library: container transform, shared axis, fade-through | P6 | planned | | |
| `AND-MOTION-03` | **Ripple from the touch point** (pooled span, WAAPI, 80 ms delay inside scrollers) + state layers | P6 | planned | | |
| `AND-MOTION-04` | Interruption: distance-scaled re-creation; Back reverses | P6 | planned | | |
| `AND-MOTION-05` | Reduced-motion variants (ripple → state layer) | P6 | planned | | |

### `04-responsive.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `AND-RESP-01` | Phone full-bleed, edge-to-edge with real insets, no drawn cut-out | P6 | planned | | |
| `AND-RESP-02` | Phone landscape placements | P6 | planned | | |
| `AND-RESP-03` | Full-page layout on tablets: taskbar, top search bar, two-pane shade, **navigation rail + list-detail canonical layouts** | P6 | planned | | |
| `AND-RESP-04` | **Full page on laptops/desktops — no device frame**: wallpaper, launcher and taskbar fill the viewport; icon size and columns from the viewport; apps open to the full page; 3-button default | P6 | planned | | |
| `AND-RESP-05` | Pointer adaptations + visible system controls (ripple at the click point, click-drag swipe, wheel, right-click shortcuts; Back/Home/Recents and All apps in the taskbar) | P6 | planned | | |
| `AND-RESP-06` | Layout swaps preserve app, stack and Recents | P6 | planned | | |
| `AND-RESP-07` | Keyboard-safe compose/search/snackbars | P6 | planned | | |

### `05-accessibility.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `AND-A11Y-01` | Landmark structure; inert rules; system navigation always operable | P6 | planned | | |
| `AND-A11Y-02` | Android semantics map rows | P6 | planned | | |
| `AND-A11Y-03` | **Back contract** (smallest step; focus returns to the opener) | P6 | planned | | |
| `AND-A11Y-04` | Keyboard-only journey | P6 | planned | | |
| `AND-A11Y-05` | Contrast validated for all schemes; non-colour state cues | P6 | planned | | |
| `AND-A11Y-06` | Screen-reader script recorded for release (TalkBack + NVDA) | P8 | planned | | |

### `06-edge-cases.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `AND-CASE-01` | E1–E2, E7–E8 (tap spam, re-created tweens, drawer return, rotation) | P6 | planned | | |
| `AND-CASE-02` | E3–E6 (**Back** spam, equivalence of Back sources, predictive cancel, edge rule) | P6 | planned | | |
| `AND-CASE-03` | E9–E11, E18 (overlay arbitration, live nav-mode and scheme changes) | P6 | planned | | |
| `AND-CASE-04` | E12–E17, E19–E22 (refresh, deep link, Recents draft, switch/return, failure, keyboard, layout swap, storage) | P6 | planned | | |

### `07-cross-os-features.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `AND-X-01` | Résumé fast path in all listed places | P6 | planned | | |
| `AND-X-02` | Silent continuity: At-a-glance line + Silent shade card (+ lock variant) | P6 | planned | | |
| `AND-X-03` | Tour offer + Android script (teaches drawer + **Back**) + restart points | P6 | planned | | |
| `AND-X-04` | Eggs wired + found counter | P6 | planned | | |
| `AND-X-05` | Switch OS entry points + circular-conceal exit beat | P6 | planned | | |

**Total feature IDs: 133**

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

**Journeys green:** A1 · A2 · A-keyboard · H1 · D1 · P1 · R1 · O1 · S1 · T1 · C1 · Q1 · X1–X5 on Android (pixel, pixel-landscape, tablet ×2, chromium-desktop full page)
- [ ] **No device frame at any size** (north-star B17): on laptops/desktops the shell and every opened app fill the viewport.

**Plan conformance**
- [ ] Every row above is `verified` with evidence, or `BLOCKED` with owner sign-off.
- [ ] Every "Not like the others" clause in this folder is demonstrably true.
- [ ] Deviations below are complete and signed.

## Deviations log
| Date | ID | What changed vs the spec | Why | Owner sign-off |
|---|---|---|---|---|
| | | | | |
