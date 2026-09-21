# iOS / 04 — Responsive

## Role + requirement refs
How iOS is designed for phones, tablets and laptops. Classes, units, safe areas, gesture ↔ alternative inventory:
`shared/08-responsive.md`. R42, D, north-star B12, **B17**.

## Owner decision (2026-09-21): the page *is* the screen
**There is no phone frame, device mock-up or bezel at any size.** iOS always fills the entire browser viewport, the
way macOS and Windows do. On a laptop the visitor sees a full-page iOS Home Screen — wallpaper edge to edge, icons,
widgets and the Dock laid out across the whole page — not a narrow phone in the middle of an empty backdrop.

## Two layouts, one DOM, both full page
A container query on the shell root chooses **`phone`** (`compact`) or **`full-page`** (everything larger). The shell
is always `position: fixed; inset: 0; height: 100dvh` — there is no wrapper, frame or backdrop around it.

### 1. Phone (`compact`) — the visitor's phone *is* the iPhone
- **Real** safe-area insets via tokens (`viewportFit: 'cover'`).
- **No drawn notch / Dynamic Island / bezel** (the device has its own).
- Grid 4 × 6, Dock plate, status bar within `--sa-t`, Home indicator above `--sa-b`.
- Horizontal gestures start ≥ 24 px inside the screen edge so the browser's own back-swipe is untouched; the in-app
  edge-swipe-back therefore begins at 24 px (and the chevron is always available).
- Landscape: grid 6 × 3, Dock on the trailing edge, status bar hidden with top-corner handles.

### 2. Full page (`medium` / `expanded` / `large` — tablets, laptops, desktops) — iOS at page size
iOS on a large screen uses the **iPadOS idiom**, because that is what iOS looks like at this size. The iPhone's
4-column grid is never stretched across a landscape page, and never shrunk into a frame.

| Element | Full-page spec |
|---|---|
| Wallpaper | Covers the whole page (`100lvh`, `object-fit: cover`), both orientations; depth per `01-identity.md` |
| Status bar | Across the full width, 24 pt: **time + date** left (`9:41  Mon 21 Sep`), Wi-Fi + battery right; no cut-out |
| Icon size | Derived from the viewport so rows always fit: `clamp(64px, 8.4vh, 96px)`; labels 13 px |
| Grid | Columns: 6 (`medium`), 7 (`expanded`), 8 (`large`); rows fit the height (4–5); overflow flows to page 2 deterministically. The grid is centred with a max width of `columns × 2.1 × icon size`, so ultra-wide screens gain margin, not stretched gaps |
| Widgets | Leading block, 2 columns wide: **Résumé widget (large)** on top, "Open to work" + "Projects" (small) below |
| Dock | Floating, centred at the bottom: 4 pinned apps · divider · up to 3 recent apps; icon size = grid icon size |
| Search pill / page dots | Centred just above the Dock |
| Home indicator | Bottom-centre pill, `clamp(134px, 12vw, 220px)` wide |
| Apps | Open **to the full page** — the icon flight ends at the viewport rect with 0 corner radius (`02-app-lifecycle.md`). Apps use their wide layouts: sidebars and split views (each app file's "Pad" section). **One app at a time** — no floating windows or Stage Manager, which would blur iOS into macOS |
| Sheets | Centred form sheets, max 720 px wide, background scaled 0.94 + dimmed |
| Control Center · Notification Center · Spotlight | Top-right panel · full-page pull-down · field at the top-centre with a 640 px results column |

Portrait tablets use the same layout with the grid re-flowed (fewer columns, more rows).

### Pointer adaptations (fine pointer — laptops and desktops)
- iPadOS pointer behaviour: hovering an icon lifts it slightly on a soft platter (cursor: pointer); list rows and
  buttons get a hover fill. Hover never reveals anything that isn't also reachable by click or keyboard.
- Click = tap; click-and-drag = swipe (paging, sheets, the Home gesture); **wheel / trackpad** scrolls pages and lists;
  right-click = long-press (quick actions); the keyboard is fully supported.

### Visible, non-gesture system controls (replaces the former "helper rail")
Nothing is gesture-only, and no control lives outside the OS:
- **Home** — the Home indicator is a real button; on hover it thickens and shows a tooltip "Home · hold for App
  Switcher". Also Esc (back one level) and Alt+Shift+H.
- **App Switcher** — long-press the Home indicator, the **App Switcher module in Control Center**, or Alt+Shift+O.
- **Recent apps** — the Dock's recents section switches in one click.
- **Switch OS** — Control Center module, Settings row, Spotlight action, Alt+Shift+S.

## Safe areas and viewport
All chrome reads `--sa-*` tokens; tests override them. `100dvh` shell; sheets and Spotlight bound by `--vvh`.

## Rotation / resize
Grid reflows deterministically (`IOS-HOME-07`); in-flight app flights retarget to re-measured rects; crossing between
the phone and full-page layouts swaps with a single 150 ms crossfade and preserves the foreground app + its nav stack.
Resizing a desktop browser window re-derives icon size, columns and rows live.

## Virtual keyboard
`interactiveWidget: 'resizes-content'` + `visualViewport` listener → `--vvh`; compose sheets and Spotlight keep their
primary actions above the keyboard; all inputs ≥ 16 px (no iOS focus zoom); accessory actions never sit under it.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `IOS-RESP-01` | Phone full-bleed: real safe areas, no drawn notch, 24 px edge rule | `e2e: iphone project; safe-area override; edge-swipe starts inside 24 px` | P5 |
| `IOS-RESP-02` | Phone landscape layout | `e2e: iphone-landscape` | P5 |
| `IOS-RESP-03` | Full-page layout on tablets: viewport-derived grid, widgets block, floating Dock with recents, split views, panels | `e2e: ipad-portrait + ipad-landscape` | P5 |
| `IOS-RESP-04` | **Full page on laptops/desktops — no device frame**: wallpaper, status bar, grid and Dock fill the viewport; icon size and columns from the viewport; apps open to the full page | `e2e: chromium-desktop at 1440×900 and 1920×1080 — shell rect = viewport, opened app rect = viewport, no frame/bezel element, no scale transform` | P5 |
| `IOS-RESP-05` | Pointer adaptations + visible non-gesture system controls (hover platter, click-drag swipe, wheel, right-click quick actions; Home indicator button, App Switcher in Control Center) | `e2e: mouse-only journey reaches Home, App Switcher, recents and Switch OS with no gestures` | P5 |
| `IOS-RESP-06` | Layout swaps preserve foreground app + stack | `e2e: O1 across phone ↔ full page` | P5 |
| `IOS-RESP-07` | Keyboard-safe sheets and search | `e2e: L3-style visualViewport shim on Mail compose + Spotlight` | P5 |

## Not like the others
iOS **fills the page at every size** — the iPhone layout on phones, the iPadOS layout on anything larger, never a frame.
It stays an icon grid with a floating Dock and **one app at a time**, so even full-page it cannot be mistaken for macOS
(overlapping windows, menu bar) or Android (app drawer, taskbar, system Back). macOS and Windows go the other way:
native on large screens, a compact single-window mode on phones.
