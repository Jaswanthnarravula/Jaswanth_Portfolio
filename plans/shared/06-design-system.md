# shared/06 — Design system

## Purpose
A token architecture that keeps shared mechanics consistent while making each OS look and feel unmistakably
like itself. Requirements: R10, R12, R21, R43.

## Decisions

| Decision | Rationale | Rejected |
|---|---|---|
| Three token layers: **primitive → semantic → OS skin** | Shared components read semantic tokens; each OS remaps them | One global theme with colour swaps (north-star B2) |
| Tokens live in CSS (`@theme` + `[data-os]` scopes), Tailwind v4 CSS-first | Matches the scaffold; zero JS cost; works before hydration | JS theme objects |
| **System font stacks per OS**; one metric-matched variable fallback | SF Pro / Segoe UI cannot legally be self-hosted; system stacks show the real face on its own platform | Shipping proprietary fonts |
| Glass is a **material system keyed to `data-tier` and `data-glass`**, never ad-hoc `backdrop-filter` | Performance cap + reduced-transparency support | Free use of blur |
| Text over wallpaper/glass is guaranteed by **scrim tokens** | Contrast cannot depend on wallpaper luck | Hoping the wallpaper cooperates |

## Specification

### Layer 1 — primitives (`@theme`)
Neutral + accent ramps in OKLCH; spacing scale `--space-1..12` (4 px base); radii; shadows; z-layers
(`--z-wallpaper 0 · desktop 10 · windows 100–899 · dock/taskbar 900 · menus 1000 · overlays 1100 · system 1200 ·
transition-stage 2000`); durations/easings from `shared/07-motion-system.md`.

### Layer 2 — semantic tokens (what shared components use)
`--surface-{base,raised,overlay,chrome}` · `--text-{primary,secondary,tertiary,on-accent}` · `--border-{subtle,strong}` ·
`--accent` · `--focus-ring` · `--scrim-{light,dark}` · `--radius-{control,card,window,icon,sheet}` ·
`--target-min` · `--font-{ui,display,mono}` · `--font-size-{caption,body,title,large}` · `--elevation-{1..5}` ·
`--material-{thin,regular,thick,chrome}`.

### Layer 3 — OS skins (`[data-os="…"]` scopes)

| Token | iOS | macOS | Windows 11 | Android | Linux |
|---|---|---|---|---|---|
| `--font-ui` | `-apple-system, "SF Pro Text", Inter` | same | `"Segoe UI Variable", "Segoe UI", Inter` | `Roboto, "Roboto Flex", Inter` | mono only |
| Body size | 17 px | 13 px | 14 px | 14 px (M3 body-medium) | 14–15 px mono |
| `--radius-window` | 0 (apps fill the page) | 12 px | 8 px | 0 / 28 px sheets | 6 px |
| `--radius-icon` | 22.37 % squircle | 22.37 % squircle | 4–8 px (no tile) | full circle / adaptive mask | — |
| `--radius-control` | 10–14 px | 6 px | 4 px | 20 px pill / full | 0–4 px |
| `--target-min` | 44 px | 24 px (pointer) / 44 px (touch) | 32 px (pointer) / 40 px (touch) | 48 px | 28 px rows / 44 px keys |
| Accent | system blue `oklch(0.62 0.19 255)` | same, user-tintable | Windows blue `oklch(0.58 0.16 250)` | M3 dynamic from wallpaper seed | green/amber prompt colours |
| Material | blur + saturate, light/dark | vibrancy (sidebar, menu bar, Dock) | Mica (pre-blurred image) + Acrylic (flyouts) | tonal surfaces (no blur) + scrims | opaque, optional 6 % translucency |
| Elevation idiom | soft large shadows | layered window shadows, active vs inactive | 1 px stroke + soft shadow | M3 tonal elevation (colour, not shadow) | none |

Exact per-OS values are owned by `{os}/01-identity.md`; this table fixes what must *differ*.

### Fonts (`DS-FONT-01`)
`next/font`: Inter variable (≤ 50 KB, `size-adjust` metric-matched) as the universal fallback, in the root.
Roboto Flex subset loads only in the Android chunk; a mono face (JetBrains Mono, OFL) only in the Linux /
terminal chunk. `font-display: swap`; LCP text never waits for a webfont. The welcome screens and the chooser set
the storyboard's faces (Owner visual targets): IBM Plex Sans (latin variable, 46 KB) is declared and preloaded on `/`
only; Bricolage Grotesque 700 (40 KB) is registered when the chooser mounts. Both OFL, self-hosted, hashed.

### Glass material by tier (`DS-GLASS-01`)

| | `data-tier=0` or `data-glass=solid` | `data-tier=1` (default) | `data-tier=2` |
|---|---|---|---|
| Hello / chooser panels | Tint over a pre-blurred static gradient; no `backdrop-filter` | `blur(24px) saturate(160%)` on ≤ 3 surfaces + specular edge pseudo-elements + 3 % noise | Shader lens does the glass; DOM panels drop `backdrop-filter`, keep hairline + specular |
| OS chrome | Opaque tinted surfaces, stronger borders (96 % solid) | `backdrop-filter` on Dock/taskbar/menu bar + transient flyouts only | + sidebar vibrancy, two-layer shadows |

Hard cap: **≤ 3 live `backdrop-filter` surfaces per screen** (risk 17). Windows Mica is a pre-blurred wallpaper
image counter-translated inside the window — never a live filter.

### Contrast and scrims (`DS-SCRIM-01`)
Any text on wallpaper/glass sits on a scrim token guaranteeing ≥ 4.5:1 (≥ 3:1 for large text and focus rings)
against worst-case backdrops; text-bearing glass has tint alpha ≥ 0.6. Unit-tested against sampled worst-case
colours of every wallpaper. `prefers-contrast: more` and `forced-colors: active` → solid surfaces, system colours,
always-visible control glyphs.

### Light/dark
Each OS supports light and dark via `prefs.theme` (`system` default) with `color-scheme` set; wallpapers ship a
light and a dark variant where the OS idiom has one.

### Iconography
All icons resolve through `lib/assets` (`shared/11-assets.md`): fixed boxes per OS (iOS 60 pt on phones / viewport-derived 64–96 px full page, Android 48 dp on phones / 56–88 px
full page, macOS Dock 48 px
base, Windows taskbar 24 px glyph in 40 px button), identical box sizes in `official` and
`original` modes so switching never shifts layout.

### Owner visual targets (owner decision 2026-09-21)
The owner's approved storyboard frames in `plans/visual-targets/` are **the** look of the welcome screens, the chooser
and every OS: `chooser.png` · `macos-desktop.png` · `windows-desktop.png` · `ios-home.png` + `ios-github.png` ·
`android-home.png` + `android-gmail.png` · `linux-terminal.png` (source CSS: `plans/visual-targets/storyboard.html`).
`plans/visual-targets/frames/` holds every frame rendered full screen at 1440 × 900 (`hello`, `intro`, `profiles`,
`chooser`, `macos`, `windows`, `ios-1` + `ios-2`, `android-1` + `android-2`, `linux`; regenerate with
`node scripts/render-visual-targets.mjs`) — the pixels the Storyboard test compares against. Exact values: the
"Visual target" section of `02-hello-page.md`, `03-netflix-page.md`, `04-os-chooser.md` and each OS's
`01-identity.md`. The frames are drawn at 1 em = 1.42 % of a 16:10 screen; the welcome screens and the chooser use that
unit (`--u`) so they land on the frame at any 16:10 size. Rules, in order:
1. **Composition, colour and structure come from the frame** — which surfaces are on screen, where they sit, the
   wallpaper gradient, surface tints, selection colours, what each window/list/tile contains and in what order.
2. **The real OS decides every detail the frame abbreviates** — measurements in real px/pt/dp (the frames are drawn
   ≈ 1.4× zoomed), the real system font stack, genuine artwork from `lib/assets`, and the real system glyphs where the
   frame uses a stand-in character (`⌕ ⧉ ▢ ◀ ● ■ ▾ ◢ ▮ ☰ ✎ ✉ ☆ ➤ ▦`). "Close to the OS" is not the bar; the OS is.
3. **Sample content is replaced by real data** — "Acme", "Globex", "Initech", "flowgraph", "tinyqueue", "★ 128",
   "60 %", "120 KB" and the like are storyboard examples; the same slots show `data/portfolio.ts` through selectors and
   content views (north-star B8, B9). A slot with no real fact is left out, never filled with an invented one.
4. The performance and accessibility caps still hold where a frame breaks them: ≤ 3 live `backdrop-filter` surfaces
   (a blur over a smooth gradient is rendered as its tint), none on Android, focus rings and contrast (`DS-SCRIM-01`).
Checked by north-star smell test 8 and the "Storyboard test" line in each OS's definition-of-done audit; the welcome
screens and the chooser by `e2e/welcome-visual.spec.ts` and `e2e/chooser-visual.spec.ts` (the frame's boxes at
1440 × 900, ≤ 1.5 px).

## Edge cases
System font missing (e.g. Segoe on macOS) → Inter fallback with matched metrics; no reflow on swap.
`backdrop-filter` unsupported → tier 0 styles by feature query. High-contrast mode → materials collapse to solid.

## Feature IDs + acceptance tests

| ID | Feature | Acceptance test |
|---|---|---|
| `DS-TOKEN-01` | Three-layer tokens + `[data-os]` scopes | `unit: every semantic token defined for all five OS scopes` |
| `DS-FONT-01` | Font strategy | `perf: Inter only on every route but / (Inter + the storyboard IBM Plex Sans); Linux chunk owns mono` |
| `DS-GLASS-01` | Material by tier / glass preference | `e2e: X5 count of live backdrop-filter elements ≤ 3 per OS home` |
| `DS-SCRIM-01` | Guaranteed contrast | `unit: scrim tokens ≥ 4.5:1 on worst-case backdrop` |
| `DS-THEME-01` | Light/dark + forced-colors | `e2e: forced-colors project legible on every OS home` |
| `DS-ICONBOX-01` | Stable icon boxes across asset modes | `e2e: zero layout shift toggling ASSET_MODE` |
| `DS-DISTINCT-01` | OS skins differ on every listed token | `unit: no two OS scopes share the same (radius, font, target, material) tuple` |

## Open questions
None.
