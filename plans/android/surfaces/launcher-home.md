# Android / surfaces — Launcher home (with At-a-glance)

## Role + requirement refs
The Pixel-style home screen: At-a-glance, a sparse icon grid, the favorites row and the search bar — with the drawer
underneath. R20, R25.

## Portfolio mapping
- **At-a-glance** (top-left, 2 lines): line 1 = "{weekday}, {month} {day}" · line 2 = a **smart chip** "Résumé ready ·
  Open" (résumé fast path, `RES-IDIOM-01`). When a continuity offer exists, line 2 becomes "Continue: {title}"
  (`shared/16`).
- **Grid:** a few deliberate icons only (a pinned **Résumé** shortcut — the PDF badged with Files · Keep · Settings ·
  "Career" folder of Files shortcuts) — the rest live in the drawer; GitHub is in the favorites row. Layout is
  configuration. Phones follow the Pixel launcher: At-a-glance at the top, the grid low above the favorites row, the
  Google search bar at the very bottom; the favorites row is part of Home and never shows over an open app.
- **Favorites row + search bar:** see `favorites-dock.md`.

## Anatomy
Grid 4 columns × 5 rows of 48 dp icons in ≥ 72 dp cells, labels 12 sp (Label-M, 1 line, white with shadow scrim).
At-a-glance occupies the first two rows' left area (tap targets ≥ 48 dp). A **page indicator** (thin line segment,
not dots) appears only while paging (one page in v1 → hidden). A subtle **drawer handle hint** (small chevron-up)
sits above the favorites row and is a real button "All apps".

## Behaviour & states
| Interaction | Behaviour |
|---|---|
| Tap icon | Ripple → container transform (`AND-LIFE-01`) |
| Long-press icon | App shortcuts popup (`app-shortcuts.md`) |
| **Swipe up anywhere on home** | Opens the **app drawer** interactively (`app-drawer.md`); alternative: "All apps" button, Alt+Shift+A is **not** used (reserved) → the button + search |
| Swipe down on home | Opens the notification shade (Pixel behaviour); alternative: status-bar button |
| Tap At-a-glance date | Opens the shade's calendar-less summary (no-op in v1 → it focuses the chip) |
| Tap the résumé chip | Opens `/android/files/resume` |
| Tap folder | M3 folder popup: tonal rounded panel (28 dp) that grows from the folder icon; items are links; Back/outside closes |
| Long-press empty area | Popup: Wallpaper & style (→ Settings) · Home settings (→ Settings) · `EGG-SHAKE-01` after 2 s |

## Navigation & routes
`/android`. Icons are links via `KernelLink`. Drawer/shade/folder are transient (no history) — but **Back closes
them** (hierarchical Back, transient arbitration).

## Motion
Arrival fade-through. Folder popup: container transform from the folder icon, 300 ms emphasized. No wallpaper zoom.

## Responsive
Phone landscape: favorites row moves to the trailing side, search bar stays at the bottom. **Pad:** 6 × 5 grid,
At-a-glance wider, **taskbar-style dock** (favorites + drawer button) at the bottom. **Laptops/desktops — full page,
no device frame:** the launcher fills the whole viewport — At-a-glance top-left, search bar top-centre, 7 / 8-column
viewport-sized grid centred with margins, full-width taskbar with Back / Home / Recents (`04-responsive.md`).

## Accessibility
Grid = `ul` of links, roving 2-D; At-a-glance = `group` with `<time>` (not live) + the chip as a link; "All apps"
button; folder = `button[aria-haspopup="dialog"]` → modal `dialog` with a `ul` of links. Launcher is `inert` while an
app is open. Labels on wallpaper use the shadow scrim token.

## Edge cases
Rotation → grid reflows; icons keep order. Folder item target removed → omitted at build. Reduced motion → no
arrival animation.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `AND-HOME-01` | Sparse configured grid + At-a-glance with résumé/continuity chip | `cmp: chip derives from data; continuity swaps line 2` | P6 |
| `AND-HOME-02` | Swipe-up drawer / swipe-down shade with visible button alternatives | `e2e: A1 both gestures + both buttons` | P6 |
| `AND-HOME-03` | M3 folder popup (container transform, Back closes) | `e2e: open, Back closes, item opens app` | P6 |
| `AND-HOME-04` | Roving keyboard grid + semantics | `cmp: roving; X1 axe clean on home` | P6 |
| `AND-HOME-05` | Phone landscape + full-page layouts (tablet, laptop, desktop — taskbar, no frame) | `e2e: pixel-landscape, tablet, chromium-desktop; launcher spans the viewport` | P6 |
| `AND-HOME-06` | Empty-area long-press popup | `e2e: opens Settings pages` | P6 |

## Not like the others
A **sparse home with At-a-glance on top and the full app list hidden in a drawer** (iOS: every app on a dense paged
grid, widgets as rounded blocks, Search pill). Swiping **down** on the home opens the shade; swiping **up** opens
the drawer.
