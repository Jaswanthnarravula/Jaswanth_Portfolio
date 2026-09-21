# Windows 11 / surfaces — Task View

## Role + requirement refs
The window overview and the primary switcher in compact mode. R18, R19, R42.

## Portfolio mapping
None; tiles are titled "{App} — {content title}".

## Anatomy
Acrylic full-workspace backdrop (one live blur surface; wallpaper dimmed) · window tiles in a centred,
non-overlapping grid with **title + app icon above each tile** and a ✕ on hover/focus · a **desktops strip** at the
bottom showing "Desktop 1" only (a single, decorative desktop — "New desktop" is shown disabled with a tooltip
"One desktop is plenty here") · taskbar stays visible.
`compact`: vertical list of large cards with ✕ buttons.

## Behaviour & states
- Invoke: taskbar Task View button · Alt+Shift+O · system-menu entry. Toggle closes.
- Tiles are live DOM moved by `flight()` (windows `inert` during the view). Minimized windows **are included**
  (Windows shows them in Task View), rendered at their restore size.
- Click/Enter a tile → focus (and restore if minimized) → all fly back. ✕ / Delete closes that window and regrids.
- Esc / backdrop click → exit with previous focus.
- Snap groups: two windows snapped ½+½ appear as one grouped tile pair (selecting either restores both).
- Empty: "No open windows" + buttons for File Explorer, GitHub, Résumé.

## Navigation & routes
Selecting another window → `FOCUS_WINDOW` → `go()`. The view itself writes nothing.

## Motion
Enter 333 ms entrance curve; exit 250 ms; regrid on close 167 ms. Reversible. Reduced motion: layout switch + fade.

## Responsive
Grid on `medium`+; card list on `compact`. Packing function shared with macOS Mission Control (`MAC-MC-01`) — same
pure function, different skin and inclusion rule (minimized windows included here).

## Accessibility
Modal `dialog` "Task View" with a `ul` of buttons; arrows rove; Enter selects; Delete closes (✕ is the visible
alternative); Esc exits; background `inert`. The disabled "New desktop" is `aria-disabled` with its explanation.

## Edge cases
Window closes itself while in view → regrid. Rotation → re-pack. Task View opened with Start open → Start closes first.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `WIN-TV-01` | Overview grid incl. minimized windows; titles above tiles; ✕ per tile | `e2e: N2 tiles = all windows incl. minimized` | P4 |
| `WIN-TV-02` | Select / close / exit; reversible animation; snap groups | `e2e: closing a tile regrids; snapped pair restores together` | P4 |
| `WIN-TV-03` | Compact card list as the primary switcher | `e2e: N3 switch + close` | P4 |
| `WIN-TV-04` | Dialog semantics + keyboard model | `e2e: X1 with Task View open; keyboard-only switch` | P4 |
| `WIN-TV-05` | Decorative single-desktop strip + empty state | `cmp: disabled New desktop explains itself` | P4 |

## Not like the others
Acrylic backdrop, **titles above tiles**, minimized windows **included**, a virtual-desktops strip (macOS Mission
Control: dimmed wallpaper, titles below, minimized windows excluded, Dock visible; mobile OSes use card carousels).
