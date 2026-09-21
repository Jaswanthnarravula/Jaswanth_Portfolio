# macOS / 02 — Window manager

## Role + requirement refs
Realistic dragging, focusing, layering, minimizing, zooming/restoring, closing, Dock coupling and active-app
indication — with accessibility and performance intact. Requirements: R17, R37, R46. State machine and geometry
rules: `shared/04-os-kernel.md` (this file is the macOS skin + behaviour on top of it). North-star B1.

## Anatomy of a window
```
┌─●●●──────────── Title ────────────────────────┐  title bar 52 px (toolbar style) or 28 px (plain)
│ sidebar (vibrancy) │ content                   │  drag region = title bar minus controls
│                    │                           │  8 resize zones: 4 edges (6 px) + 4 corners (12 px)
└────────────────────┴───────────────────────────┘  min size from WindowPolicy.minPx
```
`<section aria-labelledby tabindex="-1">` + `h2` title; controls in a `group` "Window controls"; a window-menu
button (⋯, visible on focus/coarse pointers) offers Move, Size, Zoom, Minimize, Center, Close.

## Behaviour & states

| Action | Behaviour |
|---|---|
| **Open** | From the Dock icon's rect (or desktop item): scale 0.92 → 1 + fade, 200 ms. Default rect from `WindowPolicy.defaultRect[sizeClass]`, cascaded +24 px from the previous window; `learnedRects` wins if present. Dock icon bounces only while the app chunk is still loading. |
| **Focus** | Any pointerdown inside (capture phase) → `FOCUS_WINDOW` → moves to the end of `zOrder`; menu bar swaps to that app; previous window turns inactive. Clicking a control in an inactive window focuses **and** acts (no click-through swallow). |
| **Drag** | Title-bar drag via `drag()` primitive: pointer capture, `translate3d` on the ticker, content `pointer-events: none` while dragging; commit `COMMIT_RECT` on release. Clamp: title bar can't go above the menu bar; ≥ 48 px of title bar must remain reachable on every side. No snapping. |
| **Resize** | 8 zones; real size writes inside `contain: strict`, rAF-throttled; respects `minPx`; T0 resizes a ghost outline and commits on release. Cursors per zone. |
| **Minimize** (yellow / ⌘M equivalent Alt+Shift+M) | **Scale effect** into the app's slot on the right side of the Dock (380 ms); window gets `<Activity mode="hidden">`; a thumbnail-less generic tile with the app badge appears in the Dock. Shift-click plays at ×6 slower (authentic). |
| **Restore** | Click the Dock tile or the app icon → reverse (340 ms) → focus the window. Clicking mid-flight reverses the running timeline. |
| **Zoom** (green) | Toggles maximized: fills the workspace below the menu bar and above the Dock. Layout applied once, revealed by `translate` + `clip-path: inset()` (420 ms, no text distortion). Double-click on the title bar also zooms. |
| **Close** (red) | Scale 1 → 0.96 + fade (140 ms) → removed. The **app stays "running"**: Dock dot remains until Quit (menu bar → App → Quit, or Dock context menu). |
| **Quit** | Closes the window and removes the Dock dot. |
| **Hide others / Show all** | Menu-bar items; minimize-all equivalent without animation storm (staggered 30 ms). |

## Dock coupling
Running indicator dot under the icon for any app with a window instance (any phase except closed+quit). Minimized
windows appear as tiles right of the separator. Clicking a running app's icon: no window → open; minimized →
restore; behind → focus; already focused → no-op (not minimize — that's Windows behaviour).

## Navigation & routes
`shared/05` event table. Focused window defines the URL (`/macos/{slug}/…`); focusing another window → `go()`
(collapses when toggling); close/minimize → `go(next focused or /macos)`; move/resize/zoom write nothing.

## Keyboard (full list in `05-accessibility.md`)
Alt+Shift+W close · M minimize · F zoom · N/P cycle windows · window menu → **Move** / **Size** mode (arrows 10 px,
Shift 50 px, Enter commit, Esc revert).

## Compact mode (`compact` size class or 400 % zoom)
Same DOM; CSS ignores the geometry custom properties: every window is maximized, one visible at a time, others
`hidden`. Traffic lights collapse to one 44 px "Window controls" menu. Drag/resize disabled; Zoom hidden. Switching
via Dock or Mission Control. Stored floating rects are kept for when the viewport grows.

## Edge cases
See `06-edge-cases.md`. Highlights: viewport shrink → re-clamp on `ResizeObserver`; drag interrupted by
`pointercancel`/rotation/blur → commit last valid rect; rapid red-then-Dock click → re-open cancels `closing`;
20 windows max is irrelevant (8 singleton apps).

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `MAC-WM-01` | Open from launcher rect with cascade + learned rects | `e2e: M2 second window offset 24 px; reopen restores last rect` | P2 |
| `MAC-WM-02` | Focus + layering + inactive appearance; click acts in one press | `e2e: M2 z-order follows clicks; button in inactive window fires` | P2 |
| `MAC-WM-03` | Drag with clamps, commit once, zero React renders | `e2e: M2 cannot lose the title bar; render counter stays 0 during drag` | P2 |
| `MAC-WM-04` | Eight-zone resize with min size; ghost at T0 | `e2e: M2 resize respects minPx; T0 shows outline` | P3 |
| `MAC-WM-05` | Minimize (Scale) into Dock + restore, reversible mid-flight | `e2e: M1 minimize/restore; click mid-flight reverses` | P2 |
| `MAC-WM-06` | Zoom / restore via green button and title double-click | `e2e: M2 zoom fills workspace; text not distorted (no non-uniform scale)` | P2 |
| `MAC-WM-07` | Close keeps app running; Quit removes dot | `e2e: M2 dot persists after close, gone after Quit` | P3 |
| `MAC-WM-08` | Dock click semantics (open / restore / focus / no-op) | `unit + e2e: decision table` | P2 |
| `MAC-WM-09` | Window menu: Move / Size / Center by keyboard | `e2e: M1 keyboard-only move and size` | P3 |
| `MAC-WM-10` | Compact mode: single maximized window, controls menu | `e2e: M3 at 390 px` | P2 |
| `MAC-WM-11` | History rules per window event | `e2e: H1 on macOS` | P2 |
| `MAC-WM-12` | Hide others / Show all | `e2e: menu items act without animation storm` | P3 |

## Not like the others
Controls on the left; **no Snap**, no edge-tiling; closing ≠ quitting; clicking the focused app's Dock icon does
nothing (Windows minimizes on taskbar click); Zoom fills the workspace but leaves the menu bar and Dock visible
(Windows maximize covers everything but the taskbar); minimize is the Scale effect into the Dock's right side.
