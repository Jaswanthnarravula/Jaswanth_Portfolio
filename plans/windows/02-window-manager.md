# Windows 11 / 02 — Window manager

## Role + requirement refs
Desktop windows with dragging, focusing, minimizing, maximizing, restoring, closing, **Snap**, taskbar state and
active indicators — never website modals. Requirements: R19, R37, R46, north-star B1. State machine and geometry:
`shared/04-os-kernel.md`. This file is the Windows skin and the behaviours that differ from macOS.

## Anatomy of a window
```
┌ icon  Title ─────────────────────────────  —  ▢  ✕ ┐  title bar 32 px (Mica), 48 px if it hosts tabs
│ command bar / NavigationView │ content            │  8 resize zones (edges 6 px, corners 12 px)
└──────────────────────────────┴────────────────────┘  8 px radius, 1 px stroke; 0 px when maximized/snapped
```
`<section aria-labelledby tabindex="-1">` + `h2`; caption buttons in a `group` "Window controls"; the **title-bar
icon is the system-menu button** (Restore · Move · Size · Minimize · Maximize · Snap ▸ · Close).

## Behaviour & states

| Action | Behaviour |
|---|---|
| **Open** | From the taskbar button (or Start tile/desktop icon) rect: scale 0.9 → 1 + fade, 250 ms entrance curve. Default rect centred with a 32 px cascade; `learnedRects` wins |
| **Focus** | pointerdown anywhere → front of `zOrder`; title bar Mica active; taskbar pill widens (16 px) for the active app, 6 px for other running apps |
| **Drag** | Title-bar drag via `drag()`; dragging a **maximized** window restores it under the pointer (proportional x) and continues the drag; clamp keeps ≥ 48 px of title bar on screen |
| **Snap by drag** | Dragging to the left/right edge shows a **translucent preview** of the half; corners → quarter; top edge → maximize. Release commits. Preview appears after the pointer is within 12 px of the edge for 100 ms |
| **Snap layouts flyout** | Hovering (or focusing) the maximize button for 400 ms shows a flyout with 4 layouts (½+½, ⅔+⅓, ⅓+⅓+⅓, ¼×4); choosing a zone snaps the window there. Also reachable from the system menu (keyboard/touch) |
| **Snapped state** | Kernel stores `phase: normal` with a `snap` tag (`left`/`right`/`tl`/`tr`/`bl`/`br`/`third-*`) so resize of the viewport re-derives the rect; dragging away restores the pre-snap rect |
| **Resize** | 8 zones; resizing the shared edge between two snapped windows resizes **both** (only for ½+½) |
| **Minimize** | Scale + fade toward the taskbar button, 250 ms; `<Activity hidden>`; taskbar pill stays (6 px) |
| **Taskbar button click** | Not running → open · minimized → restore · behind → focus · **already active → minimize** |
| **Maximize / Restore** | Fills the workspace above the taskbar, radius → 0, shadow off. 250 ms / 200 ms, layout-once + `clip-path` reveal. Title-bar double-click toggles |
| **Close** | Scale 1 → 0.95 + fade, 167 ms. **The app ends**: taskbar pill disappears (unpinned apps leave the taskbar) |
| **Alt+Tab equivalent** | Alt+Shift+N / P cycles; Task View (`surfaces/task-view.md`) for the overview |

## Navigation & routes
`shared/05` event table. Snap, maximize, move and resize write nothing. Focus/open/close/minimize → `go()`.

## Keyboard
Alt+Shift+W close · M minimize · F maximize/restore · system menu via the title-bar icon (Enter/Space) → **Move**,
**Size**, **Snap ▸ Left / Right / Top-left …** · Alt+Shift+Arrow = snap left/right/maximize/restore-then-minimize
(mirrors Win+Arrow without stealing the OS chord).

## Compact mode
Same DOM, geometry ignored: one maximized window; caption buttons = **minimize + close** at 48 × 44 (maximize
hidden); Snap disabled; switching via taskbar and Task View.

## Edge cases
See `06-edge-cases.md` (snap preview cancelled by Esc, viewport resize re-derives snapped rects, drag-from-maximized
proportional restore, paired resize when the partner closes).

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `WIN-WM-01` | Open from launcher rect, centred cascade, learned rects | `e2e: N1 window opens from the taskbar button rect` | P4 |
| `WIN-WM-02` | Focus/layering + active Mica + taskbar pill widths | `e2e: N2 active pill 16 px, others 6 px` | P4 |
| `WIN-WM-03` | Drag with clamps; drag-from-maximized proportional restore | `e2e: N2 dragging a maximized window restores under the pointer` | P4 |
| `WIN-WM-04` | Snap by drag with previews (halves, quarters, top = maximize) | `e2e: N2 drag to each edge/corner; Esc cancels preview` | P4 |
| `WIN-WM-05` | Snap layouts flyout (hover/focus + system menu) | `e2e: N2 keyboard snap via system menu` | P4 |
| `WIN-WM-06` | Snapped state re-derives on viewport resize; drag-away restores pre-snap rect | `unit: snap tag → rect derivation; e2e: O1` | P4 |
| `WIN-WM-07` | Paired resize of ½+½ snapped windows | `e2e: N2 shared edge moves both` | P4 |
| `WIN-WM-08` | Minimize/restore to the taskbar button; active-click minimizes | `unit + e2e: taskbar click decision table` | P4 |
| `WIN-WM-09` | Maximize/restore (radius 0, no shadow), title double-click | `e2e: N2 text not distorted; radius toggles` | P4 |
| `WIN-WM-10` | Close ends the app (pill removed) | `e2e: N2 pill disappears on close` | P4 |
| `WIN-WM-11` | System menu with Move / Size / Snap by keyboard; Alt+Shift+Arrow | `e2e: keyboard-only N-journey` | P4 |
| `WIN-WM-12` | Compact mode (min + close only, 48 × 44) | `e2e: N3 at 390 px` | P4 |
| `WIN-WM-13` | History rules per window event | `e2e: H1 on Windows` | P4 |

## Not like the others
**Snap** (previews, layouts flyout, paired resize) exists only here. Active-app click **minimizes**; close **ends**
the app; maximize squares the corners and covers the desktop (macOS zoom keeps 12 px corners, menu bar and Dock).
The system menu hides behind the title-bar icon (macOS uses a "⋯" window menu).
