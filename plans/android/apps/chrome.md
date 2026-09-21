# Android / apps — Chrome

## Role + requirement refs
The portfolio **overview** in Chrome for Android. R22, R23, R24. `AppRole: browser` · slug `chrome` · owns `about`.

## Portfolio mapping
`AboutOverview` — the shared Overview content in the mobile composition (same as iOS Safari's content, Material skin).

## Anatomy
Edge-to-edge app. **Top toolbar** (56 dp, `surface`): home glyph (hidden) · **omnibox** pill (`surface-container`,
lock glyph + `jaswanth.dev`, read-only; tap selects + offers "Copy link") · **tab switcher square with count "2"** ·
**⋮ menu**. The toolbar **hides on scroll down / shows on scroll up** (transform-only). Thin `primary` progress bar
under the toolbar while loading.
- **⋮ menu** (M3 menu from the top-right): New tab (cycles) · Bookmarks ▸ (GitHub · Résumé · Gmail → open apps) ·
  Share… (bottom sheet: Copy link · Plain version · Download résumé) · Find in page · Desktop site (decorative
  checkbox, tooltip "This *is* the mobile site of a desktop OS of a website.").
- **Tab switcher:** grid of two tab cards ("About" · "Plain version"), M3 cards with a ✕; "+" FAB-less header button.

## Behaviour & states
| State | Behaviour |
|---|---|
| Scroll | Native scroll; reveals via `IntersectionObserver` (fade-through, 300 ms) — **no Lenis / ScrollTrigger** |
| Toolbar | Hides/shows with 16 dp hysteresis |
| **Back** | Closes menu/sheet → tab switcher → leaves Chrome (no in-page history since anchors don't push) |
| Find in page | Inline bar replaces the toolbar; highlights; ↑ ↓ cycle; Back closes it |
| Links to apps | Open the target app (container transform from the link's chip when it is a chip; otherwise standard open) |
| Pull-to-refresh | Not a custom gesture (conflicts with the browser's); ⋮ → Refresh re-runs reveals |

## Navigation & routes
`/android/chrome` only. Tabs, menus, sheets = session/transient.

## Motion
Toolbar 200 ms standard. Menu: scale from the top-right 150 ms. Bottom sheet 300 ms emphasized-decelerate. Tab
switcher: page → card container transform.

## Responsive
Phone landscape: toolbar stays on top. **Pad:** tab **strip** across the top (desktop-like) + toolbar beneath;
bookmarks in a side panel. Laptops/desktops: same as pad, filling the whole page (content column max 760 px, centred).

## Accessibility
Article semantics for content. Toolbar = `toolbar`; omnibox = read-only labelled field; tab count button named
"2 open tabs"; ⋮ = `Menu`; bottom sheet = modal `dialog`. Hidden toolbar reappears on keyboard focus moving upward;
`scroll-padding-top` prevents focused content hiding under it.

## Edge cases
Short content → toolbar never hides. Backgrounded → scroll kept (warm) or restored. Clipboard blocked → dialog with
the URL selected.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `AND-CHROME-01` | Chrome chrome: top omnibox toolbar that hides on scroll, tab count, ⋮ menu | `e2e: toolbar hide/show transform-only` | P6 |
| `AND-CHROME-02` | Shared Overview content in Material composition; native scroll only | `static: shared component; perf: no Lenis/ScrollTrigger on /android/*` | P6 |
| `AND-CHROME-03` | ⋮ menu, Share bottom sheet, Bookmarks open apps, Find in page | `e2e: each action; Back closes each layer` | P6 |
| `AND-CHROME-04` | Tab switcher grid | `e2e: switch to Plain version and back` | P6 |
| `AND-CHROME-05` | Pad tab strip layout; semantics | `e2e: tablet; X1 axe clean` | P6 |

## Not like the others
**Top omnibox + ⋮ overflow menu + numbered tab square; Back unwinds layers** (iOS Safari: bottom floating address bar,
share sheet, toolbar buttons; desktop browsers: windows with tab bars and Lenis-enhanced scrolling).
