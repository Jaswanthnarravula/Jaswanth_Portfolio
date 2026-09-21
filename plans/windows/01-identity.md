# Windows 11 / 01 — Identity

## Role + requirement refs
The Fluent visual language values for `[data-os="windows"]`. Requirements: R12, R18, R21. Token architecture:
`shared/06-design-system.md`.

## Tokens (`[data-os="windows"]`)

| Token | Value |
|---|---|
| `--font-ui` | `"Segoe UI Variable Text", "Segoe UI Variable", "Segoe UI", Inter, sans-serif` (Display variant for ≥ 20 px) |
| Type ramp | Caption 12 · **Body 14** · Body Strong 14/600 · Subtitle 20/600 · Title 28/600 |
| Spacing | 4 px grid; list rows 36 px (40 px touch); command bar 48 px; title bar 32 px |
| `--radius-window` | **8 px** (0 when maximized/snapped) · controls 4 px · flyouts/menus 8 px · taskbar buttons 4 px |
| `--target-min` | 32 px (fine) · 40 px (coarse); caption buttons 46 × 32 → 48 × 44 coarse |
| Accent | `oklch(0.58 0.16 250)` (Windows blue); accent text on accent = white |
| Stroke | 1 px `rgb(255 255 255 / .08)` (dark) / `rgb(0 0 0 / .06)` (light) around every surface ("card stroke") |
| Shadow | Window: `0 8px 32px rgb(0 0 0 / .28)` + stroke; flyout: `0 8px 16px rgb(0 0 0 / .26)`; none when maximized |
| Materials | **Mica** (title bars, Settings/Explorer backgrounds) · **Acrylic** (Start, Search, flyouts, context menus, tray) · solid (content) |

## Mica and Acrylic (performance-safe implementation)
- **Mica** = a **pre-blurred, desaturated copy of the wallpaper** (≈ 2 KB AVIF + tint layer) rendered as a child
  that is counter-translated to the window's position, so it appears fixed to the desktop. Transform-only → no
  `backdrop-filter` while dragging. Inactive windows switch Mica to a solid neutral (as Windows does).
- **Acrylic** = real `backdrop-filter: blur(30px) saturate(125%)` + 2 % noise + tint + luminosity layer, used only on
  **transient** surfaces. Cap: taskbar + one flyout + one menu = 3 live blur surfaces.
- T0 / `data-glass=solid`: Acrylic → solid `--surface-overlay`; Mica → flat tint.

## Wallpaper
Original artwork in both asset modes: a flowing ribbon/bloom form in the brand palette (light + dark), CSS gradient
base + AVIF ≤ 60 KB. Static.

## Caption buttons
Right-aligned, 46 × 32 px each, glyphs from Fluent UI System Icons (MIT): minimize `—`, maximize `▢` / restore
`❐`, close `✕`. Hover fills: neutral `rgb(255 255 255 / .06)`; **close hover = `#C42B1C` with white glyph**. Inactive
window: glyphs at 50 % opacity. Always visible (no hover-to-reveal).

## Iconography
App icons via the asset manifest (no tile background — Windows icons are free-form). System glyphs: Fluent UI System
Icons (official, MIT) — 16/20 px, regular weight, filled variant for selected states.

## Light / dark
Both; default follows system. Taskbar and flyouts use Acrylic tints per theme. Accent applies to pills, selection
indicators (3 px left bar in lists/NavigationView) and toggles.

## Sound
Off by default. If enabled: original soft "pop" for toasts, low "thud" for errors (synthesized).

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `WIN-ID-01` | Windows token scope complete | `unit: all semantic tokens defined for data-os=windows` | P4 |
| `WIN-ID-02` | Mica as counter-translated pre-blurred image (no live filter on windows) | `perf: zero backdrop-filter on window elements; stable fps while dragging` | P4 |
| `WIN-ID-03` | Acrylic on transient surfaces within the 3-surface cap; solid fallback | `e2e: X5 blur count ≤ 3 with Start + a menu open` | P4 |
| `WIN-ID-04` | Caption buttons: sizes, hover fills, red close, inactive state | `e2e: visual + X3 hit areas` | P4 |
| `WIN-ID-05` | 8 px corners, 0 when maximized/snapped; 1 px card stroke | `e2e: computed radius toggles with state` | P4 |
| `WIN-ID-06` | Light/dark parity | `e2e: visual snapshots both themes` | P4 |

## Not like the others
8 px corners with a 1 px stroke and **right-side glyph buttons** (macOS: 12 px, shadow-only, left coloured dots).
Mica is a **static** tinted wallpaper sample (macOS vibrancy is live blur). 14 px Segoe (macOS 13 px SF; Android 14 px
Roboto with tonal surfaces and no blur at all). Selection is a 3 px accent **bar**, not a filled row.
