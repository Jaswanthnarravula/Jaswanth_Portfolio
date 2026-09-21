# macOS / 01 — Identity

## Role + requirement refs
The visual language that makes the desktop unmistakably macOS. Requirements: R12, R16, R21. Token architecture:
`shared/06-design-system.md` (this file supplies the `[data-os="macos"]` values).

## Tokens (`[data-os="macos"]`)

| Token | Value |
|---|---|
| `--font-ui` | `-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif` |
| UI sizes | 13 px body · 11 px caption/labels · 15 px window title (weight 600) · 26 px large title in Settings |
| Spacing | 4 / 8 px grid; sidebar rows 28 px; toolbar 52 px; menu rows 22 px |
| `--radius-window` | 12 px (outer) · 10 px sheets · 6 px controls · 8 px menus |
| `--radius-icon` | 22.37 % continuous-corner squircle |
| `--target-min` | 24 px (fine pointer) · 44 px (coarse) |
| Accent | `oklch(0.62 0.19 255)` system blue; selection = accent at 100 % (active window) / grey (inactive) |
| Window shadow (active) | `0 22px 70px 4px rgb(0 0 0 / .56), 0 0 0 .5px rgb(0 0 0 / .4)` (dark) — lighter in light mode |
| Window shadow (inactive) | ~40 % of the active shadow; title text 50 % opacity; traffic lights grey |
| Materials | **vibrancy**: menu bar `--material-chrome`, Dock `--material-thin`, sidebars `--material-regular`, menus/Spotlight `--material-thick` |
| Hairlines | 0.5 px separators (`rgb(255 255 255 / .1)` dark, `rgb(0 0 0 / .1)` light) |

## Wallpaper
Original artwork in both asset modes: a soft abstract dune/gradient in the brand palette, light + dark variants,
CSS gradient base with an optional AVIF ≤ 60 KB (`fetchpriority="low"`). **Static** (no animation — `PERF` rule);
tier 2 adds ±8 px pointer parallax via `transform` on the wallpaper layer only.

## Traffic lights
12 px dots on a 20 px pitch visually; **24 px hit pitch** (`RESP-TAP-01`), 8 px from the top-left. Colours: close
`#FF5F57`, minimize `#FEBC2E`, zoom `#28C840`; glyphs (× − ⤢) appear on group hover, on `:focus-visible`, and
**always** under `prefers-contrast: more` / `forced-colors`. Inactive window → all three grey.

## Iconography
App icons from the asset manifest (`official` default; parametric squircle originals otherwise). Dock base 48 px
(64 px on `large`). Toolbar/sidebar glyphs: Lucide (ISC) at 1.5 px stroke, tuned to SF-like weight — SF Symbols are
not licensed for the web.

## Light / dark
Both supported (`prefs.theme`, default system). Vibrancy tints, shadows and hairlines switch; wallpaper variant switches.

## Sound
Off by default. If enabled: soft original tick on Dock launch and a muted "whoosh" on minimize — synthesized,
≤ 120 ms, −18 dB.

## Glass by tier
T0 / `data-glass=solid`: opaque `--surface-chrome` for menu bar, Dock, sidebars. T1: `backdrop-filter` on **menu
bar + Dock + one transient** (menu / Spotlight / Notification Center) — the ≤ 3 cap. T2: adds sidebar vibrancy of
the focused window only and two-layer shadows.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `MAC-ID-01` | macOS token scope complete | `unit: all semantic tokens defined for data-os=macos` | P2 |
| `MAC-ID-02` | Active vs inactive window appearance | `e2e: M2 unfocused window has grey lights + reduced shadow` | P2 |
| `MAC-ID-03` | Traffic lights: size, hit pitch, glyph visibility rules | `e2e: X3 hit areas ≥ 24 px; glyphs visible on focus + high contrast` | P2 |
| `MAC-ID-04` | Wallpaper static, light/dark, tier-2 parallax only | `perf: no animation on wallpaper at T0/T1` | P2 |
| `MAC-ID-05` | Vibrancy materials within the 3-surface cap | `e2e: X5 blur count ≤ 3 with a menu open` | P3 |
| `MAC-ID-06` | Light/dark parity | `e2e: visual snapshots both themes` | P3 |

## Not like the others
Rounded 12 px windows with large soft shadows and **left-side** coloured controls (Windows: 8 px, right-side glyph
buttons, 1 px stroke). 13 px dense type (Windows 14 px Segoe). Vibrancy that samples the wallpaper (Windows Mica is
a static pre-blurred image; Android uses tonal colour with no blur).
