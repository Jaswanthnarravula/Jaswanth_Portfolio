# Android / surfaces — App drawer

## Role + requirement refs
The full list of apps, pulled up from the home screen, with search on top. It is also the Android skin of system-wide
search (`shared/15-system-search.md`). R20, N11.

## Portfolio mapping
All Android apps A–Z; a **suggestions row** (top 4: Files/Résumé · GitHub · Gmail · Chrome); search covers every
`SearchEntry` kind (apps, projects, roles, skills, actions).

## Anatomy
A sheet covering the screen: `surface-container-low`, top corners 28 dp, drag handle. Top: **search field** (56 dp
pill, `surface-container-high`, leading magnifier, placeholder "Search apps and more", trailing ⋮ → "Drawer
settings" no-op hidden). Below: suggestions row (divider under it) → alphabetical 4-column grid (56 dp cells ≥ 72 dp
wide, labels 12 sp) with a fast-scroll letter rail on the right at `medium`+.
**Search results state:** sections as M3 lists — Apps (icon row) · Projects · Experience · Skills · Actions · "Search
the plain portfolio"; each row 56 dp with leading icon, two lines, trailing chevron.

## Behaviour & states
- **Open:** swipe up on home (interactive — sheet tracks the finger, the home fades to the scrim) · "All apps" button
  · tapping the home **search bar** opens the drawer **with the field focused** · Ctrl/Cmd+K · `/`.
- **Close:** swipe down · **Back** (hierarchical: clears a query first, then closes) · Esc · tap the scrim area at the top.
- Tap app → ripple → the app opens; it will return to **centre-bottom shrink** if its icon is not on Home (`AND-LIFE-04`).
- Typing → results replace the grid live; Enter opens the top result; result opens with a container transform from
  its row. Command results → "Try this in Linux" (insert-only, never auto-switch — same rule as iOS).
- Long-press an app → app shortcuts popup.
- No history writes.

## Navigation & routes
Per `shared/15` + mobile push rule.

## Motion
Finger-driven; settle 350 ms emphasized-decelerate (velocity shortens). Grid items fade-through on open (no
per-icon stagger — cheap). Results crossfade 150 ms. Reduced motion: fades.

## Responsive
Phone: full-height sheet; results bounded by `--vvh`; input 16 sp. Pad: sheet is a centred 640 dp column with the
taskbar still visible. Laptops/desktops: same centred column (max 960 dp) over the full page.

## Accessibility
Modal `dialog` "All apps". Field = `Combobox` (grid mode exposes the app list as a `listbox` only while a query
exists; with an empty query the grid is a roving `ul` of links). Count status debounced. Background `inert`. Back/Esc
order is announced implicitly by focus return to the "All apps" button / search bar.

## Edge cases
Swipe up with a folder open → folder closes first. IME composing → match on `compositionend`. No results → friendly
state + plain-portfolio link. Rotation while open → stays open, regrids.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `AND-DRAWER-01` | Interactive swipe-up sheet with suggestions row + A–Z grid | `e2e: A1 open by gesture, button and search bar` | P6 |
| `AND-DRAWER-02` | Search in the drawer = system search skin; results sections | `e2e: S1 on Android` | P6 |
| `AND-DRAWER-03` | **Back clears query, then closes**; Esc same | `e2e: goBack() twice from a query state` | P6 |
| `AND-DRAWER-04` | Apps launched from the drawer return via centre-bottom shrink | `e2e: A1 return animation variant` | P6 |
| `AND-DRAWER-05` | Keyboard-aware results (`--vvh`), pad column | `e2e: pixel keyboard-up; tablet` | P6 |
| `AND-DRAWER-06` | Dialog + combobox/roving semantics | `e2e: X1 with drawer open` | P6 |

## Not like the others
**A drawer exists only on Android**, and it *is* the search surface (iOS: no drawer — Spotlight pull-down; macOS:
Spotlight bar; Windows: Start/Search flyout). Back has a two-step meaning here (clear, then close).
