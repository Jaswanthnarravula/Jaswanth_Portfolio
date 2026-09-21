# iOS / surfaces — Folders

## Role + requirement refs
A Home Screen folder that groups related shortcuts — used where it helps discovery, not as decoration. R14.

## Portfolio mapping
One folder, **"Career"**, containing deep shortcuts into Files (each is a link to a Files location):
**Experience** (`/ios/files/experience`) · **Education** (`/ios/files/education`) · **Résumé**
(`/ios/files/resume`) · one shortcut per current/most-recent role (`/ios/files/experience/{slug}`, max 2).
Shortcut icons are generated (Files glyph on a tinted squircle + a small symbol) via the asset manifest's parametric
originals — identical in both asset modes (they are our own shortcuts, not third-party apps).

## Anatomy
- **Closed:** a squircle with material `regular` showing a 3 × 3 mini-grid of the first nine items; label "Career".
- **Open:** the folder **expands from its icon** into a centred rounded panel (radius 38 pt, material `thick`,
  ≈ 86 % width), title "Career" above (34 pt bold), a 3 × 3 grid of 60 pt icons with labels inside; the Home Screen
  behind blurs and dims (one blur surface).

## Behaviour & states
- Tap the folder → opens (flight from the folder icon rect; mini-icons morph to full icons).
- Tap an item → the target app opens **from that item's rect**; on Home, the return flight targets the **folder
  icon** if the folder is closed (rule in `IOS-FLIGHT-02`).
- Tap outside / swipe down / Esc / Home indicator → closes back into its icon.
- More than 9 items → paging inside the folder (not needed for v1, supported by the component).
- Folder title is not editable (no rename mode).

## Navigation & routes
Opening/closing a folder writes no history (transient). Items are links.

## Motion
Open spring r 0.42 ζ 0.86, close r 0.50 ζ 0.80 (same as apps — consistent physics). Reduced motion: crossfade.

## Responsive
Pad and laptops/desktops (full page): panel max 520 pt wide, centred over the blurred full-page Home Screen. Landscape
phone: panel height-bound, grid 4 × 2.

## Accessibility
Folder = `<button aria-haspopup="dialog" aria-expanded>` named "Career folder, 5 shortcuts". Open state = **modal
`dialog`** labelled "Career" containing a `ul` of links (roving 2-D); focus → first item; close returns focus to the
folder button; background `inert`.

## Edge cases
Opened folder while the grid is mid-page-scroll → scroll settles first. Item's target removed from data → the
shortcut is omitted at build. Rotation while open → panel re-centres; origin rect re-measured for the close.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `IOS-FOLD-01` | Closed folder with 3 × 3 mini-grid; data-driven shortcuts | `cmp: shortcuts derive from fixture` | P5 |
| `IOS-FOLD-02` | Open/close flight from/to the folder icon; blurred dimmed backdrop | `e2e: I2 open, close by tap-outside and Esc` | P5 |
| `IOS-FOLD-03` | Item opens app from its rect; return targets the folder icon | `e2e: I2 return flight lands on the folder` | P5 |
| `IOS-FOLD-04` | Dialog semantics, focus in/out, inert background | `e2e: X1 with folder open` | P5 |

## Not like the others
A folder **expands from its icon into a blurred panel** holding shortcuts (Android folders are small Material popups
with tonal background and no blur; desktops use real file-manager windows instead).
