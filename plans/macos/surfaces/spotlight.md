# macOS / surfaces — Spotlight

## Role + requirement refs
The macOS skin of system-wide search (`shared/15-system-search.md`): a centred search bar that finds apps,
projects, roles, skills, actions and commands. R16, N11.

## Portfolio mapping
All `SearchEntry` kinds from the shared index. Top hit shows a preview pane built from the matching content view
(`renderText` summary + primary action).

## Anatomy
Centred panel, 680 px wide (max 92 vw), top at 22 % of the workspace, `--material-thick` vibrancy, radius 14 px,
large shadow. Row 1: magnifier glyph + input (24 px text, placeholder "Spotlight Search"). Below (when there is a
query or zero state): results list left (grouped: Top Hit · Applications · Projects · Experience · Skills · Actions
· Terminal), 36 px rows with 20 px icons; preview pane right (hidden < 700 px).

## Behaviour & states
- **Invoke:** Ctrl/Cmd+K · menu-bar magnifier · `/` when no text field is focused · Alt+Shift+Space is *not* used
  (reserved chord risk).
- Opens instantly with the zero state (Résumé · Projects · Contact · recents) while the index chunk resolves.
- Typing filters live (no debounce on matching; result-count announcement is debounced 400 ms).
- Arrow Up/Down moves the active option; Enter opens; Tab moves into the preview's primary action.
- Choosing a result → `OPEN_APP{role, location}` → window opens **from the Spotlight panel's rect** → panel closes.
- Command results ("Run in Terminal") open Terminal with the command **inserted, not executed** (`SRCH-TERM-01`).
- Esc: first press clears the query, second closes. Click outside closes. Focus returns to the invoker.
- Spotlight writes **no history**; the chosen result writes one entry.

## Navigation & routes
Per `shared/15` and `shared/05`: one kernel action + one `go()`.

## Motion
Appear: scale 0.98 → 1 + fade, 120 ms; results height animates with `clip-path` (no layout animation); close fade
100 ms. Reduced motion: instant.

## Responsive
`compact`: full-width sheet pinned to the top (below the menu bar), 44 px rows, no preview pane, list bounded by
`--vvh` so the virtual keyboard never covers results. Input ≥ 16 px.

## Accessibility
Modal `dialog` "Spotlight Search" using `Combobox` + `Listbox`: `aria-activedescendant`, grouped options with
labelled groups, polite status "6 results". Background `inert` while open. Options are real clickable elements.

## Edge cases
No results → "No results for '{q}'" + "Search the plain portfolio" link. IME composition → match on
`compositionend`. Invoked during a window drag → ignored until the drag commits. Opened while a menu is open →
menu closes first.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `MAC-SPOT-01` | Panel with zero state, grouped results, preview pane | `cmp: zero state order; groups labelled` | P3 |
| `MAC-SPOT-02` | Invocation (Ctrl/Cmd+K, menu-bar icon, `/`) and Esc clear-then-close | `e2e: S1 all three invocations; Esc twice closes, focus restored` | P3 |
| `MAC-SPOT-03` | Result opens via kernel from the panel rect; one history entry | `e2e: S1 history length +1` | P3 |
| `MAC-SPOT-04` | Command results insert into Terminal, never execute | `e2e: S1 command remains unsubmitted` | P3 |
| `MAC-SPOT-05` | Compact top sheet bounded by visual viewport | `e2e: M3 results visible with keyboard up` | P3 |
| `MAC-SPOT-06` | Combobox semantics + debounced count | `cmp: Spotlight activedescendant + debounced count` | P3 |

## Not like the others
A **floating centred bar with a preview pane** (Windows: a flyout anchored to the taskbar sharing space with Start;
iOS: pull-down full-screen search with Siri-suggestion-style tiles; Android: a search bar living in the launcher;
Linux: text commands).
