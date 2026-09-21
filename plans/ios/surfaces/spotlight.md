# iOS / surfaces — Spotlight

## Role + requirement refs
The iOS skin of system-wide search (`shared/15-system-search.md`): a full-screen search that drops over the Home
Screen. R14, N11.

## Portfolio mapping
All `SearchEntry` kinds. Zero state mimics "Siri Suggestions": a row of 4 suggested apps (Files/Résumé, GitHub, Mail,
Safari) + a "Suggestions" list (Résumé · Projects · Contact).

## Anatomy
Home Screen blurs and dims (one blur surface) · **search field at the bottom** above the keyboard area (iOS 16+
placement: capsule, material `regular`, magnifier, placeholder "Search", Cancel button) · results scroll above it in
grouped **cards** (radius 16 pt, material `thick`): Top Hit (large row with icon + subtitle + chevron) · Applications
(icon row) · Projects · Experience · Skills · Actions · "Search in plain portfolio".

## Behaviour & states
- **Invoke:** pull down on the Home Screen (interactive; the blur and field track the finger until 60 pt) · the Search
  pill · Ctrl/Cmd+K · `/`.
- Zero state is instant; the index chunk loads at idle.
- Typing filters live; Enter opens the top hit; tapping a result opens it with a **flight from the result row**.
- Command results → "Run in Terminal" is **not offered on iOS** (no terminal app); they appear as "Try this in Linux"
  which offers `SWITCH_OS{linux}` with the command inserted — never auto-run, never auto-switch.
- Cancel / swipe down / Esc (clear, then close) → back to Home; focus returns to the Search pill.
- No history writes by Spotlight; the chosen result pushes one entry.

## Navigation & routes
Per `shared/15` and the mobile push rule.

## Motion
Open: blur/dim 0 → 1 and field rise with spring r 0.38 ζ 1 (or finger-driven). Results fade in 120 ms. Close reverses.
Reduced motion: crossfade.

## Responsive
Phone: field bottom-anchored, list bounded by `--vvh` so the keyboard never covers results; input 17 pt (≥ 16 px).
Full page (tablets, laptops, desktops): field top-centre (iPad placement), results in a 640 px column over the
blurred full-page Home Screen; on laptops the
hardware keyboard is assumed (no fake on-screen keyboard is drawn).

## Accessibility
Modal `dialog` "Search" with `Combobox` + `Listbox` (grouped, `aria-activedescendant`), debounced count status,
Cancel button always present, background `inert`.

## Edge cases
No results → friendly empty card + plain-portfolio link. Pull-down while a folder is open → ignored. IME →
`compositionend`. Rotation → field placement switches per layout without losing the query.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `IOS-SPOT-01` | Full-screen Spotlight with bottom field, suggestion zero state, grouped cards | `cmp: zero state + groups` | P5 |
| `IOS-SPOT-02` | Interactive pull-down + pill/shortcut alternatives; Cancel/Esc behaviour | `e2e: I2 all invocations; focus returns to the pill` | P5 |
| `IOS-SPOT-03` | Result opens with a flight from its row; one history entry | `e2e: S1 on iOS` | P5 |
| `IOS-SPOT-04` | Command results offer Linux (insert-only, never auto-switch) | `e2e: no switch without explicit confirm` | P5 |
| `IOS-SPOT-05` | Keyboard-aware list (`--vvh`), pad top placement | `e2e: iphone keyboard-up; ipad layout` | P5 |
| `IOS-SPOT-06` | Combobox semantics | `cmp + X1 with Spotlight open` | P5 |

## Not like the others
**Pull-down, full-screen, bottom search field, suggestion tiles** (macOS: floating centred bar with preview pane;
Windows: taskbar-anchored flyout with chips; Android: launcher search bar that expands into the drawer search).
