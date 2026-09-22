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

## Visual target (owner storyboard — `plans/visual-targets/macos-desktop.png`)
Rules: `shared/06-design-system.md` → Owner visual targets. Positions are fractions of the page (W × H); sizes are
the real macOS metrics in this file and the surface/app files.

| Element | Exactly as the frame |
|---|---|
| Wallpaper (light) | `linear-gradient(150deg, #1f4f7a 0%, #3f78a8 35%, #e3a873 78%, #f3d3a4 100%)` — this *is* the "soft abstract gradient"; dark variant = same stops at 55 % lightness |
| Menu bar | Full width, white tint `rgb(255 255 255 / .55)` + vibrancy · Apple logo · **bold app name** · File · Edit · View · Go · Window · Help · right: Résumé · Spotlight glyph (frame's "Search") · clock `Tue 9:41 AM` |
| Desktop items | Top-right column under the menu bar, in this order: `Résumé.pdf` (document), `Projects` (folder), `Experience` (folder); white labels with text shadow |
| Reference state (chooser snapshot) | `/macos/finder/experience` after opening GitHub: GitHub window **behind and inactive** at x 30 %, y 13 %, 50 % × 52 % (grey lights); Finder **front and active** at x 7 %, y 24 %, 62 % × 54 % |
| Finder window | Surface `#f6f6f7`; four columns 1 : 1.1 : 1.3 : 1.6 — sidebar (`rgb(225 229 236 / .9)`, "Favourites": Jaswanth · Experience · Education · Projects · Résumé) · sections (Experience · Education · Projects) · entries ("{Company} — {Role}") · preview (role bold, "{Company} · {dates}" dim, one-line summary, skill tags with 1 px `#c9ccd3` border). Selection `#2f6fe4` with white text in every column |
| Title bars | The frame's plain title strip abbreviates the real unified toolbar: build the real one (`apps/finder.md`, 52 px, traffic lights over the sidebar), keeping the frame's title text and greys (`#e9e9eb`, hairline `#d3d3d6`) |
| Dock | Centred floating shelf, tint `rgb(255 255 255 / .38)` + 1 px `rgb(255 255 255 / .55)` rim · Finder · Safari · GitHub · Mail · Preview · VS Code · Terminal · System Settings · separator · Résumé stack · running dots `#222` under Finder and GitHub. The frame's GitHub at 1.45× with 1.2× neighbours is the **hover** state (magnification), not rest |

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
