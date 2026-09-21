# macOS / apps — Safari

## Role + requirement refs
The portfolio **overview**: a long-form, beautifully typeset "About Jaswanth" page rendered inside a believable
browser. R22, R23, R24. `AppRole: browser` · slug `safari` · owns `about`.

This is the **only** surface in the whole product where Lenis + ScrollTrigger run (`MOTION-SCROLL-01`).

## Portfolio mapping
`AboutOverview` (person summary, current role, featured projects, skills snapshot, contact CTA) +
links that open other apps (GitHub, Finder, Mail) via `KernelLink` — they behave like links that launch apps, not
web navigation.

## Anatomy
Window 1080 × 680 default (min 640 × 420). Unified toolbar 52 px: sidebar toggle · back/forward · **address bar**
(centred pill showing `jaswanth.dev/about` — display only; focusing it selects the text and offers Copy Link) ·
share button (Copy Link / Open plain version) · tab overview (decorative). **Tab bar** with three tabs:
"About" (default) · "Now" (current role + what I'm looking for, from `person.openTo`) · "Plain version" (loads
`/plain` content views inline). Favourites bar: GitHub · Résumé · Mail (open apps).
Page body: hero sentence, three narrative sections, featured-project strip, skills snapshot, contact CTA.

## Behaviour & states
| State | Behaviour |
|---|---|
| Load | A thin progress line under the toolbar runs to 100 % while the Overview chunk loads (real milestone-based) |
| Scroll | Nested scroller with Lenis (fine pointer, tier ≥ 1); ScrollTrigger reveals: section headings pin briefly, featured-project strip scrubs horizontally, numbers count up once. All effects are enhancement — content is fully visible without them |
| Tabs | Click switches tab (session state, no history); tab titles from content |
| Links to apps | Open the target app window (normal WM rules) |
| Back/Forward buttons | Operate on the in-app nav stack (About → anchors do not push; tab changes do not push) |
| Reduced motion / coarse / tier 0 | Native scroll, no Lenis, no scrub; reveals become instant |

## Navigation & routes
`/macos/safari` only (owns one section → no section segment). Anchors inside the page are not routed.

## Menu-bar menus
File: New Tab (cycles) · Close Tab. View: Reload (re-runs reveals) · Show Favourites Bar. History: About · Now.
Bookmarks: GitHub · Résumé · Mail.

## Motion
Progress line: `scaleX`. Scroll effects: transform/opacity only, `scroller` = the window's content element. Lenis
`autoRaf: false` on the shared ticker; destroyed on window close/minimize (`<Activity>` hidden).

## Responsive
`medium`: favourites bar hides; tabs remain. `compact`: toolbar collapses to address pill + share; tab bar becomes a
bottom segmented control; native scroll only.

## Accessibility
Content is a normal article (`h3` downwards inside the window). Address pill is a read-only `input` labelled
"Address". Tabs use the APG tabs pattern (`role="tablist"`). Scroll effects never hide content from AT (no
`visibility` toggles); pinned sections never trap keyboard scroll.

## Edge cases
Window resized → ScrollTrigger `refresh()` on the debounced resize commit. Minimized → Lenis paused/destroyed.
Overview chunk fails → the SSR-equivalent `AboutOverview` renders without effects.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `MAC-SAF-01` | Browser chrome: toolbar, address pill, tabs, favourites | `e2e: M2 window renders; favourites open apps` | P3 |
| `MAC-SAF-02` | Overview content from `AboutOverview` | `cmp: renders from fixture; headings ordered` | P3 |
| `MAC-SAF-03` | Lenis + ScrollTrigger scoped to this scroller, gated by pointer/tier/motion | `perf: libraries load only on Safari/Edge open; absent under reduced motion` | P3 |
| `MAC-SAF-04` | Effects are enhancement only | `e2e: R1 all content visible with effects off` | P3 |
| `MAC-SAF-05` | Tabs (APG) incl. inline plain version | `cmp: tabs keyboard model` | P3 |
| `MAC-SAF-06` | Lifecycle cleanup (destroy on close/minimize) | `e2e: leak loop stable after 20 open/close` | P3 |
| `MAC-SAF-07` | Compact layout with bottom segmented control | `e2e: M3` | P3 |

## Not like the others
Unified toolbar with a centred address pill and a favourites bar (Edge: tabs **above** the address bar, a vertical
sidebar strip, PDF viewer built in; mobile Safari: bottom address bar; Chrome on Android: top omnibox with a
three-dot menu).
