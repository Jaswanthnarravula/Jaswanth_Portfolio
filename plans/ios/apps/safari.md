# iOS / apps — Safari

## Role + requirement refs
The portfolio **overview** in mobile Safari. R22, R23, R24. `AppRole: browser` · slug `safari` · owns `about`.

## Portfolio mapping
`AboutOverview` — the same shared Overview content as the desktop browsers, in a **mobile composition** (single
column, large type). Links to other apps open them with the app flight.

## Anatomy
Full-screen app. Content scrolls under the status bar. **Bottom address bar** (iOS 15+ style): floating capsule
showing `jaswanth.dev` with a reader/"AA" glyph left and refresh right, above a **toolbar**: back · forward · share ·
bookmarks · tabs. On scroll down the toolbar collapses to a slim capsule (address only); scroll up or tap restores it.
- **Share sheet** (sheet, medium detent): Copy Link · Open Plain Version · Download Résumé.
- **Bookmarks sheet:** GitHub · Résumé · Mail · Messages (open apps).
- **Tab overview:** grid of 2 tab cards ("About" · "Plain version") — decorative but functional.

## Behaviour & states
| State | Behaviour |
|---|---|
| Scroll | **Native momentum scroll.** No Lenis, no ScrollTrigger (touch/native is better — `MOTION-SCROLL-01`). Section reveals via `IntersectionObserver` adding a class once (fade + 12 pt rise, 300 ms); reduced motion → none |
| Bar collapse | Driven by scroll direction with a 12 pt hysteresis; `transform` only |
| Loading | Thin progress bar at the top of the address capsule |
| Pull to refresh | Not implemented as a gesture (conflicts with the browser's own); the refresh button re-runs reveals |
| Swipe on the address bar | Switches between the two tabs (alternative: tab overview) |

## Navigation & routes
`/ios/safari` only. Tabs/sheets are session state. Back chevron in the toolbar pops the in-app stack (anchors don't push).

## Motion
Bar collapse/expand 250 ms `0.32, 0.72, 0, 1`. Sheets per `IOS-FLIGHT-07`. Tab overview: page scales into a card
(spring r 0.42 ζ 0.86).

## Responsive
Phone landscape: bar moves to the **top** (compact toolbar). Pad: top toolbar with a centred address field, sidebar
button (bookmarks as a sidebar). Laptops/desktops: same as pad, filling the whole page (content column max 760 px,
centred).

## Accessibility
Content = article with `h3`-rooted headings. Toolbar = `toolbar` with named buttons; address capsule = read-only
labelled field with a "Copy link" action; sheets = modal dialogs with Done. The bar never covers focused content
(scroll-padding-bottom = bar height + safe area).

## Edge cases
Keyboard never appears (read-only field). Short content → bar stays expanded. App backgrounded → scroll position
kept (warm) or restored from `scrollTop`.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `IOS-SAF-01` | Mobile Safari chrome: bottom address capsule + toolbar, collapse on scroll | `e2e: bar collapses/expands; transform-only` | P5 |
| `IOS-SAF-02` | Overview content reuses the shared component in mobile composition | `static: shared component; cmp renders from fixture` | P5 |
| `IOS-SAF-03` | Native scroll + IntersectionObserver reveals (no Lenis/ScrollTrigger) | `perf: neither library requested on /ios/*` | P5 |
| `IOS-SAF-04` | Share, Bookmarks and Tabs sheets | `e2e: copy link; bookmarks open apps` | P5 |
| `IOS-SAF-05` | Landscape top bar + pad toolbar/sidebar | `e2e: iphone-landscape + ipad` | P5 |
| `IOS-SAF-06` | Toolbar semantics; focus never hidden under the bar | `e2e: X1 axe clean; focus-visible check while tabbing` | P5 |

## Not like the others
**Bottom floating address bar that collapses, share sheet, native momentum scroll** (desktop Safari/Edge: top toolbar
with Lenis-enhanced scroll; Android Chrome: top omnibox, three-dot menu, tab counter).
