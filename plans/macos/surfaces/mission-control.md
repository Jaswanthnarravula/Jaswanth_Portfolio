# macOS / surfaces — Mission Control (window overview and app switcher)

## Role + requirement refs
An overview of every open window for fast switching — and **the** window switcher in compact mode, where only one
window is visible at a time. R17, R25, R42.

## Portfolio mapping
None directly; each tile is titled with the app and the content it shows ("GitHub — portfolio-os").

## Anatomy
Wallpaper dims (scrim 35 %) · open (non-minimized) windows shrink into a non-overlapping grid of tiles that keep
their aspect ratio · each tile: app icon badge + title below · minimized windows in a smaller row near the Dock ·
Dock and menu bar stay visible. `compact`: a vertical carousel of cards (one per window, 70 % height), swipe or
arrows to move, tap to choose, a ✕ on each card to close.

## Behaviour & states
- **Invoke:** Alt+Shift+O · menu bar → Window → Mission Control · three-finger-swipe is **not** implemented
  (gesture-only, conflicts with browsers) · in compact mode a dedicated Dock button "Windows".
- Tiles are produced by `flight()` from each window's current rect to its grid rect (live DOM is transformed, not
  screenshotted; windows are `inert` while in overview).
- Hover/focus → accent ring + title emphasis. Click/Enter → that window becomes focused and all windows fly back.
- Esc or clicking empty space → exit with the previous focus.
- No windows open → overview shows "No open windows" + shortcuts to Finder, GitHub, Résumé.

## Navigation & routes
Selecting a different window → `FOCUS_WINDOW` → `go()` (collapses if it was the previous entry). Entering/exiting
the overview writes nothing.

## Motion
Enter/exit 420 ms `0.3,0,0.1,1`, all tiles simultaneously (single ticker pass); scrim fades 200 ms. Reversible
mid-flight. Reduced motion: instant layout switch with a 150 ms crossfade.

## Responsive
`expanded`/`large`: grid. `medium`: grid with larger hit areas. `compact`: carousel (above). Layout computed by a
pure packing function (`unit`-tested) from window rects → tile rects.

## Accessibility
Overview is a modal `dialog` "Mission Control" containing a `ul` of buttons (name = "{App} — {title}"); roving
arrows, Enter selects, Delete/Backspace closes the focused window (with the ✕ button as the visible alternative),
Esc exits. Background `inert`.

## Edge cases
Window opened/closed while overview is active → regrid with a short retarget. Rotation in overview → re-pack.
Eight windows on a small laptop → tiles shrink to a minimum of 180 px wide then the grid scrolls.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `MAC-MC-01` | Overview grid from live windows via flight (pure packing function) | `unit: packing never overlaps; e2e: M2 tiles match open windows` | P3 |
| `MAC-MC-02` | Select / exit / reversible animation | `e2e: M2 Esc mid-flight returns windows to their rects` | P3 |
| `MAC-MC-03` | Compact carousel as the primary switcher + close buttons | `e2e: M3 switch and close from carousel` | P2 |
| `MAC-MC-04` | Keyboard model + dialog semantics | `e2e: M1 Alt+Shift+O, arrows, Enter` | P3 |
| `MAC-MC-05` | Empty state with shortcuts | `cmp: no windows → shortcuts rendered` | P3 |

## Not like the others
Windows spread over the **dimmed wallpaper with the Dock still visible** (Windows Task View: tiles on an acrylic
backdrop with virtual desktops strip at the bottom; iOS: horizontal card stack app switcher; Android: Recents
carousel with a "Clear all").
