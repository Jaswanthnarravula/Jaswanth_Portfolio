# iOS / 02 — App lifecycle (icon ↔ app flight, Home, switcher, navigation, sheets)

## Role + requirement refs
Apps must behave like applications: tapping an icon **expands it naturally into its content surface**, in-app
navigation follows mobile principles, and closing **visually returns the app to its originating icon**. Requirements:
R14, R15, R37. Primitives: `flight()` and `spring()` (`shared/07`). Kernel: `WindowPolicy.mode = 'fullscreen'`,
singleton app instances (`shared/04`).

## Model
- One **AppSurface** layer (fixed, full screen or full frame) hosts the foreground app.
- Kernel phases: `opening → normal → closing` (no minimize/maximize). "Backgrounded" = instance exists, not focused.
- **Warm apps:** the 3 most recent backgrounded apps stay mounted under `<Activity mode="hidden">` +
  `content-visibility: hidden` (state, scroll and nav stack intact); older ones unmount and restore from their
  `WindowInstance` (nav stack + scrollTop).

## Open — the flight (`IOS-FLIGHT-01`)
1. `pointerup` on an icon → **synchronously** start the flight with a launch placeholder (app's launch colour +
   centred glyph) — feedback never waits for the app chunk.
2. Geometry: AppSurface gets `translate + uniform scale` from the **icon's measured rect** to the **full page** (the
   whole viewport, at every size — no device frame), plus `clip-path: inset(... round r)` interpolating the corner
   radius from the squircle (22.37 %) to 0. Icon → content crossfade over progress 0.15–0.5. The grid icon itself is
   `visibility: hidden` during the flight.
3. Spring **r 0.42 ζ 0.86**. Home Screen simultaneously scales to 0.92 and dims; wallpaper 1.06 → 1.12.
4. The real app mounts at progress > 0.9 or at rest (warm apps are already mounted → instant).
5. Focus: app heading → then Home Screen becomes `inert` → then the animation proceeds (`shared/09`).
6. History: **push** `/ios/{slug}…` (mobile rule — Back returns Home).

## Close — back into the icon (`IOS-FLIGHT-02`)
Triggers: Home indicator tap · swipe-up gesture · Esc · Alt+Shift+H · browser Back at the app's root.
1. Pager jumps (no animation) to the page that contains the **originating icon** (or its folder).
2. Re-measure the icon **now** (grid may have reflowed/rotated) → reverse flight with spring **r 0.50 ζ 0.80**.
3. If the icon is inside a closed folder → target the **folder icon**; if it no longer exists → centre scale 0.85 + fade.
4. `inert` removed from Home, focus → the icon, then animate. App moves to the warm set.

## Interactive Home gesture (`IOS-FLIGHT-03`)
Dragging up from the home-indicator zone (bottom 34 pt) drives flight progress **1:1** with the finger (the surface
shrinks and follows x/y). Release: projected end = `position + velocity × 0.499`; if it passes 35 % of the way → Home
(spring inherits velocity), else springs back open. **Swipe up and pause (≥ 250 ms, velocity < 50 pt/s)** → App
Switcher. Non-gesture alternatives: tap the pill (Home), long-press / Alt+Shift+O (Switcher).

## App Switcher (`IOS-FLIGHT-04`)
Horizontal stack of app cards (live surfaces scaled 0.72 with 38 px radius, app icon + name above each), scroll-snap,
most recent rightmost. Tap a card → that app opens (flight from the card rect). **Swipe a card up → the app is closed**
(instance removed); visible ✕ button on each card is the alternative. Tap outside → Home.

## In-app navigation
- **Push/pop stack** (`NavStack`): push slides the new view in from the right (350 ms `0.32, 0.72, 0, 1`), the
  underlay parallaxes −30 % and dims; large title collapses into the nav bar on scroll.
- Back: nav-bar chevron with the **previous title as its label** · **edge-swipe from the left** (interactive, 1:1,
  velocity-projected; on touch screens it starts ≥ 24 px from the physical edge to leave the browser's own Back gesture
  alone; with a mouse it is a click-drag from the page's left edge) · browser Back.
- **Tab bars** switch roots without pushing history (session state).
- **Sheets:** modal cards rising from the bottom with detents (medium ≈ 50 %, large); background scales 0.94 and
  dims; drag the grabber to dismiss (velocity-projected); visible Cancel/Done buttons always present.

## Routes
`/ios` (Home) · `/ios/{slug}` · `/ios/{slug}/{…}` per app file. App open, push and sheet-less navigations `go()`;
tabs, sheets, switcher and scroll write nothing.

## Edge cases
Tap a second icon mid-flight → first flight retargets closed, second opens (springs preserve velocity). Rotate
mid-flight → retarget to the new rects. Icon on another page → pager jump first. Rapid Home taps → idempotent.
Chunk failure → placeholder shows "Couldn't open {App}" + Retry + Home.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `IOS-FLIGHT-01` | Icon → app flight (transform + clip-path radius, sync placeholder, deferred mount) | `e2e: I1 first frame within one task of pointerup; perf: no Layout in flight` | P5 |
| `IOS-FLIGHT-02` | App → **originating** icon with re-measure, folder/page/absent fallbacks | `e2e: I1 + O1 return lands on the icon's current rect after rotation` | P5 |
| `IOS-FLIGHT-03` | Interactive Home gesture: 1:1 drag, velocity projection, pause → switcher | `e2e: pointer-scripted drags for home / cancel / switcher` | P5 |
| `IOS-FLIGHT-04` | App Switcher: card stack, open, swipe-up or ✕ to close | `e2e: close an app from the switcher; instance removed` | P5 |
| `IOS-FLIGHT-05` | Warm LRU(3) apps keep state; older restore from NavStack + scroll | `e2e: reopen 4th-oldest app restores its screen and scroll` | P5 |
| `IOS-FLIGHT-06` | Push/pop stack, large-title collapse, interactive edge-swipe back | `e2e: swipe-back cancel and commit; chevron label = previous title` | P5 |
| `IOS-FLIGHT-07` | Sheets with detents, grabber drag, always-visible Cancel/Done | `e2e: drag dismiss + button dismiss` | P5 |
| `IOS-FLIGHT-08` | History: open/push `go()`; Back pops then goes Home | `e2e: H1 on iOS` | P5 |
| `IOS-FLIGHT-09` | Focus choreography (heading → inert → animate; icon on return) | `e2e: I1 focus lands on the icon` | P5 |

## Not like the others
The app **grows out of and returns into its own icon** with velocity-aware springs, and Home is a **gesture from the
bottom edge** (Android: Material **container transform** with emphasized easing, and leaving is **system Back** at
every level; desktops: windows open from launchers but never return into them — they close or minimize).
