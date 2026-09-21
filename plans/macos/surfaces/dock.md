# macOS / surfaces — Dock

## Role + requirement refs
The launcher, the app switcher and the home of minimized windows — with magnification, running indicators, launch
bounce and labels. R16, R17, R25.

## Portfolio mapping
Pinned apps (from the OS registry, `pinned: true`) in the order given in `README.md`; right of the separator: the
**Résumé stack** (`RES-IDIOM-01`), minimized windows, Trash (decorative). Left end: the Handoff slot, present only
while a continuity offer exists (`shared/16`).

## Anatomy
Floating pill, 8 px above the bottom edge (plus `--sa-b`), `--material-thin` vibrancy, radius 20 px, 1 px inner
hairline. Icons 48 px base (64 px on `large`), 4 px gaps, 6 px padding. Separator: 1 px vertical line.
Running dot: 4 px circle under the icon. Label: tooltip pill above the icon (12 px text, `--material-thick`).
Background is a **three-slice pill** (two caps + `scaleX` centre) so magnification never relayouts it.

## Behaviour & states
| Interaction | Behaviour |
|---|---|
| Hover (fine pointer) | **Magnification**: `scale = 1 + 0.6·cos²(πd / 2R)`, R = 3 icon pitches, `transform-origin: bottom`; neighbours part via cumulative `translateX`; entry/exit of the whole effect smoothed by spring r 0.18 ζ 1; pointer x tracked raw. Label appears for the hovered icon. |
| Keyboard focus | Focused icon scales to 1.25 and shows its label (no neighbours effect) |
| Click | Semantics from `MAC-WM-08` (open / restore / focus / no-op) |
| Launch while chunk loads | Icon **bounces** (520 ms per bounce, 18 px) until the window's first frame; never bounces if the app is cached |
| Running | Dot appears when an instance exists; removed on Quit |
| Minimized tile | Generic window tile with the app's badge; click restores |
| Résumé stack | Click → small fan/popover: Open in Preview · Download PDF |
| Right-click / long-press | Dock context menu: Open · Show All Windows · Hide · Quit (running) · Options ▸ Keep in Dock (decorative, disabled) |
| Coarse pointer | No magnification; icons 48 px with 44 px+ targets; horizontal scroll if it overflows |

All magnification writes are per-icon `transform` on the ticker — **zero React state, no width changes**.

## Navigation & routes
Icons are links to `/macos/{slug}`; click is intercepted by `KernelLink` → kernel action → history per `shared/05`.

## Motion
Bounce: GSAP `y` yoyo, `power2.out`/`in`. Magnification: spring-smoothed envelope. Minimize target = the tile's
re-measured rect. Reduced motion: no magnification, no bounce (a static pulsing dot indicates loading).

## Responsive
`compact` portrait: Dock stays at the bottom, 48 px icons, scrolls horizontally, no magnification, labels hidden
(names via accessible name). `compact` landscape: Dock becomes a **left rail** (arrow keys switch to Up/Down).
`medium`/touch: no magnification. Windows never sit under the Dock (workspace inset).

## Accessibility
`nav[aria-label="Dock"] > ul > li > a`. Name = app name + visually hidden ", open" / ", minimized". Active app
`aria-current="true"`. Roving tabindex Left/Right (Up/Down as a rail), Home/End. Alt+Shift+D focuses the Dock.
Context menu via the `contextmenu` event + a visible "⋯" on the focused item. Trash is labelled "Trash (decorative)"
and removed from the tab order.

## Edge cases
Pointer leaves mid-magnification → envelope springs to 0 (no snap). Rapid clicks on a loading icon → single
open (`KRN-WIN-01`). Minimized tile target removed mid-flight (app quit) → window fades instead. Dock wider than the
viewport → scrolls; magnification disabled while overflowing.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `MAC-DOCK-01` | Dock pill with pinned apps as links, running dots | `e2e: M2 dots reflect running apps; W2 links work without JS` | P2 |
| `MAC-DOCK-02` | Magnification (formula, transform-only, spring envelope) | `perf: no Layout/React render during pointermove; visual snapshot at peak` | P3 |
| `MAC-DOCK-03` | Launch bounce only while loading | `e2e: throttled chunk bounces; cached does not` | P3 |
| `MAC-DOCK-04` | Minimized tiles + restore | `e2e: M1 minimize creates tile; click restores` | P2 |
| `MAC-DOCK-05` | Labels on hover and on focus-visible | `e2e: M1 label visible for focused icon` | P3 |
| `MAC-DOCK-06` | Dock context menu | `e2e: M2 Quit removes the dot` | P3 |
| `MAC-DOCK-07` | Résumé stack (Open / Download) | `e2e: Q1 from the Dock` | P3 |
| `MAC-DOCK-08` | Handoff slot for continuity offers | `e2e: C1 offer appears at the left end` | P4 |
| `MAC-DOCK-09` | Roving keyboard model, names with state suffix | `cmp: roving + accessible names` | P2 |
| `MAC-DOCK-10` | Compact bottom scroll + landscape left rail | `e2e: M3 both orientations` | P3 |

## Not like the others
A floating, **magnifying** pill centred at the bottom with dots under icons (Windows: a full-width taskbar with
pill indicators that widen for the active app, no magnification; iOS Dock: four fixed icons on a blurred plate, no
running state; Android: a favorites row that is part of the launcher).
