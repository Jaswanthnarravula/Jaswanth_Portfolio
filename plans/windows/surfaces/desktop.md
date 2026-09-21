# Windows 11 / surfaces — Desktop

## Role + requirement refs
The wallpaper plane with desktop shortcuts, selection and a context menu. R18, R25.

## Portfolio mapping
Shortcuts aligned from the **top-left**, column-first, snapped to a grid:

| Icon | Kind | Opens |
|---|---|---|
| This PC | system | `/windows/explorer` |
| Résumé.pdf | document | `/windows/edge/resume` |
| Projects | shortcut (arrow overlay) | `/windows/github` |
| Experience | folder | `/windows/explorer/experience` |
| About Jaswanth | Edge shortcut | `/windows/edge` |
| Recycle Bin | decorative | — (labelled decorative, not focusable) |

## Anatomy
Grid cell 76 × 96 px, 48 px icon, 12 px label (2 lines, white with shadow scrim), 4 px margin from the top-left.
Shortcut items carry the small arrow overlay. Selection: translucent rounded tile (accent 18 % fill, 1 px accent
35 % stroke, 4 px radius). Marquee: accent 20 % fill + 1 px stroke.

## Behaviour & states
- Fine pointer: click selects; double-click opens; **Enter opens**; F2-style rename is not offered.
- Coarse pointer / keyboard-initiated click (`detail === 0`): opens directly.
- Marquee selection on empty desktop (cosmetic selection only). Ctrl+click toggles multi-select (no bulk actions —
  announced as selection only).
- Right-click / long-press / Shift+F10 → desktop or item context menu (`context-menus.md`).
- Items are not draggable (no keyboard alternative → out of scope, `shared/08`).
- Clicking empty desktop clears selection; it does **not** change any app/menu state (there is no global menu bar).

## Navigation & routes
Items are links via `KernelLink`; opening follows `WIN-WM-01`.

## Motion
Selection instant; hover tile fades 83 ms. Marquee on the ticker, no layout writes.

## Responsive
`medium`/touch: tap opens, 56 px icons. `compact`: desktop icons become a 4-column grid under the top safe area,
tap opens; marquee disabled. Icons never sit under the taskbar.

## Accessibility
`ul` "Desktop" of links, roving 2-D arrows (column-first order matches the visual order), type-ahead, Home/End.
Label contrast via the text-shadow scrim token.

## Edge cases
Maximized/snapped windows cover icons → in compact mode the desktop is `inert` while a window is visible. Short
viewport → columns wrap rightwards.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `WIN-DESK-01` | Wallpaper + top-left grid of data-driven shortcuts as links | `e2e: W2 links without JS; N2 double-click opens from the icon rect` | P4 |
| `WIN-DESK-02` | Selection tile, marquee, Ctrl+click multi-select (cosmetic) | `e2e: N2 selection visuals; perf: no Layout during marquee` | P4 |
| `WIN-DESK-03` | Select vs open by pointer type; Enter opens | `e2e: keyboard open` | P4 |
| `WIN-DESK-04` | Roving keyboard grid in column-first order | `cmp: arrow order matches visual order` | P4 |
| `WIN-DESK-05` | Compact/touch variants | `e2e: N3` | P4 |

## Not like the others
Icons start at the **top-left**, snap to a grid, use a **translucent selection tile** and shortcut arrows (macOS:
top-right, label pill selection, no arrows).
