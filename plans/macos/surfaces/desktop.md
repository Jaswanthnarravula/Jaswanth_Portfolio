# macOS / surfaces — Desktop

## Role + requirement refs
The wallpaper plane with desktop items, marquee selection and a context menu — the space everything else floats
above. R16, R25.

## Portfolio mapping
Desktop items are shortcuts into content (top-right, column-first like a real Mac):

| Item | Kind | Opens |
|---|---|---|
| `Résumé.pdf` | document | `/macos/preview` |
| `Projects` | folder alias | `/macos/github` |
| `Experience` | folder | `/macos/finder/experience` |
| `About Jaswanth.webloc` | web location | `/macos/safari` |
| `Macintosh HD` | volume | `/macos/finder` |

## Anatomy
Wallpaper layer (`01-identity.md`) · item grid: 64 px icon + 2-line label (12 px, white with text-shadow scrim, max
width 96 px), cell 104 × 100 px, aligned from the top-right, 20 px margin below the menu bar · marquee rectangle
(accent 20 % fill, 1 px accent border).

## Behaviour & states
- **Fine pointer:** click selects (label gets accent pill, icon darkens 20 %); double-click opens; click on empty
  desktop clears selection and focuses Finder (menu bar shows Finder).
- **Coarse pointer / keyboard:** single tap / Enter opens (a keyboard-initiated click has `detail === 0`).
- **Marquee:** drag on empty desktop draws the rectangle and selects intersecting items (visual + `aria-selected`
  equivalent via visually hidden text); purely cosmetic beyond selection — no bulk actions.
- Items are **not draggable/rearrangeable** (would need a full keyboard alternative; out of scope — `shared/08`).
- Right-click / long-press / Shift+F10 → desktop or item context menu (`context-menus.md`).
- Open animation originates from the item's rect (`MAC-WM-01`).

## Navigation & routes
Items are real links (`<a href>`, `KernelLink`); opening follows the window-manager history rules.

## Motion
Selection is instant. Marquee follows the pointer on the ticker (transform + size via `clip-path` on a fixed
full-size layer — no layout writes).

## Responsive
`compact`: items become a single column on the right with 44 px targets; marquee disabled (coarse pointer).
`medium` (touch): tap opens. Items never sit under the Dock (grid height accounts for it).

## Accessibility
`ul` "Desktop" of links with roving tabindex (2-D arrows by visual columns, Home/End, type-ahead). Marquee has no
keyboard equivalent because it has no function beyond selection; Ctrl/Cmd+A selects all (announced). Label
contrast guaranteed by the text-shadow scrim token (`DS-SCRIM-01`).

## Edge cases
Window covering items → items remain in tab order (desktop is a landmark region) but are skipped when a window is
maximized in compact mode (`inert`). Viewport shorter than the item column → wraps to a second column.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `MAC-DESK-01` | Wallpaper + data-driven desktop items as links | `e2e: W2 items are links; M2 double-click opens from the item rect` | P2 |
| `MAC-DESK-02` | Select vs open by pointer type; keyboard opens immediately | `e2e: M1 Enter opens; fine pointer single click only selects` | P3 |
| `MAC-DESK-03` | Marquee selection, no layout writes | `perf: no Layout during marquee drag` | P3 |
| `MAC-DESK-04` | Roving 2-D keyboard navigation + type-ahead | `cmp: IconGrid single tab stop, 2D arrows` | P3 |
| `MAC-DESK-05` | Empty-desktop click focuses Finder in the menu bar | `e2e: M2 menu bar app name returns to Finder` | P3 |
| `MAC-DESK-06` | Compact/touch variants | `e2e: M3 single column, tap opens` | P3 |

## Not like the others
Items align from the **top-right** with labels on a shadow scrim and a blue marquee (Windows: top-left, grid-snapped,
selection as a translucent rounded tile). Mobile OSes have no desktop at all — they have a home grid of apps.
