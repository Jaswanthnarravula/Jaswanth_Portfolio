# Linux / 10 — Responsive (a terminal on a phone is a design problem, not a scaling problem)

## Role + requirement refs
How the terminal works on phones, tablets and laptops. Shared classes/units/keyboard rules:
`shared/08-responsive.md` (`RESP-KB-01`). R42, D, north-star B12.

## Layouts

| Size class | Layout |
|---|---|
| `expanded` / `large` | Status bar + **terminal tile** on a minimal flat background (12 px gutters); `open` splits in a **viewer tile** to the right. Prompt autofocused. Max terminal width 120 cols (centred beyond that) |
| `medium` | Full-bleed terminal (no gutters); viewer **overlays** as a full tile; status tags switch between them. Accessory row appears when the input is focused **and** the pointer is coarse |
| `compact` | Full-bleed terminal, status bar collapses to `≡` (menu: résumé · help · settings · exit) + clock hidden; title strip shows the cwd and a `résumé` link. `open` → full-screen **pager view** with a visible `Close` button. **Not autofocused** — "tap here to type" |
| `compact` landscape | Title strip hides while the keyboard is up; 2–3 visible output rows are acceptable — the accessory row stays |

## The prompt on touch devices (`LNX-RESP-02`)
- A real `<form>` + `<input>`: `type="text"`, `inputmode="text"`, `enterkeyhint="send"`, `autocapitalize="none"`,
  `autocorrect="off"`, `autocomplete="off"`, `spellcheck="false"`, font-size **16 px** (no iOS focus zoom).
- The keyboard's Go/Send key submits (form submit). Typed text is read from `input.value` on `input` events — never
  assembled from `keydown` (Android IMEs report keyCode 229).
- **Visual viewport:** a rAF-throttled `visualViewport` resize/scroll listener writes `--vvh` / `--vv-top`; the shell
  root is `position: fixed; height: var(--vvh, 100dvh)` so the **prompt always sits directly above the keyboard** and the
  scrollback shrinks instead of being covered. Android Chrome additionally benefits from `interactiveWidget:
  'resizes-content'`.
- Tapping the scrollback does **not** focus the input (it would pop the keyboard while someone is trying to read or
  select); only tapping the prompt line or "tap here to type" does.

## Accessory key row (`LNX-RESP-03`) — above the keyboard, 44 px keys, horizontal scroll if needed
`Tab` · `↑` · `↓` · `←` · `→` · `/` · `~` · `-` · `|` · `Ctrl+C` · `Esc` · `Enter` (duplicate for one-handed use)
- Keys call `preventDefault()` on `pointerdown` so the input **keeps focus** and the keyboard stays up.
- `Tab` runs completion (double-tap lists candidates); `↑/↓` history; `Ctrl+C` cancels the line; `Esc` closes
  pager/viewer/hint.
- Shown only with a coarse pointer + focused input; hidden with a hardware keyboard attached (detected by the first
  physical `keydown` with a non-virtual signature → hides until next focus).

## Touch assists (inserts, never executes)
- **`ls` / `tree` / `projects` entries, MOTD arrows, `search` results and hint chips are tappable**: tapping **inserts**
  the appropriate text at the caret (`cd name/` for directories, `cat name` / `open name` for files — chosen by node
  kind) and focuses the prompt. Rows are ≥ 28 px tall on coarse pointers (44 px for standalone chips).
- Long-press on output → native text selection/copy (never overridden).
- Swipe gestures: **none** (no horizontal gestures to collide with the browser's Back).

## Output on narrow screens
`cols` is measured, so `ls` reduces its column count, tables (`projects`, `ls -l`) switch to a **stacked format** under
50 cols (one field per line, key dimmed), `tree` keeps working, long paths wrap with a hanging indent. Nothing scrolls
horizontally except code-like `pre` blocks inside the viewer.

## Safe areas
Status bar padded by `--sa-t`, prompt/accessory row by `--sa-b`, sides by `--sa-l/r` in landscape.

## Rotation / resize
`cols/rows` recomputed (debounced to commit); in-flight reveal completes; the viewer switches mode
(split ↔ overlay ↔ pager) preserving its content and scroll; the draft text and caret position survive.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `LNX-RESP-01` | Layouts per size class incl. 120-col cap, overlay and pager viewer modes | `e2e: L1 at 1440, 900, 390 px` | P7 |
| `LNX-RESP-02` | Touch prompt: form/input attributes, 16 px, `input`-event reading, no focus on scrollback tap | `e2e: L3 Go key submits; IME simulation; tap scrollback keeps keyboard down` | P7 |
| `LNX-RESP-03` | `visualViewport`-driven layout keeps the prompt above the keyboard | `e2e: L3 simulated visualViewport change keeps the prompt visible` | P7 |
| `LNX-RESP-04` | Accessory key row (keeps focus, completion/history/cancel), hidden with hardware keyboards | `e2e: L3 Tab key completes without losing focus` | P7 |
| `LNX-RESP-05` | Tappable entries insert by node kind; never execute | `e2e: tap a directory in ls output → 'cd name/' in the prompt, not run` | P7 |
| `LNX-RESP-06` | Narrow-width output formats (stacked tables, column fitting) | `unit: golden output at 40 cols` | P7 |
| `LNX-RESP-07` | Rotation preserves draft, caret, viewer content; safe areas | `e2e: O1 on Linux` | P7 |

## Not like the others
The mobile design problem here is the **virtual keyboard**, not tap targets or window management: a pinned prompt, an
accessory key row and tap-to-insert output replace everything the GUI OSes solve with gestures.
