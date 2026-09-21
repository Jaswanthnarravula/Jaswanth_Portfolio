# Windows 11 / surfaces — Search

## Role + requirement refs
The Windows skin of system-wide search (`shared/15-system-search.md`): a flyout anchored to the taskbar that shares
its position with Start. R18, N11.

## Portfolio mapping
All `SearchEntry` kinds. Right pane previews the top/selected result using `renderText` + primary actions.

## Anatomy
Acrylic flyout, same footprint as Start (640 × 720). Top: search box with magnifier (placeholder "Type here to
search"). Filter chips: All · Apps · Projects · Experience · Skills · Actions. Body in two panes: left list
("Best match" card larger, then grouped results, 36 px rows); right **preview pane**: big icon, title, subtitle,
actions (Open · Copy link · Open in plain view), and for projects: stack tags + first highlight.
Zero state: "Quick searches" (Résumé · Projects · Contact) + "Recent".

## Behaviour & states
- **Invoke:** taskbar Search button · typing in Start · Ctrl/Cmd+K · `/` outside text fields.
- Typing in Start **morphs** Start into Search in place (same panel, content crossfade 167 ms — no close/re-open).
- Arrows move selection (preview follows); Enter opens; Right moves focus into the preview actions.
- Result opens via the kernel; the window animates from the flyout rect; the flyout closes.
- Command results → "Run in Terminal" opens Windows Terminal with the command **inserted, not executed**.
- `winver` typed here → `EGG-WINVER-01`.
- Esc: clear, then close → focus returns to the invoker. No history writes by the flyout.

## Navigation & routes
Per `shared/15` / `shared/05`.

## Motion
Same as Start (250 in / 167 out); chip selection underline slides 167 ms. Reduced motion: fades.

## Responsive
`compact`: full-height sheet, single pane (preview becomes an expandable row), list bounded by `--vvh`, input ≥ 16 px.

## Accessibility
Modal `dialog` "Search" with `Combobox` + `Listbox` (grouped, `aria-activedescendant`), debounced count status, chips
as a `radiogroup`. Preview actions are regular buttons after the list in tab order.

## Edge cases
No results → "No results for '{q}'" + plain-portfolio link. IME → match on `compositionend`. Flyout open while
its invoker disappears (compact tray change) → focus falls back to the Start button.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `WIN-SEARCH-01` | Flyout with best match, grouped list, preview pane, chips | `cmp: layout + zero state` | P4 |
| `WIN-SEARCH-02` | Start ↔ Search in-place morph on typing | `e2e: N1 no close/re-open flash` | P4 |
| `WIN-SEARCH-03` | Result opens via kernel from the flyout rect; one history entry | `e2e: S1 on Windows` | P4 |
| `WIN-SEARCH-04` | Command results insert into Terminal; `winver` egg | `e2e: command unsubmitted; EGG-WINVER-01` | P4 |
| `WIN-SEARCH-05` | Compact single-pane sheet bounded by visual viewport | `e2e: N3 keyboard up` | P4 |
| `WIN-SEARCH-06` | Combobox semantics, chips radiogroup, count status | `cmp + e2e X1 with Search open` | P4 |

## Not like the others
**Anchored to the taskbar, shares Start's panel, has filter chips and a right preview pane** (macOS Spotlight: a
floating centred bar; iOS: pull-down full-screen; Android: launcher search bar; Linux: commands).
