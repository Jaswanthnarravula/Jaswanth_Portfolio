# iOS / 08 — Acceptance ledger see log | see log | see log | see log | see log | see log | see log | see log | see log | see log | see log | see log | see log | see log | see log |

Generated from the feature tables in this folder: every `IOS-*` ID appears **exactly once** here. The feature
description and its named acceptance test live in the spec file; this ledger tracks delivery.

Status: `planned` → `built` → `verified` (or `BLOCKED` + reason + owner sign-off). **Evidence** = passing test
name / CI run / capture. An OS is flipped to `released` only when every row is `verified`.

## Ledger

### `01-identity.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `IOS-ID-01` | iOS token scope complete | P5 | verified | unit `identity.test.ts` ×5 |see log |
| `IOS-ID-02` | Squircle icon mask, identical boxes across asset modes | P5 | verified | e2e `ios-surfaces.spec.ts` | |
| `IOS-ID-03` | Wallpaper depth: static layer + pointer parallax only, scale/dim on app open | P5 | verified | perf `performance.spec.ts` | |
| `IOS-ID-04` | Dim-on-press feedback (80 in / 200 out), no ripple | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-ID-05` | Materials within the 3-surface cap; solid fallback | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-ID-06` | Light/dark parity | P5 | verified | e2e `ios-surfaces.spec.ts` |see log |

### `02-app-lifecycle.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `IOS-FLIGHT-01` | Icon → app flight (transform + clip-path radius, sync placeholder, deferred mount) | P5 | verified | unit `motion.test.ts` · e2e `ios.spec.ts` | |
| `IOS-FLIGHT-02` | App → **originating** icon with re-measure, folder/page/absent fallbacks | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-FLIGHT-03` | Interactive Home gesture: 1:1 drag, velocity projection, pause → switcher | P5 | verified | unit `motion.test.ts` · e2e `ios.spec.ts` |see log |
| `IOS-FLIGHT-04` | App Switcher: card stack, open, swipe-up or ✕ to close | P5 | verified | cmp `shell.test.tsx` · e2e `ios.spec.ts` | |
| `IOS-FLIGHT-05` | Warm LRU(3) apps keep state; older restore from NavStack + scroll | P5 | verified | unit `model.test.ts` · e2e `ios.spec.ts` | |
| `IOS-FLIGHT-06` | Push/pop stack, large-title collapse, interactive edge-swipe back | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-FLIGHT-07` | Sheets with detents, grabber drag, always-visible Cancel/Done | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-FLIGHT-08` | History: open/push `go()`; Back pops then goes Home | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-FLIGHT-09` | Focus choreography (heading → inert → animate; icon on return) | P5 | verified | e2e `ios.spec.ts` | |

### `surfaces/boot.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `IOS-BOOT-01` | Logo-only boot + icon fly-in arrival | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-BOOT-02` | Appearance rules | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-BOOT-03` | Any input skips; slow/failure states | P5 | verified | e2e `ios-surfaces.spec.ts` ×2 | |
| `IOS-BOOT-04` | Reduced motion removes boot + fly-in | P5 | verified | e2e `ios-surfaces.spec.ts` | |

### `surfaces/control-center.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `IOS-CC-01` | Module grid with toggles, sliders, Now, Switch OS, Résumé, Tour | P5 | verified | cmp `shell.test.tsx` | |
| `IOS-CC-02` | Toggles/sliders wired to prefs, instant apply + persist | P5 | verified | cmp `shell.test.tsx` · e2e `ios.spec.ts` | |
| `IOS-CC-03` | Interactive pull-down + button/keyboard alternatives; close paths | P5 | verified | e2e `ios-surfaces.spec.ts` | |
| `IOS-CC-04` | Long-press expansion with "More" button alternative | P5 | verified | e2e `ios-surfaces.spec.ts` | |
| `IOS-CC-05` | Switch OS sheet | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-CC-06` | Dialog semantics, native range sliders | P5 | verified | cmp `shell.test.tsx` | |

### `surfaces/dock.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `IOS-DOCK-01` | Frosted plate with four apps as links, no labels, badges | P5 | verified | unit `model.test.ts` · cmp `shell.test.tsx` · e2e `ios.spec.ts` | |
| `IOS-DOCK-02` | Files in Dock = résumé fast path | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-DOCK-03` | Flight origin/return targets the Dock icon | P5 | verified | e2e `ios-surfaces.spec.ts` | |
| `IOS-DOCK-04` | Landscape trailing-edge + pad floating Dock with recents | P5 | verified | e2e `ios-surfaces.spec.ts` ×2 | |
| `IOS-DOCK-05` | Roving keyboard model + names | P5 | verified | cmp `shell.test.tsx` | |

### `surfaces/folders.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `IOS-FOLD-01` | Closed folder with 3 × 3 mini-grid; data-driven shortcuts | P5 | verified | unit `model.test.ts` | |
| `IOS-FOLD-02` | Open/close flight from/to the folder icon; blurred dimmed backdrop | P5 | verified | e2e `ios-surfaces.spec.ts` | |
| `IOS-FOLD-03` | Item opens app from its rect; return targets the folder icon | P5 | verified | e2e `ios-surfaces.spec.ts` | |
| `IOS-FOLD-04` | Dialog semantics, focus in/out, inert background | P5 | verified | cmp `shell.test.tsx` | |

### `surfaces/home-screen.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `IOS-HOME-01` | Configured grid (apps, folder, widget) as links with labels | P5 | verified | unit `model.test.ts` · cmp `shell.test.tsx` · e2e `ios.spec.ts` |see log |
| `IOS-HOME-02` | Pages via CSS scroll-snap + dot buttons + Search-pill/dots morph | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-HOME-03` | Data-driven badges in names and visuals | P5 | verified | unit `model.test.ts` · cmp `shell.test.tsx` | |
| `IOS-HOME-04` | Pull-down to Spotlight with non-gesture alternatives | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-HOME-05` | Roving 2-D navigation across pages | P5 | verified | cmp `shell.test.tsx` | |
| `IOS-HOME-06` | Phone landscape + full-page layouts (tablet, laptop, desktop — no frame) | P5 | verified | unit `model.test.ts` · e2e `ios.spec.ts` | |
| `IOS-HOME-07` | Deterministic reflow + page memory by icon | P5 | verified | unit `model.test.ts` · e2e `ios.spec.ts` | |

### `surfaces/lock-screen.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `IOS-LOCK-01` | Lock layout: large clock, bottom notification stack, quick buttons | P5 | verified | unit `model.test.ts` · e2e `ios.spec.ts` | |
| `IOS-LOCK-02` | Appearance rules | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-LOCK-03` | Unlock by interactive swipe, tap, key or explicit button | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-LOCK-04` | Notification = shortcut; app flies out from its rect | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-LOCK-05` | Identical for every profile | P5 | verified | unit `identity.test.ts` ×3 · cmp `lock-profiles.test.tsx` ×2 | |

### `surfaces/notifications.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `IOS-NOTIF-01` | Banner component: queue, dwell ≥ 6 s, pause, swipe-up dismiss, expand | P5 | verified | unit `model.test.ts` | |
| `IOS-NOTIF-02` | Trigger table incl. Handoff banner | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-NOTIF-03` | Banner tap opens the app from the banner rect | P5 | verified | e2e `ios-surfaces.spec.ts` | |
| `IOS-NOTIF-04` | Notification Center keeps everything; Clear per stack | P5 | verified | e2e `ios-surfaces.spec.ts` | |
| `IOS-NOTIF-05` | Never steals focus; dialog semantics for the Center | P5 | verified | e2e `ios-surfaces.spec.ts` | |

### `surfaces/quick-actions.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `IOS-QA-01` | Icon quick-action menus (lift, blur/dim, anchored menu) with data-driven items | P5 | verified | unit `model.test.ts` | |
| `IOS-QA-02` | Context preview cards on content rows | P5 | verified | e2e `ios-surfaces.spec.ts` | |
| `IOS-QA-03` | Four invocations (long-press, right-click, keyboard, visible ⋯) | P5 | verified | e2e `ios-surfaces.spec.ts` | |
| `IOS-QA-04` | Native menu preserved in text/inputs | P5 | verified | e2e `ios-surfaces.spec.ts` | |
| `IOS-QA-05` | Menu semantics + focus return | P5 | verified | cmp `quick-actions.test.tsx` ×12 | |

### `surfaces/spotlight.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `IOS-SPOT-01` | Full-screen Spotlight with bottom field, suggestion zero state, grouped cards | P5 | verified | cmp `shell.test.tsx` | |
| `IOS-SPOT-02` | Interactive pull-down + pill/shortcut alternatives; Cancel/Esc behaviour | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-SPOT-03` | Result opens with a flight from its row; one history entry | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-SPOT-04` | Command results offer Linux (insert-only, never auto-switch) | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-SPOT-05` | Keyboard-aware list (`--vvh`), pad top placement | P5 | verified | e2e `ios-surfaces.spec.ts` ×2 | |
| `IOS-SPOT-06` | Combobox semantics | P5 | verified | cmp `shell.test.tsx` | |

### `surfaces/status-bar-and-home-indicator.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `IOS-STAT-01` | Status bar inside the real safe area on phones, full-width with date on larger screens; **no notch, cut-out or bezel drawn at any size** | P5 | verified | unit `model.test.ts` · e2e `ios.spec.ts` ×2 | |
| `IOS-STAT-02` | Status-bar zones as buttons → Notification Center / Control Center; time scrolls to top | P5 | verified | cmp `shell.test.tsx` | |
| `IOS-STAT-03` | Home indicator: tap = Home, drag = gesture, long-press = switcher | P5 | verified | cmp `shell.test.tsx` |see log |
| `IOS-STAT-04` | Adaptive status style per app | P5 | verified | cmp `shell.test.tsx` | |
| `IOS-STAT-05` | Landscape handles + pad variant | P5 | verified | e2e `ios-surfaces.spec.ts` ×2 | |

### `surfaces/widgets.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `IOS-WIDG-01` | Résumé (medium), Open-to-work and Projects (small) widgets from data | P5 | verified | cmp `shell.test.tsx` |see log |
| `IOS-WIDG-02` | Widget = link; separate Download control (no nested interactives) | P5 | verified | cmp `shell.test.tsx` | |
| `IOS-WIDG-03` | Flight from/to the widget rect | P5 | verified | e2e `ios-surfaces.spec.ts` | |
| `IOS-WIDG-04` | No timers/loops; static per session | P5 | verified | perf `performance.spec.ts` | |

### `apps/files.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `IOS-FILES-01` | Browse/Recents tabs, locations, favorites, tags from data | P5 | verified | unit `files-model.test.ts` · cmp `files.test.tsx` |see log |
| `IOS-FILES-02` | Folder list/icons views with sort menu; pushed navigation + URLs | P5 | verified | unit `files-model.test.ts` · cmp `files.test.tsx` · e2e `ios.spec.ts` | |
| `IOS-FILES-03` | Document view for roles/schools | P5 | verified | cmp `files.test.tsx` | |
| `IOS-FILES-04` | **Quick Look résumé**: zoom from row, Done, swipe-down, thumbnails, Download, Text version | P5 | verified | cmp `files.test.tsx` |see log |
| `IOS-FILES-05` | Synthesized stack on deep open from the Dock | P5 | verified | unit `files-model.test.ts` · cmp `files.test.tsx` · e2e `ios.spec.ts` | |
| `IOS-FILES-06` | Pad sidebar layout + sheet Quick Look | P5 | verified | cmp `files.test.tsx` | |
| `IOS-FILES-07` | Semantics (dialog Quick Look, text-first résumé) | P5 | verified | cmp `files.test.tsx` | |

### `apps/github.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `IOS-GH-01` | Tab-bar app: Home, Projects, Profile with large titles | P5 | verified | cmp `github.test.tsx` ×4 · e2e `ios-journeys.spec.ts` | |
| `IOS-GH-02` | Pushed project detail with segmented README / Stack / About | P5 | verified | cmp `github.test.tsx` ×3 · e2e `ios.spec.ts` ×2 | |
| `IOS-GH-03` | Enrichment + scrollable heatmap with accessible alternative | P5 | verified | cmp `github.test.tsx` ×5 | |
| `IOS-GH-04` | Search-on-pull field + stack filter chips | P5 | verified | cmp `github.test.tsx` ×5 | |
| `IOS-GH-05` | Pad split view | P5 | verified | e2e `ios-journeys.spec.ts` | |
| `IOS-GH-06` | Navigation semantics (nav + aria-current, radiogroup segments) | P5 | verified | cmp `github.test.tsx` ×4 · e2e `ios-journeys.spec.ts` | |

### `apps/mail.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `IOS-MAIL-01` | Mailboxes → Inbox → Message push flow with data-generated messages | P5 | verified | cmp `mail.test.tsx` | |
| `IOS-MAIL-02` | Compose sheet with draft persistence + Delete/Save action sheet | P5 | verified | cmp `mail.test.tsx` · e2e `ios.spec.ts` |see log |
| `IOS-MAIL-03` | Send = encoded `mailto:` + banner with copy fallback | P5 | verified | cmp `mail.test.tsx` | |
| `IOS-MAIL-04` | Attachment → Files Quick Look | P5 | verified | cmp `mail.test.tsx` | |
| `IOS-MAIL-05` | Keyboard-safe compose (`--vvh`, ≥ 16 px inputs); pad split view | P5 | verified | cmp `mail.test.tsx` | |
| `IOS-MAIL-06` | Form/dialog semantics; swipe alternative | P5 | verified | cmp `mail.test.tsx` | |

### `apps/messages.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `IOS-MSG-01` | Conversations list + thread with iMessage-style bubbles | P5 | verified | cmp `messages.test.tsx` ×5 | |
| `IOS-MSG-02` | Script graph generated from data; chips drive branches | P5 | verified | unit `messages-script.test.ts` ×8 · cmp `messages.test.tsx` ×2 |see log |
| `IOS-MSG-03` | Typing indicator skippable by any input; none under reduced motion | P5 | verified | unit `messages-script.test.ts` · cmp `messages.test.tsx` ×3 | |
| `IOS-MSG-04` | Hand-offs: mailto, copy, résumé Quick Look, external links | P5 | verified | unit `messages-script.test.ts` · cmp `messages.test.tsx` ×3 |see log |
| `IOS-MSG-05` | Transcript persists; log semantics with final-text announcements | P5 | verified | unit `messages-script.test.ts` · cmp `messages.test.tsx` ×3 | |

### `apps/notes.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `IOS-NOTES-01` | Folders → list → note flow; pinned notes | P5 | verified | cmp `notes.test.tsx` ×4 | |
| `IOS-NOTES-02` | Notes generated by formatters (skills meters, tables, tags) | P5 | verified | unit `notes-model.test.ts` · cmp `notes.test.tsx` ×4 | |
| `IOS-NOTES-03` | Read-only banner once; Find in note; tag filtering | P5 | verified | unit `notes-model.test.ts` · cmp `notes.test.tsx` ×6 | |
| `IOS-NOTES-04` | Pad/landscape split layouts; larger-text support | P5 | verified | cmp `notes.test.tsx` ×3 | |
| `IOS-NOTES-05` | Document semantics + plain skills alternative | P5 | verified | cmp `notes.test.tsx` ×4 | |

### `apps/safari.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `IOS-SAF-01` | Mobile Safari chrome: bottom address capsule + toolbar, collapse on scroll | P5 | verified | cmp `safari.test.tsx` ×2 | |
| `IOS-SAF-02` | Overview content reuses the shared component in mobile composition | P5 | verified | cmp `safari.test.tsx` | |
| `IOS-SAF-03` | Native scroll + IntersectionObserver reveals (no Lenis/ScrollTrigger) | P5 | verified | cmp `safari.test.tsx` ×2 · e2e `ios.spec.ts` | |
| `IOS-SAF-04` | Share, Bookmarks and Tabs sheets | P5 | verified | cmp `safari.test.tsx` ×4 |see log |
| `IOS-SAF-05` | Landscape top bar + pad toolbar/sidebar | P5 | verified | cmp `safari.test.tsx` ×2 | |
| `IOS-SAF-06` | Toolbar semantics; focus never hidden under the bar | P5 | verified | cmp `safari.test.tsx` ×2 | |

### `apps/settings.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `IOS-SET-01` | Inset-grouped Settings with profile cell, search-on-pull, pushed screens | P5 | verified | cmp `settings.test.tsx` ×4 |see log |
| `IOS-SET-02` | Accessibility/Display/Sounds controls apply instantly + persist; mirrored in Control Center | P5 | verified | cmp `settings.test.tsx` ×6 · e2e `ios.spec.ts` | |
| `IOS-SET-03` | Switch Operating System + Tour rows | P5 | verified | cmp `settings.test.tsx` ×2 | |
| `IOS-SET-04` | About: facts, eggs counter, Legal Notices; Privacy screen | P5 | verified | cmp `settings.test.tsx` ×3 | |
| `IOS-SET-05` | Pad split view; semantics | P5 | verified | cmp `settings.test.tsx` ×4 | |

### `03-motion.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `IOS-MOTION-01` | Spring + curve tables as tokens | P5 | verified | unit `motion.test.ts` | |
| `IOS-MOTION-02` | Velocity hand-off + projection on every gesture | P5 | verified | unit `model.test.ts` · e2e `ios.spec.ts` |see log |
| `IOS-MOTION-03` | Catch-and-retarget of in-flight animations | P5 | verified | unit `motion.test.ts` · e2e `ios.spec.ts` | |
| `IOS-MOTION-04` | Compositor-only properties | P5 | verified | perf `performance.spec.ts` | |
| `IOS-MOTION-05` | Reduced-motion variants | P5 | verified | e2e `ios.spec.ts` | |

### `04-responsive.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `IOS-RESP-01` | Phone full-bleed: real safe areas, no drawn notch, 24 px edge rule | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-RESP-02` | Phone landscape layout | P5 | verified | e2e `ios-journeys.spec.ts` | |
| `IOS-RESP-03` | Full-page layout on tablets: viewport-derived grid, widgets block, floating Dock with recents, split views, panels | P5 | verified | e2e `ios-journeys.spec.ts` |see log |
| `IOS-RESP-04` | **Full page on laptops/desktops — no device frame**: wallpaper, status bar, grid and Dock fill the viewport; icon size and columns from the viewport; apps open to the full page | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-RESP-05` | Pointer adaptations + visible non-gesture system controls (hover platter, click-drag swipe, wheel, right-click quick actions; Home indicator button, App Switcher in Control Center) | P5 | verified | e2e `ios-journeys.spec.ts` | |
| `IOS-RESP-06` | Layout swaps preserve foreground app + stack | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-RESP-07` | Keyboard-safe sheets and search | P5 | verified | e2e `ios-journeys.spec.ts` | |

### `05-accessibility.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `IOS-A11Y-01` | Landmark structure; inert rules with an app open | P5 | verified | cmp `shell.test.tsx` · e2e `ios.spec.ts` | |
| `IOS-A11Y-02` | iOS semantics map rows | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-A11Y-03` | Keyboard-only journey | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-A11Y-04` | Every gesture's alternative works | P5 | verified | e2e `ios-journeys.spec.ts` | |
| `IOS-A11Y-05` | Focus specifics incl. Esc = back one level | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-A11Y-06` | Screen-reader script recorded for release (VoiceOver iOS + macOS) | P8 | planned | | |

### `06-edge-cases.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `IOS-CASE-01` | E1–E8 (tap spam, retarget, rotation, folder/page returns, gesture projection) | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-CASE-02` | E9–E10, E14 (overlay/banner/sheet arbitration) | P5 | verified | unit `model.test.ts` | |
| `IOS-CASE-03` | E11–E13, E16–E17 (refresh, deep link, Back, switch/return) | P5 | verified | e2e `ios.spec.ts` ×2 | |
| `IOS-CASE-04` | E15, E18–E22 (LRU, failure, keyboard+rotate, layout swap, storage) | P5 | verified | e2e `ios-journeys.spec.ts` ×6 | |

### `07-cross-os-features.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `IOS-X-01` | Résumé fast path in all listed places | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-X-02` | Handoff banner + switcher card + lock variant | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-X-03` | Tour offer + iOS script (demonstrates return-to-icon) + restart points | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-X-04` | Eggs wired + found counter | P5 | verified | e2e `ios.spec.ts` | |
| `IOS-X-05` | Switch OS entry points + reverse fly-in exit beat | P5 | verified | e2e `ios.spec.ts` | |

**Total feature IDs: 138**

## Definition-of-done audit (run before flipping this OS to `released` — requirement R49)

**Visual language**
- [ ] Tokens only (no magic numbers); system font stack; icons resolve in both asset modes with identical boxes.
- [ ] Focus ring ≥ 3:1; glyphs never rely on colour alone; forced-colors legible.
- [ ] Grayscale smell test against every already-released OS passes.
- [ ] Storyboard test (north-star smell test 8): the reference state side by side with `ios-home.png` + `ios-github.png` in `plans/visual-targets/` — only real data and real-OS details differ (`01-identity.md` → Visual target).

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

**Journeys green:** I1 · I2 · I-keyboard · H1 · D1 · P1 · R1 · O1 · S1 · T1 · C1 · Q1 · X1–X5 on iOS (iphone, iphone-landscape, ipad ×2, chromium-desktop full page)
- [ ] **No device frame at any size** (north-star B17): on laptops/desktops the shell and every opened app fill the viewport.

**Plan conformance**
- [ ] Every row above is `verified` with evidence, or `BLOCKED` with owner sign-off.
- [ ] Every "Not like the others" clause in this folder is demonstrably true.
- [ ] Deviations below are complete and signed.

## Deviations log
| Date | ID | What changed vs the spec | Why | Owner sign-off |
|---|---|---|---|---|
| 2026-09-22 | IOS-ID-01 · IOS-ID-06 | Tint `#0068da` (light) instead of the storyboard frame's `#0a7aff` | `#0a7aff` on white is 4.0:1 — fails AA for text links and bar buttons; `#0068da` passes 4.5:1 and reads the same | Pending owner review at the P5 gate |
| 2026-09-22 | IOS-HOME-01 | Home order follows the storyboard frame: Safari, GitHub, Notes, Messages, Settings, Career folder (Dock: Files, Safari, GitHub, Mail) | The owner's storyboard is the visual target (memory: storyboard = exact match) | Pending owner review at the P5 gate |
| 2026-09-22 | IOS-WIDG-01 | The Résumé widget's Download action sits bottom-right, not in the header | Keeps the header to title + glyph as in the frame; one tap target per corner | Pending owner review at the P5 gate |
| 2026-09-22 | IOS-HOME-01 · IOS-RESP-03 | Icon labels clamp their size (`max(var(--u), 13px)`) on the full-page layout | Below 13 px the labels fail legibility at 1366 × 768 | Pending owner review at the P5 gate |
| 2026-09-22 | IOS-STAT-03 | Inside iOS, `--sa-b` is `max(env(safe-area-inset-bottom), 24px)` | The Home indicator needs a real hit zone on desktops (inset 0) that no app toolbar or pill may overlap (IOS-A11Y-02 target size) | Pending owner review at the P5 gate |
| 2026-09-22 | IOS-FILES-04 | Quick Look shows the résumé as HTML pages (from data), not page images | Same as VIEW-RESUME-01: selectable, accessible, never stale | Pending owner review at the P5 gate |
| 2026-09-22 | IOS-MAIL-02 | One saved draft per session (restored on reopen), not a drafts list | A static site with a `mailto:` hand-off has nothing to keep drafts for beyond the open compose | Pending owner review at the P5 gate |
| 2026-09-22 | IOS-FILES-01 | The location reads "On My iPhone" on phone and "On My iPad" on the full page | Matches the idiom the layout presents | Pending owner review at the P5 gate |
| 2026-09-22 | IOS-SET-01 | Appearance options are inline in Settings (no pushed screen) | Three choices fit one group; a push added a step with no content | Pending owner review at the P5 gate |
| 2026-09-22 | IOS-MSG-04 | "Email you" is a real `mailto:` link inside the suggested replies, not a chip button | A hand-off must be a genuine link (openable in a new context, visible URL) | Pending owner review at the P5 gate |
| 2026-09-22 | IOS-MSG-02 | "Start over" clears the thread and shows the greeting at once (no replayed typing) | Input always wins; replaying the typing delays information | Pending owner review at the P5 gate |
| 2026-09-22 | IOS-SAF-04 | Safari's AA button opens a page menu (Copy Link · Show Plain Version · Hide Toolbar); Download Résumé is hidden when no PDF is built | Keeps every action discoverable from one control; never offer a broken download | Pending owner review at the P5 gate |
| 2026-09-22 | IOS-FLIGHT-03 · IOS-MOTION-02 | Release velocity and the pause are read from pointer-event timestamps over the last 50 ms, not from rendered frames | A starved frame clock (busy device, headless WebKit) turned slow drags into flicks and moving fingers into long presses | Pending owner review at the P5 gate |
