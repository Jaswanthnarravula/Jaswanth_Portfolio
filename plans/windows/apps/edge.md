# Windows 11 / apps — Microsoft Edge

## Role + requirement refs
The portfolio **overview** *and* the **résumé viewer** — because on Windows, PDFs open in Edge. R22, R23, R24, N5.
`AppRole: browser` · slug `edge` · owns `about` and `resume`.

## Portfolio mapping
Tab "About Jaswanth" → `AboutOverview` (the same long-form Overview component as macOS Safari — one component, two
skins). Tab "Résumé.pdf" → `ResumeView` inside Edge's PDF toolbar.

## Anatomy
Window 1100 × 700 (min 640 × 420). **Tabs live in the title bar** (Mica): "About Jaswanth" · "Résumé.pdf" · "+"
(opens the third preset tab "Plain version"; then disabled). Below: toolbar — back / forward / refresh · **address
bar** (rounded, shows `https://jaswanth.dev/about` or `file:///C:/Users/Jaswanth/Résumé.pdf`; display-only, focus
selects + offers Copy link) · favourites star (decorative) · ⋯ menu (Print · Copy link · Open plain version).
Right edge: a slim **sidebar strip** (3 glyph buttons: GitHub · Outlook · Search → open those apps).
**PDF toolbar** (résumé tab only): page `1 / N` · zoom − / + / fit · rotate (disabled) · **Save** (download) · Print.

## Behaviour & states
| State | Behaviour |
|---|---|
| Tab switch | `/windows/edge` ↔ `/windows/edge/resume` via `go()` (this app owns two sections, so tabs **are** routed) |
| Overview scroll | Nested scroller with Lenis + ScrollTrigger under the same gates as Safari (`MOTION-SCROLL-01`): fine pointer, tier ≥ 1, motion full |
| Loading | Thin accent progress line under the toolbar; tab shows a small spinner until ready |
| PDF | The PDF's page images (shared/03 `VIEW-RESUME-01`; an Open link if they are missing); **Save** → download + toast "Résumé.pdf — Download complete" |
| Refresh | Re-runs reveal effects (About) / reloads the PDF view |
| Links to apps | Open the target app window |

## Navigation & routes
`/windows/edge` (about) · `/windows/edge/resume`. Anchors inside the page are not routed.

## Motion
Tab switch: content crossfade 167 ms; tab indicator slides 167 ms. Overview effects identical in content to Safari's,
with Windows easing tokens.

## Responsive
`medium`: sidebar strip hides. `compact`: tabs become a horizontal scroll row under a compact title; PDF toolbar
collapses to Save · ⋯; native scroll only.

## Accessibility
Tabs = APG `tablist` in the title bar (arrow keys; the title bar remains draggable outside the tabs). Address field
is a read-only labelled input. PDF view puts the **text version first in DOM** (same rule as macOS Preview). Sidebar
strip is a `toolbar`.

## Edge cases
Deep link to `/windows/edge/resume` with no PDF (placeholder phase) → text version only, Save hidden. Minimized →
Lenis destroyed. Print → print stylesheet hides OS chrome.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `WIN-EDGE-01` | Browser chrome with tabs in the title bar, address bar, sidebar strip | `e2e: N2 window renders; strip opens apps` | P4 |
| `WIN-EDGE-02` | Overview tab reuses the shared Overview component | `static: same component as macOS Safari; cmp renders from fixture` | P4 |
| `WIN-EDGE-03` | Routed tabs: about ↔ résumé | `e2e: D1 /windows/edge/resume opens the PDF tab; Back returns to About` | P4 |
| `WIN-EDGE-04` | PDF toolbar: page, zoom, Save (download + toast), Print; text version first | `e2e: RES-DL-01 on Windows; X1 axe clean` | P4 |
| `WIN-EDGE-05` | Lenis/ScrollTrigger gating + cleanup | `perf: libraries absent under reduced motion; leak loop stable` | P4 |
| `WIN-EDGE-06` | Compact layout | `e2e: N3` | P4 |

## Not like the others
**Tabs in the title bar, a right sidebar strip, and a built-in PDF viewer that owns the résumé** (macOS: Safari for the
overview + a separate Preview app for the résumé; iOS Safari has a bottom address bar; Android Chrome a top omnibox
with a three-dot menu).
