# Android / 04 — Responsive

## Role + requirement refs
How Android is designed for phones, tablets and laptops — following Material's **window size classes and canonical
layouts**. Shared classes/units/safe areas/gesture inventory: `shared/08-responsive.md`. R42, D, north-star B12, **B17**.

## Owner decision (2026-09-21): the page *is* the screen
**There is no phone frame, device mock-up or bezel at any size.** Android always fills the entire browser viewport.
On a laptop the visitor sees a full-page Android launcher — wallpaper edge to edge, At-a-glance, the app grid and the
taskbar across the whole page — not a narrow phone in the middle of an empty backdrop.

## Two layouts, one DOM, both full page
Container query on the shell root → **`phone`** (`compact`) or **`full-page`** (everything larger). The shell is always
`position: fixed; inset: 0; height: 100dvh`, with no wrapper, frame or backdrop.

### 1. Phone (`compact`) — the visitor's phone *is* the Android phone
- Edge-to-edge: content draws behind transparent system bars, padded by `--sa-*` tokens.
- **No drawn punch-hole/bezel.** Status bar within `--sa-t`; navigation bar above `--sa-b`.
- Default **gesture navigation**; Back edge-swipe zones start ≥ 24 px inside the physical edge (browser owns the strip);
  3-button mode available in one tap (Quick Settings).
- Launcher 4 × 5, favorites + search bar; drawer/shade full-height sheets.
- Landscape: favorites on the trailing side; nav bar on the trailing side in 3-button mode.

### 2. Full page (`medium` / `expanded` / `large` — tablets, laptops, desktops) — large-screen Android
Android on a large screen uses the **large-screen (tablet) launcher idiom** that Android itself ships, filling the page.

| Element | Full-page spec |
|---|---|
| Wallpaper | Covers the whole page; its seed colour drives the dynamic scheme (`01-identity.md`) |
| Status bar | Across the full width, 24 dp: time + notification glyphs left, Wi-Fi + battery right; no camera cut-out |
| At-a-glance | Top-left: date + the résumé / continuity chip |
| Search bar | At the **top** of the home, centred, max 720 px (large-screen placement) |
| Icon size | `clamp(56px, 7.6vh, 88px)` — derived from the viewport so rows always fit; labels 13 sp |
| Grid | Columns: 6 (`medium`), 7 (`expanded`), 8 (`large`); rows fit the height; centred with a max width so ultra-wide screens gain margin, not stretched gaps |
| **Taskbar** | Full-width bar along the bottom (`surface-container`, 56 dp): favorites · divider · up to 2 recent apps · **All apps** button; in 3-button mode **Back / Home / Recents** sit at its right end |
| Apps | Open **to the full page** — container transform ends at the viewport rect with 0 radius (`02-app-lifecycle.md`). M3 **canonical layouts**: navigation rail instead of bottom nav, **list-detail** (GitHub, Files, Gmail, Settings), **supporting pane** (PDF viewer info) |
| Drawer · shade · Recents | Centred drawer column (max 960 px) · two-pane shade (Quick Settings left, notifications right) · grid of cards |
| Dialogs / sheets | Centred dialogs and side sheets instead of full-height bottom sheets |

Portrait tablets use the same layout with the grid re-flowed.

### Pointer adaptations (fine pointer — laptops and desktops)
- Default navigation mode = **3-button**, so Back, Home and Recents are always visible buttons in the taskbar.
- Click = tap, with the **ripple starting at the click point**; click-drag = swipe (drawer, shade, sheets); wheel /
  trackpad scrolls; right-click = long-press (app shortcuts); hover shows the 8 % state layer.

### Visible, non-gesture system controls (replaces the former "helper rail")
Back / Home / Recents in the taskbar (3-button mode, the pointer default); **All apps** button in the taskbar; the
status bar is a button that opens the shade; **Switch OS** is a Quick Settings tile, a Settings item and a drawer-search
action. Nothing lives outside the OS and nothing is gesture-only.

## Safe areas and viewport
All chrome reads `--sa-*`; tests override. Sheets/drawer results/compose bound by `--vvh`.

## Rotation / resize
Launcher reflows deterministically; transforms retarget to re-measured rects; swapping between the phone and full-page
layouts uses one 150 ms fade and preserves the foreground app, its stack and Recents. Resizing a desktop browser window
re-derives icon size, columns and rows live.

## Virtual keyboard
`interactiveWidget: 'resizes-content'` (native on Android Chrome) + `visualViewport` fallback → `--vvh`; inputs 16 sp;
Send stays in the top app bar; snackbars rise above the keyboard; **Back closes the IME first** where the platform
reports it (we never fight the browser's own Back-to-close-keyboard behaviour).

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `AND-RESP-01` | Phone full-bleed, edge-to-edge with real insets, no drawn cut-out | `e2e: pixel project; safe-area override` | P6 |
| `AND-RESP-02` | Phone landscape placements | `e2e: pixel-landscape` | P6 |
| `AND-RESP-03` | Full-page layout on tablets: taskbar, top search bar, two-pane shade, **navigation rail + list-detail canonical layouts** | `e2e: tablet portrait + landscape` | P6 |
| `AND-RESP-04` | **Full page on laptops/desktops — no device frame**: wallpaper, launcher and taskbar fill the viewport; icon size and columns from the viewport; apps open to the full page; 3-button default | `e2e: chromium-desktop at 1440×900 and 1920×1080 — shell rect = viewport, opened app rect = viewport, no frame/bezel element, nav mode = 3-button` | P6 |
| `AND-RESP-05` | Pointer adaptations + visible system controls (ripple at the click point, click-drag swipe, wheel, right-click shortcuts; Back/Home/Recents and All apps in the taskbar) | `e2e: mouse-only journey reaches Back, Home, Recents, All apps and Switch OS with no gestures` | P6 |
| `AND-RESP-06` | Layout swaps preserve app, stack and Recents | `e2e: O1 across phone ↔ full page` | P6 |
| `AND-RESP-07` | Keyboard-safe compose/search/snackbars | `e2e: visualViewport shim on Gmail compose + drawer search` | P6 |

## Not like the others
Android also **fills the page at every size**, but its large-screen form is a **taskbar with Back / Home / Recents,
a search bar on top and Material canonical layouts** (rail + list-detail). Full-page iOS has none of these: a floating
Dock, no drawer, no system Back, one app at a time with split views.
