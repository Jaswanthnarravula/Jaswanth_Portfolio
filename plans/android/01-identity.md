# Android / 01 — Identity (Material 3)

## Role + requirement refs
Values for `[data-os="android"]`. Requirements: R12, R20, R21. Token architecture: `shared/06-design-system.md`.

## Dynamic colour (Material You)
A **seed colour per wallpaper** (precomputed at build, not sampled at runtime) generates the M3 tonal palettes
(primary, secondary, tertiary, neutral, neutral-variant; tones 0–100) via a small build script → CSS variables:
`--md-primary`, `--md-on-primary`, `--md-primary-container`, `--md-on-primary-container`, `--md-secondary-container`,
`--md-surface`, `--md-surface-container-{lowest,low,,high,highest}`, `--md-on-surface`, `--md-on-surface-variant`,
`--md-outline`, `--md-outline-variant`. Light and dark schemes both generated. Settings offers 4 wallpapers → 4 schemes
(a genuine Material You moment). Contrast pairs are validated at build (`on-*` vs container ≥ 4.5:1).

## Tokens (`[data-os="android"]`)

| Token | Value |
|---|---|
| `--font-ui` | `Roboto, "Roboto Flex", Inter, sans-serif` (Roboto Flex subset loads only in this chunk) |
| Type scale (M3) | Display S 36 · Headline S 24 · Title L 22 · Title M 16/500 · **Body L 16** · Body M 14 · Label L 14/500 · Label M 12/500 |
| Spacing | 4 dp grid; screen margins 16 dp (24 dp ≥ `medium`); list items 56/72 dp; top app bar 64 dp; bottom nav 80 dp |
| Shape scale | extra-small 4 · small 8 · medium 12 · large 16 · **extra-large 28** · full (pills, FAB 16, chips 8) |
| `--target-min` | **48 × 48 dp**, 8 dp between targets |
| Elevation | **tonal**: surface-container levels by colour; shadows only for FAB/menus/heads-up (level 2–3, soft) |
| Materials | **No blur anywhere.** Scrims: 32 % black behind sheets/drawer/shade |
| Icons | Adaptive-icon mask (rounded square ≈ 30 % radius "squircle-ish" Pixel default, 48 dp on home, 56 dp in drawer at `medium`); themed-icon option (monochrome glyph on `primary-container`) in Settings |
| System glyphs | **Material Symbols** (official, Apache-2.0), Rounded, weight 400, fill on selected |

## State layers and ripple
Every interactive surface has a **state layer** (the content colour at 8 % hover · 10 % focus · 10 % pressed · 16 %
dragged) and a **ripple** originating at the touch point (`03-motion.md`). Focus also shows a 3 dp outline offset 2 dp.
No dim-on-press, no scale-on-press (except FAB 0.96).

## Wallpaper
Original artwork ×4 (light + dark each): soft geometric shapes in the seed colour family; CSS gradients + AVIF ≤ 60 KB.
Static. When an app opens the wallpaper does not zoom (that is iOS).

## Light / dark
Both; default system. Dark uses `surface` tone 6 with containers lifting by tone, not by shadow.

## Sound
Off by default; if enabled: original soft "tock" on Back and a rising two-note on unlock (synthesized).

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `AND-ID-01` | M3 token scope complete incl. tonal surface containers | `unit: all semantic + md tokens defined for data-os=android` | P6 |
| `AND-ID-02` | Build-time dynamic colour from 4 wallpaper seeds, light + dark, contrast-validated | `unit: palette script output; every on-/container pair ≥ 4.5:1` | P6 |
| `AND-ID-03` | State layers at M3 opacities + focus outline | `cmp: hover/focus/pressed layer opacities` | P6 |
| `AND-ID-04` | **Zero `backdrop-filter`** on Android; scrims only | `e2e: X5 blur count = 0 on every Android surface` | P6 |
| `AND-ID-05` | Adaptive icon mask + themed-icons option; identical boxes across asset modes | `e2e: toggle themed icons; DS-ICONBOX-01` | P6 |
| `AND-ID-06` | Roboto Flex loaded only in the Android chunk | `perf: font request only on /android/*` | P6 |

## Not like the others
**Colour derived from the wallpaper, tonal elevation, no blur, ripples, 28 dp extra-large corners, 48 dp targets**
(iOS: blur materials, hairlines, dim-on-press, squircles, 44 pt; Windows: Mica/Acrylic + strokes; macOS: vibrancy).
