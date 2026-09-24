# iOS / 01 — Identity

## Role + requirement refs
Values for `[data-os="ios"]`. Requirements: R12, R14, R21. Token architecture: `shared/06-design-system.md`.

## Tokens (`[data-os="ios"]`)

| Token | Value |
|---|---|
| `--font-ui` | `-apple-system, "SF Pro Text", "SF Pro Display", Inter, sans-serif` |
| Type ramp | Large Title 34/700 · Title 1 28/700 · Headline 17/600 · **Body 17** · Callout 16 · Subhead 15 · Footnote 13 · Caption 12; tracking tightened on ≥ 20 px |
| Spacing | 8 pt grid; screen margins 16 pt (20 pt on `pad`); list rows ≥ 44 pt; nav bar 44 pt (96 pt with large title); tab bar 49 pt + home-indicator inset |
| `--radius-icon` | **continuous-corner squircle** (superellipse mask, ≈ 22.37 % of width) |
| Radii | cards 12–16 · grouped-list sections 10 · sheets 10 top corners · buttons 12 · pills full |
| `--target-min` | **44 × 44 pt** |
| Accent | system blue `oklch(0.62 0.19 255)`; destructive red; grouped backgrounds `#F2F2F7` / `#000` + `#1C1C1E` cells |
| Materials | `thin` (banners, Dock plate), `regular` (nav/tab bars over content), `thick` (Control Center modules, context previews) — blur + saturate 180 % |
| Separators | 0.5 px hairlines inset 16 pt |
| Icon grid | Phone: 60 pt icons, 4 columns × 6 rows. Full page (tablets, laptops, desktops): icon size `clamp(64px, 8.4vh, 96px)`, 6 / 7 / 8 columns by size class. Labels white with a shadow scrim (12 pt phone, 13 px full page) |

## Wallpaper and depth
Original artwork: layered abstract gradient, light + dark. **Depth without cost:** the wallpaper is one static layer
scaled 1.06; icons sit above. On tier ≥ 1 with motion full, the wallpaper translates ±6 px against **pointer
position** (fine pointer — laptops and desktops) — no device-orientation permission prompts, no animation loop (writes
only on pointermove via the ticker). Opening an app scales the wallpaper 1.06 → 1.12 and dims it (part of the flight).

**Official mode (owner decision 2026-09-23: "iphone 15 or 16"):** the Home and Lock Screens show the **iPhone 16
wallpaper in Ultramarine** — Apple artwork, manifest id `wallpaper.ios`, an overlay exactly like the official app
icons (`ASSET_MODE=original` restores the gradient above; `TAKEDOWN.md`). One portrait AVIF (1290 × 2796, ≤ 60 KB)
covers every page shape with `cover`, centred — on a landscape page the two glowing rims become the horizon behind the
grid. Dark appearance dims it by 30 %, as iOS's "Dark Appearance Dims Wallpaper" does (no second file); its mean colour
`#525cb8` shows while it loads (`fetchpriority="low"`, shared/11).

## Press feedback
Icons and rows **dim** (overlay black 20 %) within 80 ms on press and recover over 200 ms; buttons scale 0.97 with a
spring. **No ripple** (that is Android).

## Status bar, home indicator
Defined in `surfaces/status-bar-and-home-indicator.md`. Home indicator: 134 × 5 pt pill, 8 pt above the bottom inset.

## Light / dark
Both; default system. Grouped lists, materials and wallpaper variant switch.

## Sound and haptics
UI sounds off by default. "Haptics" are expressed visually only (the scale-dip on long-press previews) — no
`navigator.vibrate` calls (intrusive, unsupported on iOS).

## Glass by tier
T0 / `data-glass=solid`: Dock plate, bars and banners become solid tints. T1: blur on **Dock + one bar + one
transient** (banner / Control Center / Spotlight). T2 adds nothing (no WebGL in any OS).

## Visual target (owner storyboard — `plans/visual-targets/ios-home.png`, `ios-github.png`)
Rules: `shared/06-design-system.md` → Owner visual targets. These are the **full-page (iPadOS) layouts** used on
tablets, laptops and desktops; phones keep the iPhone layout (`04-responsive.md`). Positions are fractions of the
page (W × H); sizes are the real iPadOS metrics.

| Element | Exactly as the frame |
|---|---|
| Wallpaper | `radial-gradient(60% 90% at 12% 8%, #8e6bd8 0, transparent 60%), radial-gradient(55% 80% at 92% 18%, #ff9f7a 0, transparent 55%), linear-gradient(160deg, #2a1d63 0, #6c3aa3 45%, #e27a86 85%, #ffb07a 100%)` — original mode; official mode shows the iPhone 16 wallpaper ("Wallpaper and depth") |
| Status bar | Left `9:41  Mon 21 Sep`; right Wi-Fi glyph, `80%`, battery glyph (the frame's "Wi-Fi" and `▮` are stand-ins for the real glyphs) |
| Widgets | Left column from x 5.7 %, y 7.7 %, width 25.6 %: **Résumé** large widget (caps label, name, "{role} · {company}", "Updated {month year}", [Open] filled `#16183a` + [Download] outlined), then two square widgets side by side — **Open to work** ("{headline}") and **Projects** ("{featured repo}", "{language} · ★ {stars}"). White-to-lavender fill `rgb(255 255 255 / .92) → rgb(235 240 255 / .85)`, ink `#16183a` |
| App grid | From x 37 % to 3 em from the right, 5 columns: Safari · GitHub · Notes · Messages · Settings · **Career** folder (Files, Notes, Mail) |
| Search pill | Centred above the Dock: "Search" on `rgb(255 255 255 / .25)` |
| Dock | Floating, centred, `rgb(255 255 255 / .28)` + 1 px `rgb(255 255 255 / .35)` rim: Files · Safari · GitHub · Mail (badge 1) · divider · Notes · Messages (recents). Home indicator: white bar, bottom centre |
| GitHub app | Split view. Sidebar 31 % W on `#f2f2f7`: large title "GitHub", search field `#e3e3e8`, inset group Home · **Projects** (blue `#0a7aff` text) · Profile, caption "REPOSITORIES", inset group of repos ("{name}" + "{language} · ★ {stars}"), selected row filled `#0a7aff` with white text. Detail on white: "‹ Repositories" and "Share" in `#0a7aff`, large title repo name, "{description} · {year}" in `#6d6d72`, segmented control README · Stack · About, body text `#1c1c1e`, topic chips `#eef3ff` / `#0a4fd6`, [Repository ↗] filled `#0a7aff` + [Live site ↗] tinted. Dark home indicator |

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `IOS-ID-01` | iOS token scope complete | `unit: all semantic tokens defined for data-os=ios` | P5 |
| `IOS-ID-02` | Squircle icon mask, identical boxes across asset modes | `e2e: DS-ICONBOX-01 on iOS` | P5 |
| `IOS-ID-03` | Wallpaper depth: static layer + pointer parallax only, scale/dim on app open | `perf: no animation loop at rest; transform-only writes` | P5 |
| `IOS-ID-04` | Dim-on-press feedback (80 in / 200 out), no ripple | `e2e: press overlay timing; no ripple element in DOM` | P5 |
| `IOS-ID-05` | Materials within the 3-surface cap; solid fallback | `e2e: X5 blur count ≤ 3 with Control Center open` | P5 |
| `IOS-ID-06` | Light/dark parity | `e2e: visual snapshots both themes` | P5 |

## Not like the others
**Squircle icons on a fixed grid, dim-on-press, hairline separators, large titles, blur materials** (Android: adaptive
circular/rounded icons, **ripple**, tonal surfaces with no blur, 48 dp targets, M3 type scale; desktops: pointer
targets and window chrome).
