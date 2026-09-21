# Linux / 11 — Accessibility

## Role + requirement refs
A terminal is already text — the work is making it **announce well, never trap the keyboard, and stay calm**. Policy
and shared rules: `shared/09-accessibility.md` (terminal section). R43.

## Landmark structure (DOM order = reading order)
1. "Skip the OS: plain portfolio" link
2. `<header>` status bar: `nav` of workspace tags (buttons, `aria-current`), `résumé` link, help button, `<time>`
   (not live), `exit` button
3. `<main>`: hidden `<h1>` "Linux — Jaswanth's portfolio" →
   - `<section aria-label="Terminal">`:
     - **Scrollback** — a labelled, focusable region (`tabindex="0"`, `aria-label="Terminal output"`); ordinary
       readable text; screen-reader users can browse it with their virtual cursor.
     - **Hint slot** — polite status sub-region with the disclosure button (`05-hints.md`).
     - **Prompt** — `<form>` with a native `<input>` labelled **"Command, current directory {cwd}"**; the visual prompt
       string is `aria-hidden`.
     - **Announcer** — a separate visually hidden `role="log"` `aria-live="polite"` element.
   - `<section aria-labelledby>` **Viewer** (when open)
4. Accessory key row (when present): `toolbar` "Terminal keys" of buttons.

## Announcing output
- On each command the announcer receives **the final output text at once** (independent of the visual reveal).
- ≤ 10 lines → read in full. > 10 lines → summary: `"{command}: {n} lines. {first line}"`; the full text is in the
  scrollback region. Errors are prefixed "Error:". Colour is never the only signal (errors also start with the command
  name and a colon; directories end with `/` in the announced text).
- The echo of the visitor's own command is **not** announced (the screen reader already spoke their typing).
- The boot log is `aria-hidden`; login + MOTD are one summarized announcement.

## Keyboard — never a trap
| Key | Behaviour |
|---|---|
| **Tab** | Completes **only** when the input has a non-empty token **and** there are candidates. **Empty input → Tab moves focus normally.** |
| **Esc, then Tab** | Always leaves the terminal, whatever the input contains (documented in `help` and the `?` dialog) |
| Shift+Tab | Moves to the hint slot / scrollback / status bar (normal order) |
| ↑ / ↓ | History (only when the input is focused) |
| Ctrl+C | Cancels the line **only when no text is selected** (otherwise the browser copies) |
| Ctrl+L | Clear |
| Shift+PgUp / PgDn | Scroll the scrollback from the prompt |
| Enter | Run |
| Viewer single keys (`q`, `j`, `k`, `g`, `G`, `d`, `l`, `n`, `p`) | Only while focus is inside the viewer, not in a text field, and the "single-key shortcuts" pref is on; Esc + visible buttons always work |
No global key is hijacked: Ctrl/Cmd+K, F5, Ctrl+R in the browser sense (reverse-search uses Ctrl+R **only while the
input is focused** and can be turned off with the single-key/terminal-keys pref), Ctrl+W/T/L are untouched.

## Focus
Fine pointer: prompt autofocused on arrival (it is the primary control and there is nothing to read first beyond the
MOTD, which is announced). Coarse pointer: no autofocus. After `open`: focus → viewer heading; after close: → prompt.
After hint **Paste**: → prompt, caret at end. Clicking the scrollback focuses the scrollback (for selection), not the
prompt; typing a printable key while the scrollback is focused moves focus to the prompt and types the key (fine
pointers only).

## Visual accessibility
All colour roles ≥ 4.5:1 in both themes (`LNX-ID-03`); caret has a non-blinking mode (reduced motion) and is never
the only focus indicator (the focused tile has a border; the input has a focus ring on keyboard focus). Text size
follows the Larger-text pref and browser zoom; `cols` re-measure so layouts stay intact at 200 %. `forced-colors`:
system colours, caret uses `Highlight`. Visual bell is off under reduced motion.

## Insertable entries
`ls`/MOTD/search/hint entries are real `<button>`s inside the output with names like "Insert command: cd projects" —
reachable by Tab from the scrollback; they never execute.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `LNX-A11Y-01` | Landmark/DOM structure: scrollback region, hint slot, labelled prompt, separate log announcer | `e2e: X2 ARIA snapshot of the Linux shell` | P7 |
| `LNX-A11Y-02` | Synchronous final-text announcements; > 10-line summaries; own echo not announced | `cmp: Terminal: announcer receives text synchronously with typewriter on` | P7 |
| `LNX-A11Y-03` | **Tab is never a trap** (pass-through on empty; Esc-then-Tab always exits) | `cmp: Terminal: Tab empty not prevented; e2e: Esc+Tab leaves` | P7 |
| `LNX-A11Y-04` | Ctrl+C respects selection; no hijacked browser chords | `cmp: Ctrl+C with selection copies; unit: keymap deny-list` | P7 |
| `LNX-A11Y-05` | Focus rules (autofocus by pointer type, viewer, hints, scrollback typing redirect) | `e2e: focus assertions` | P7 |
| `LNX-A11Y-06` | Contrast, zoom/200 % text, forced-colors, non-colour cues | `e2e: X1 axe clean; forced-colors project; 200 % text L1` | P7 |
| `LNX-A11Y-07` | Insertable entries as named buttons | `cmp: names + never execute` | P7 |
| `LNX-A11Y-08` | Screen-reader script recorded for release (NVDA + VoiceOver on the terminal) | `release: notes in evidence` | P8 |

## Not like the others
GUI OSes solve accessibility with roles for windows, menus and grids. Linux solves it with **one labelled input, one
readable region and one log announcer** — and a strict promise that Tab, Ctrl+C and the browser's own shortcuts keep
their normal meaning.
