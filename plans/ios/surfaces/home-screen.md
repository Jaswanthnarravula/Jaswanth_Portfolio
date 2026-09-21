# iOS / surfaces — Home Screen

## Role + requirement refs
The app grid with wallpaper depth, pages, badges and the Search pill. R14, R25.

## Portfolio mapping
Icon set and page layout from `README.md` (apps from the registry; folder and widget placements are configuration,
not hard-coded JSX). **Badges** carry real information: Mail "1" (the "Let's talk" message, cleared once opened in
the session) · GitHub = number of featured projects (static).

## Anatomy
- Grid: **4 columns × 6 rows** (phone), 60 pt icons, 27 pt column gap, labels 12 pt (1 line, truncating), top inset =
  status bar + 12 pt; bottom reserved for the Dock.
- **Pages:** horizontal CSS scroll-snap container (`scroll-snap-type: x mandatory`), one page per viewport width.
- **Search pill / page dots:** above the Dock — a capsule "🔍 Search" that morphs into page dots while scrolling
  (as iOS 16+); tap → Spotlight.
- **Badge:** red 20 pt circle top-right of the icon, white 13 pt number.
- Wallpaper layer per `01-identity.md`.

## Behaviour & states
| Interaction | Behaviour |
|---|---|
| Tap icon | Dim 80 ms → flight open (`IOS-FLIGHT-01`) |
| Long-press icon (500 ms) | Quick actions menu (`quick-actions.md`); the icon lifts (scale 1.08) and the rest blurs/dims |
| Swipe left/right | Native scroll-snap paging (no JS physics); dots update via `IntersectionObserver` |
| Pull down on the grid | Opens Spotlight (threshold 60 pt, interactive); alternative: the Search pill, Ctrl/Cmd+K |
| Long-press empty area (2 s) | `EGG-SHAKE-01` banner — **no jiggle mode** (rearranging is deliberately not built) |
| Tap folder | Folder opens (`folders.md`) |
| Tap widget | Opens its app/section (`widgets.md`) |

## Navigation & routes
`/ios`. Paging is session state (page index restored on return). Icons are links (`/ios/{slug}`) via `KernelLink`.

## Motion
Paging: native. Arrival fly-in after unlock/boot. When an app opens: Home scales 0.92 + dims (part of the flight);
returns with the close spring. Off-screen pages use `content-visibility: auto`.

## Responsive
Phone landscape: grid becomes 6 × 3 with the Dock on the trailing edge. **Full page (tablets, laptops, desktops — no
device frame):** the Home Screen fills the whole viewport in the iPadOS layout — widgets block on the leading side,
6 / 7 / 8 columns by size class, icon size `clamp(64px, 8.4vh, 96px)`, grid centred with a max width, floating Dock
with recents (`04-responsive.md`). With a mouse: hover lifts icons on a soft platter; paging by click-drag, arrow keys,
dot buttons or trackpad horizontal scroll.

## Accessibility
Each page is a `ul` of links inside one roving group spanning pages: arrows move in 2-D by measured columns;
Right at the last column crosses to the next page (pager scrolls, focus follows); Home/End; type-ahead. Page dots are
real buttons ("Page 1 of 2", `aria-current`). Badges are part of the accessible name ("Mail, 1 unread"). The Search
pill is a button "Search". Home is `inert` while an app is open.

## Edge cases
Rotation → grid reflows; page index preserved by icon, not by number (the page containing the focused/last-opened
icon stays in view). Reduced motion → no fly-in, no parallax. Very small frame height → rows reduce to 5 and the
overflow moves to page 2 deterministically.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `IOS-HOME-01` | Configured grid (apps, folder, widget) as links with labels | `e2e: W2 links without JS; layout matches config` | P5 |
| `IOS-HOME-02` | Pages via CSS scroll-snap + dot buttons + Search-pill/dots morph | `e2e: swipe + dot click page; no JS physics` | P5 |
| `IOS-HOME-03` | Data-driven badges in names and visuals | `cmp: Mail badge clears after open (session)` | P5 |
| `IOS-HOME-04` | Pull-down to Spotlight with non-gesture alternatives | `e2e: I2 pill and Ctrl+K open Spotlight` | P5 |
| `IOS-HOME-05` | Roving 2-D navigation across pages | `cmp: arrow across page boundary scrolls + focuses` | P5 |
| `IOS-HOME-06` | Phone landscape + full-page layouts (tablet, laptop, desktop — no frame) | `e2e: iphone-landscape, ipad, chromium-desktop projects; home grid spans the viewport` | P5 |
| `IOS-HOME-07` | Deterministic reflow + page memory by icon | `e2e: O1 on iOS` | P5 |

## Not like the others
**Every app lives on the Home Screen** in a fixed grid with paging and a Search pill (Android: a smaller home with an
**app drawer** you swipe up, At-a-glance on top and a search bar at the bottom; desktops have a desktop of files, not
a grid of apps).
