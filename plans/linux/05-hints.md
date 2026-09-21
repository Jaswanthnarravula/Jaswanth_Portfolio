# Linux / 05 — Hints ("Lost already? Linux welcomes you.")

## Role + requirement refs
Playful but restrained assistance for visitors who appear unsure — **offered, never imposed; inserted, never
executed.** Requirements: R30, R31, R32, north-star B14.

## The flow (exactly three steps)
1. **Nudge** — a single dim line is appended to the scrollback area's *hint slot* (not into scrollback itself):
   `Lost already? Linux welcomes you.` followed by a small text button **`Need a hint?`**
2. **Reveal** — activating it shows a compact hint card: one **contextually useful command** in a code chip (e.g.
   `cd projects`), one short sentence on what it does, and two buttons: **`Paste into Terminal`** · `Not now`.
3. **Paste** — inserts the command text into the **active prompt** at the caret (replacing any current draft only if it
   is empty; otherwise it asks "Replace your current line?"), moves focus to the prompt, places the caret at the end,
   and announces "Inserted — press Enter to run". **It never submits.** The visitor presses Enter.

## When the nudge appears (any one condition; all thresholds are constants in one file)
- **Idle:** 25 s with no key/pointer input after the prompt is ready, and fewer than 2 successful commands so far.
- **Struggle:** 3 consecutive non-zero exits (e.g. repeated `command not found`).
- **Dead end:** an `ls` in an empty directory, or `cd` into `.ssh` (permission denied).
Rate limits: at most **one nudge per 60 s**, at most **3 per session**; after **2 dismissals** hints switch themselves
off (`hints off`) and say so once: `Hints off — 'hints on' brings them back. 'help' is always here.` Never shown while
the pager/viewer is open, during the tour, while text is selected, or under `hints off`. Under reduced motion the
nudge appears without animation. Identical for every visitor (no profile tailoring).

## Choosing the hint (pure function of session state — `nextHint(state)`)

| State | Hint | Sentence |
|---|---|---|
| Nothing run yet | `help` | "See what this shell can do." |
| Ran `help`, never listed | `ls` | "Look around — everything here is a file." |
| At `~`, listed, never entered a directory | `cd projects` | "Projects live in a folder. Step inside." |
| In `~/projects`, not listed | `ls` | "List the projects." |
| In `~/projects`, listed, none opened | `open projects/{first featured slug}` | "Open one in the viewer." |
| Opened a project, résumé never opened | `open resume` | "The résumé is one command away." |
| Résumé seen, experience not visited | `cd ~/experience && ls` | "Work history is a folder too." |
| Most things seen, contact not used | `contact` | "Say hello." |
| After a `command not found` with a close match | the corrected command | "Looks like a typo." |
| Everything above done | `neofetch` | "You've earned this." (leads to an egg) |

## Anatomy
- **Hint slot:** a fixed region directly above the prompt line (so it never scrolls away and never interleaves with
  command output). Dim text, mono 13 px. Button styled as an underlined text button.
- **Hint card:** same slot, 1 px dim border, 8 px padding; code chip with the command in foreground colour; buttons as
  text buttons separated by `·`. No modal, no overlay, no icon, no emoji.
- On coarse pointers the buttons are ≥ 44 px tall; the card sits above the accessory key row.

## Behaviour details
- Typing anything dismisses the nudge/card immediately (input always wins) — this does **not** count as a dismissal
  toward the auto-off counter; pressing `Not now` does.
- The pasted command is a normal draft: editable, clearable, and recorded in history only when the visitor runs it.
- Analytics: `hint_used` with `step: shown | revealed | pasted` (no command text).
- `hints on|off|status` command controls it; Settings mirror exists in every OS as "Terminal hints".

## Navigation & routes
None. Hints never touch history.

## Motion
Nudge/card fade in 120 ms (none under reduced motion). No movement, no bounce, no typing effect.

## Accessibility
The nudge lives in a polite `role="status"` sub-region: announced once ("Lost already? Linux welcomes you. Need a
hint? button"). `Need a hint?` is a **disclosure button** (`aria-expanded`) controlling a `group` "Hint". Focus is not
moved when the nudge appears; after **Paste** focus moves to the prompt. Reachable by Shift+Tab from the prompt
(it precedes the prompt in DOM order).

## Edge cases
Visitor starts typing while the 25 s timer fires → nudge suppressed. Hint targets a project that was removed →
`nextHint` falls through to the next row. Prompt already contains text → confirm before replacing. In the macOS /
Windows Terminal **apps** the hint system is **off** (it belongs to the Linux OS).

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `LNX-HINT-01` | Trigger conditions + rate limits + auto-off after 2 dismissals | `unit: trigger state machine with fake timers` | P7 |
| `LNX-HINT-02` | Nudge copy and the `Need a hint?` disclosure in the fixed hint slot | `e2e: L2 nudge appears after idle; typing dismisses it` | P7 |
| `LNX-HINT-03` | Contextual `nextHint(state)` table | `unit: every row of the table` | P7 |
| `LNX-HINT-04` | **Paste into Terminal inserts and never executes** | `e2e: L2 the hint inserts a command and never executes it; unit: hint paste → {insert, execute:false}` | P7 |
| `LNX-HINT-05` | Draft protection (confirm before replacing non-empty input) | `cmp: confirm path` | P7 |
| `LNX-HINT-06` | `hints on/off/status`; off inside Terminal apps of other OSes | `unit + e2e: chip never appears in macOS Terminal` | P7 |
| `LNX-HINT-07` | Status-region semantics; focus rules | `cmp: announced once; focus unchanged until Paste` | P7 |

## Not like the others
Help in the GUI OSes is a tour and a search box. Linux help is a **quiet line of text** that offers one command —
and then steps back so the visitor still gets the satisfaction of pressing Enter themselves.
