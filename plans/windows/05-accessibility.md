# Windows 11 / 05 — Accessibility

## Role + requirement refs
Windows-specific semantics, keyboard model and focus behaviour. Policy, primitives, global shortcuts and focus
rules: `shared/09-accessibility.md`. R43.

## Landmark structure (DOM order = reading order)
1. "Skip the OS: plain portfolio" link
2. `<main>`: hidden `<h1>` "Windows 11 — Jaswanth's portfolio" → Desktop (`ul` of links) → windows in **open order**
   (`<section aria-labelledby>` + `h2`)
3. `<nav aria-label="Taskbar">` (includes the "System tray" group) — last in DOM, matching its visual position
4. `role="status"` toast region (present from mount)
There is no banner/menubar landmark on Windows (menus are inside windows).

## Semantics map (Windows rows)

| Surface | Element / role | Name | Keyboard |
|---|---|---|---|
| Caption buttons | `group` "Window controls": Minimize · Maximize/Restore (name swaps) · Close | "Close File Explorer" | Tab |
| System menu | title-bar icon `button[aria-haspopup=menu]` → `Menu` | "Window menu" | Enter/Space; Move/Size/Snap submenus |
| Snap layouts flyout | `dialog` "Snap layouts" with a `group` of zone buttons | "Snap left half" … | appears on **focus** of Maximize after 400 ms and via system menu; arrows + Enter |
| Snap preview | purely visual; status says "Release to snap left" | — | keyboard path is the system menu / Alt+Shift+Arrow |
| Start | non-modal `dialog` (modal in compact) with search combobox, grid, list, footer | "Start" | Tab regions, arrows, Esc |
| Search | modal `dialog` + combobox/listbox + chips `radiogroup` | "Search" | per `shared/15` |
| Taskbar preview flyout | `ul` of buttons reachable with Down from the app button | "{App} — {title}" | Enter focuses, Delete closes |
| Quick Settings | popover of `button[aria-pressed]` tiles + native range | tile names | Tab/Space |
| Notification Center | labelled region; calendar `grid` | — | arrows in the grid |
| In-window menubars (VS Code) | `role="menubar"` | — | APG |
| NavigationView | `nav` list, `aria-current="page"` | page names | arrows/Tab |
| Details list (Explorer) | `<table>` + header buttons `aria-sort` | — | arrows select rows, Enter opens |
| InfoBar | `role="status"` (or `alert` only for blocking errors) | text | — |

## Keyboard journey that must pass without a pointer (N-keyboard)
Open Start → type "exp" → open File Explorer at Experience → sort by Dates → open a role → Alt+Shift+Arrow snap left
→ open GitHub from the taskbar → snap right via the system menu → Task View → switch → minimize via the taskbar
(active click) → restore → Quick Settings: toggle animations → open résumé from the taskbar → close → Start → power →
Switch operating system.

## Focus specifics
Close: next topmost window → else the app's taskbar button → else the desktop's roving item. Minimize → taskbar
button. Start/Search/flyouts return focus to their invoker. Snap commit keeps focus in the window. Compact: hidden
windows are `hidden`; taskbar + visible window are the tab stops.

## Contrast and preferences
"Contrast themes" → solid surfaces, 2 px borders, system colours in `forced-colors`; Acrylic/Mica disabled; accent →
`Highlight`. Inactive title text stays ≥ 4.5:1. Pill indicators have a shape difference (width), not colour only.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `WIN-A11Y-01` | Landmark structure + DOM order | `e2e: X2 ARIA snapshot of the Windows shell` | P4 |
| `WIN-A11Y-02` | Windows semantics map rows | `e2e: X1 axe clean on home, Explorer, Start open, Search open, Task View open` | P4 |
| `WIN-A11Y-03` | Keyboard-only journey incl. Snap by keyboard | `e2e: N-keyboard passes; focus never on body` | P4 |
| `WIN-A11Y-04` | Focus specifics | `e2e: focus assertions after each action` | P4 |
| `WIN-A11Y-05` | Contrast themes / forced-colors rendering | `e2e: forced-colors project legible` | P4 |
| `WIN-A11Y-06` | Screen-reader script recorded for release | `release: NVDA + Narrator-equivalent notes in evidence` | P8 |

## Not like the others
No `menubar` landmark at shell level; the taskbar `nav` comes **last** in the DOM; Snap has a complete keyboard path
(no other OS has Snap at all).
