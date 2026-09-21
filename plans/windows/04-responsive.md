# Windows 11 / 04 — Responsive

## Role + requirement refs
How the Windows desktop is designed per size class and input. Classes, units, safe areas, gesture ↔ alternative
inventory: `shared/08-responsive.md`. R42, D, north-star B12.

## Postures

### `expanded` / `large` + fine pointer — full fidelity
Floating windows, Snap by drag with previews, snap-layouts flyout on maximize hover, taskbar thumbnail previews and
peek, 32 px targets, hover fills. `large`: Start 680 px wide, default windows 12 % larger.

### `medium` or coarse pointer — tablet posture
Mirrors Windows' own tablet optimizations: taskbar icon spacing 44 px, caption buttons 48 × 44, list rows 40 px,
**no hover previews** (long-press → jump list), Snap from the **system menu** and by dragging to edges with larger
(24 px) activation zones, a 44 px resize grip at the bottom-right corner. Start opens at 560 px. Touch drag on title bars.

### `compact` — compact window mode
- One **maximized** window above a 48 px taskbar (40 px in landscape). Same DOM; CSS ignores geometry + snap tags.
- Caption buttons: **minimize + close** only, 48 × 44.
- Taskbar: Start · Search · Task View · scrolling running apps; tray → one button (combined sheet).
- **Start = full-height sheet**, Search = full-height single-pane sheet, flyouts = bottom/top sheets.
- Task View card list is the window switcher.
- Apps use their compact layouts (each app file): drill-down lists with back arrows; command bars collapse to ⋯.
- Opening an app always **pushes** history; browser/system Back returns to the previous app or the desktop; Back also
  closes an open Start/Search sheet first (transient arbitration).

## Safe areas and viewport
Shell `100dvh`; taskbar padded by `--sa-b` (and `--sa-l/r` in landscape); title bars avoid `--sa-t`. Workspace =
viewport − taskbar − safe areas.

## Rotation / resize
Snapped windows re-derive from their snap tag; floating rects re-clamp from the size-class bucket; crossing into
`compact` maximizes with one 150 ms crossfade; crossing back restores floats and snaps.

## Virtual keyboard
Start/Search lists bound by `--vvh`; inputs ≥ 16 px; the taskbar hides while the keyboard is up in `compact` portrait.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `WIN-RESP-01` | Full-fidelity posture | `e2e: N2 at 1440×900 and 1920×1080` | P4 |
| `WIN-RESP-02` | Tablet posture (spacing, no hover previews, system-menu Snap, resize grip) | `e2e: ipad-landscape N2-touch` | P4 |
| `WIN-RESP-03` | Compact window mode (min+close, Start sheet, Task View list) | `e2e: N3 iphone + pixel` | P4 |
| `WIN-RESP-04` | Back closes transient sheets first, then navigates | `e2e: N3 Back with Start open closes Start only` | P4 |
| `WIN-RESP-05` | Safe areas + dvh; keyboard-aware sheets | `e2e: safe-area override; Search usable with keyboard up` | P4 |
| `WIN-RESP-06` | Size-class transitions keep snaps/floats | `e2e: O1 across the compact boundary` | P4 |
| `WIN-RESP-07` | 400 % zoom engages compact mode | `e2e: RESP-ZOOM-01 on Windows` | P4 |

## Not like the others
On phones Windows keeps a **taskbar with a Start sheet** (macOS keeps a menu bar + Dock; iOS/Android need no compact
mode). Tablet posture is a first-class Windows idiom — spacing grows, hover affordances drop.
