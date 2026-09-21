# iOS / surfaces — Dock

## Role + requirement refs
The frosted plate holding the four most important apps, present on every Home page. R14, R25.

## Portfolio mapping
Fixed four: **Files** (its Dock link opens straight to the résumé — the iOS résumé fast path, `RES-IDIOM-01`) ·
**Safari** · **GitHub** · **Mail**.

## Anatomy
Rounded plate inset 12 pt from the sides and 8 pt above the home-indicator area, radius 30 pt, material `thin`
(blur + saturate; solid tint on T0), height 92 pt; four 60 pt icons evenly spaced, **no labels** (names via accessible
name), badges as on the grid. No running indicators (iOS has none).

## Behaviour & states
- Tap → dim → flight open from the Dock icon's rect; return flight targets the same Dock icon.
- Long-press → quick actions (`quick-actions.md`); for Files: "Open Résumé" · "Download Résumé" · "Experience".
- The Dock does not page with the grid (it is outside the scroll-snap container).
- While an app is open the Dock scales/dims with the Home Screen.

## Navigation & routes
Links: `/ios/files/resume`, `/ios/safari`, `/ios/github`, `/ios/mail`.

## Motion
Shares the Home Screen's arrival fly-in (Dock rises 24 pt with spring r 0.5 ζ 0.9). Press dim 80/200 ms.

## Responsive
Phone landscape: the plate moves to the **trailing edge**, vertical, icons stacked. **Pad:** a **floating Dock**
centred at the bottom, width fits content, holds the four plus a divider and up to 3 **recent apps** (from the warm
set). Laptops/desktops: same floating Dock at the bottom of the full page; icon size follows the grid.

## Accessibility
`nav[aria-label="Dock"] > ul > li > a`; names "Files, Résumé", "Safari", "GitHub", "Mail, 1 unread"; roving
Left/Right (Up/Down in landscape); reachable from the grid with Down from the last row. 60 pt icons ⇒ targets ≥ 44 pt.

## Edge cases
Pad recent-apps section empty → divider hidden. Rotation mid-flight → retarget to the Dock icon's new rect.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `IOS-DOCK-01` | Frosted plate with four apps as links, no labels, badges | `e2e: present on every page; W2 links work` | P5 |
| `IOS-DOCK-02` | Files in Dock = résumé fast path | `e2e: Q1 on iOS from the Dock` | P5 |
| `IOS-DOCK-03` | Flight origin/return targets the Dock icon | `e2e: I1 from the Dock` | P5 |
| `IOS-DOCK-04` | Landscape trailing-edge + pad floating Dock with recents | `e2e: iphone-landscape + ipad projects` | P5 |
| `IOS-DOCK-05` | Roving keyboard model + names | `cmp: roving + accessible names` | P5 |

## Not like the others
**Four fixed icons on a frosted plate, no labels, no running state, no magnification** (macOS Dock: magnifies, shows
dots, holds minimized windows; Windows taskbar: pills and previews; Android: a favorites row that is part of the
launcher page with a search bar beneath).
