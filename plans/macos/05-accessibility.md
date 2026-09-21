# macOS / 05 — Accessibility

## Role + requirement refs
macOS-specific semantics, keyboard model and focus behaviour. Policy, primitives, global shortcuts and the focus
rules are owned by `shared/09-accessibility.md`. R43.

## Landmark structure (DOM order = reading order)
1. "Skip the OS: plain portfolio" link
2. `<header>` Menu bar (`role="menubar"` + "Status menus" group)
3. `<main>`: visually hidden `<h1>` "macOS — Jaswanth's portfolio" → Desktop (`ul` of links) → open windows in
   **open order** (each `<section aria-labelledby>` with an `h2`)
4. `<nav aria-label="Dock">`
5. `role="status"` notification region (present from mount)

Stacking is `z-index` only — the DOM never reorders on focus.

## Semantics map (macOS rows; shared rows not repeated)

| Surface | Element / role | Name | Keyboard |
|---|---|---|---|
| Traffic lights | `group` "Window controls" with three `<button>`s + window-menu button | "Close Finder", "Minimize Finder", "Zoom Finder" / "Restore Finder" | Tab; glyphs on focus-visible |
| Finder columns | `ul` of links per column, roving | row text | Up/Down, Right/Enter drill, Left back |
| Finder list view | `<table>` with header buttons | `aria-sort` | Tab to headers, Enter sorts |
| Quick Look / sheets | modal `dialog` scoped to the window | title | Esc closes → invoker |
| Spotlight | modal `dialog` + combobox/listbox | "Spotlight Search" | per `shared/15` |
| Mission Control | modal `dialog` + `ul` of buttons | "{App} — {title}" | arrows, Enter, Delete closes |
| VS Code Explorer | APG `tree` | file names | arrows, type-ahead |
| Tabs (Safari, GitHub, VS Code) | APG `tablist` | tab titles | arrows, Home/End |
| Control Center | non-modal popover of switches | control labels | Tab, Space |
| Lock screen | `main` + "Enter macOS" button + `ul` of links | full text | Enter / Esc |

## Keyboard journeys that must work without a pointer (M1)
Open Finder from the Dock → drill to a role → Quick Look → close → open GitHub via Spotlight → read a project →
minimize → restore from the Dock → move and size a window via the window menu → zoom → close → open résumé from the
menu bar → switch OS from the Apple menu.

## Focus specifics
- Opening from the Dock: focus → window section; Finder focuses its first sidebar item only on keyboard open.
- Closing the last window: focus → the app's Dock icon. Minimize: focus → its Dock tile.
- Menus/context menus: focus returns to the invoking title/item.
- Compact mode: hidden windows are `hidden`; the visible window + menu bar + Dock are the only tab stops.
- Boot/lock: boot takes no focus; lock focuses "Enter macOS".

## Contrast and preferences
Inactive-window text stays ≥ 4.5:1 (only the title dims, never body text). Vibrancy surfaces use scrim tokens.
"Increase contrast" → solid surfaces, 1 px strong borders, always-visible traffic-light glyphs, no wallpaper tinting.
`forced-colors`: windows get `CanvasText` borders; accent → `Highlight`.

## Screen-reader script (macOS part of the release script)
VoiceOver + Safari and NVDA + Chrome: landmarks list shows header/main/Dock; windows appear as regions with
headings; opening/closing windows announces via focus move (no extra live chatter); banners announce once.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `MAC-A11Y-01` | Landmark structure + DOM order = open order | `e2e: X2 ARIA snapshot of the macOS shell` | P2 |
| `MAC-A11Y-02` | macOS semantics map rows | `e2e: X1 axe clean on home, Finder, Spotlight open, Mission Control open` | P3 |
| `MAC-A11Y-03` | Keyboard-only journey M1 | `e2e: M1 passes with focus never on body` | P3 |
| `MAC-A11Y-04` | Focus specifics (Dock icon/tile targets, menus return focus) | `e2e: focus target assertions after each action` | P3 |
| `MAC-A11Y-05` | Increase contrast / forced-colors rendering | `e2e: forced-colors project legible; glyphs visible` | P3 |
| `MAC-A11Y-06` | Screen-reader script recorded for release | `release: VoiceOver + NVDA notes in the deviations/evidence column` | P8 |

## Not like the others
A `menubar` landmark exists only here. Window controls are three named buttons on the left (Windows: three caption
buttons on the right + a system menu; mobile OSes have no window controls, only Back/Home).
