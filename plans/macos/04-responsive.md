# macOS / 04 — Responsive

## Role + requirement refs
How the macOS desktop is *designed* for each size class and input type. Classes, units, safe areas and the
gesture ↔ alternative inventory are owned by `shared/08-responsive.md`. R42, D, north-star B12.

## Postures

### `expanded` / `large` + fine pointer — full fidelity
Free-floating windows, Dock magnification, hover labels, marquee, right-click menus, 24 px pointer targets.
`large` (≥ 1600 px): Dock icons 64 px, default windows 15 % larger, Spotlight 720 px.

### `medium` or coarse pointer — touch desktop
Floating windows remain. Title-bar drag by touch; a **44 px resize corner** (bottom-right) replaces edge zones;
window menu adds **Tile Left / Tile Right / Fill** (the only tiling macOS offers — mirrors real macOS 15). No
magnification, no hover labels (labels on long-press), 44 px targets, context menus by long-press + "⋯".
Menu bar 28 px tall.

### `compact` (phones, or 400 % zoom) — compact window mode
- **One maximized window** at a time between a slim menu bar and the Dock. Same DOM; CSS ignores geometry vars.
- Traffic lights collapse to a single **44 px "Window controls" menu** (Close · Minimize · Windows…).
- Menu bar: ` · AppName ▾ ··· Résumé · 🔍 · Control Center`.
- Dock: 48 px icons, horizontal scroll, no magnification; adds a **"Windows" button** → Mission Control carousel.
- Landscape: Dock becomes a left rail; menu bar stays on top.
- Desktop items: single right-hand column, tap to open.
- Apps switch to their compact layouts (each app file) — drill-down lists with back chevrons.
- Browser Back = previous location/app (apps always *push* in compact — `ROUTE-MOBILE-01`).

## Safe areas and viewport
Shell `100dvh`; menu bar padded by `--sa-t`, Dock offset by `--sa-b`, rail by `--sa-l`. Windows' workspace =
viewport minus menu bar, Dock and safe areas. Notch/cut-out: menu-bar content avoids `--sa-l/r` in landscape.

## Rotation / resize
Re-clamp from the size-class bucket (`KRN-GEO-01`); crossing into `compact` maximizes without animation storm
(one 150 ms crossfade); crossing back restores stored floating rects.

## Virtual keyboard
Spotlight and compose sheets bound their scroll areas by `--vvh`; inputs ≥ 16 px on coarse pointers; the Dock
hides while the keyboard is up in `compact` portrait (returns on blur).

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `MAC-RESP-01` | Full-fidelity posture (`expanded`/`large`) | `e2e: M2 at 1440×900 and 1920×1080` | P3 |
| `MAC-RESP-02` | Touch desktop posture: touch drag, resize corner, Tile menu, long-press | `e2e: ipad-landscape project M2-touch` | P3 |
| `MAC-RESP-03` | Compact window mode (single window, controls menu, Windows button) | `e2e: M3 iphone + pixel` | P2 |
| `MAC-RESP-04` | Compact landscape left-rail Dock | `e2e: iphone-landscape` | P3 |
| `MAC-RESP-05` | Safe areas + dvh; keyboard-aware sheets | `e2e: safe-area token override; Spotlight visible with keyboard up` | P3 |
| `MAC-RESP-06` | Size-class transitions restore/maximize without storms | `e2e: O1 rotate tablet across the compact boundary` | P3 |
| `MAC-RESP-07` | 400 % zoom engages compact mode | `e2e: RESP-ZOOM-01 on macOS` | P3 |

## Not like the others
On phones macOS keeps its **menu bar + Dock** around one full window (Windows keeps a taskbar + Start sheet;
iOS/Android are natively full-bleed phone OSes and don't need a compact mode at all).
