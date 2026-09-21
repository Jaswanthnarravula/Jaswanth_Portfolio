# Linux / 07 — Output animation and scrolling

## Role + requirement refs
Terminal output appears with realistic, **extremely cheap** GSAP sequences: line-by-line arrival, clear command/output
separation, controlled timing, auto-scroll — and **instant response to user input**. Requirement: R33, R38.

## Rendering model
- Scrollback is a plain DOM list of **line elements** inside one scroll container (`contain: content`); each command
  produces a **block**: `prompt+command` line, then output lines, then (optionally) a blank separator.
- Lines are created **once**, as finished nodes (text, colour classes, anchors, `data-insert` for tappable entries) —
  never typed character by character (slower to read; hostile to screen readers).
- Scrollback cap **500 lines** (oldest blocks removed whole, never half a block); removal happens off-frame after the
  animation.
- Off-screen blocks get `content-visibility: auto`.

## The reveal (per command — one GSAP timeline)
1. Command line appears **instantly** on Enter (the visitor's own text must never lag).
2. Output lines are appended in a single batch with `opacity: 0; transform: translateY(4px)`.
3. One timeline: each line → `opacity 1, y 0` in **90 ms**, **12 ms stagger**, ease `power1.out`; the **total is capped
   at 240 ms**: only the first **24 visible lines** animate; any further lines in the same output appear with the 24th.
4. On complete: `timeline.kill()` + null; inline styles cleared.
Large outputs (> 200 lines) skip the animation entirely.

## Input always wins
Any `keydown`, `pointerdown` or `wheel` while a reveal is running → `timeline.progress(1)` immediately. The prompt is
**focusable and typable during the reveal** (keystrokes are never dropped or delayed); Enter on a new command while the
previous reveal is mid-flight completes it first, then runs.

## Auto-scroll
- The view is **pinned to the bottom** while the visitor is at (or within 2 lines of) the bottom.
- If they scrolled up, new output does **not** yank them down: a small text chip `↓ new output` appears bottom-right of
  the tile; clicking it (or pressing End / typing a character) jumps to the bottom and re-pins.
- Scrolling uses the container's native scrolling; programmatic jumps are instant (`scrollTop` assignment, no smooth
  scroll — terminals don't ease).
- Shift+PgUp / Shift+PgDn scroll by a page; the prompt stays at the bottom of the tile (sticky), never inside the
  scrolled content.

## Special sequences
| Case | Behaviour |
|---|---|
| `clear` / Ctrl+L | Scrollback emptied in one frame; no animation |
| Boot log | Own timeline: 8 ms per line, ≤ 600 ms total, any key skips (`08-boot-and-motd.md`) |
| Pager (`less`, `man`) | No per-line reveal; page flips are instant |
| Errors | Same reveal; red class; never shaken or flashed |
| `cmatrix` egg | Its own bounded canvas-free animation inside the tile (see `shared/21`) |
| Reduced motion | No reveal at all: lines appear instantly; caret solid; no visual bell |

## Performance rules
Only `opacity` + `transform` animate; nodes are appended inside a `DocumentFragment` in one DOM write; no layout reads
between write and animation start (scroll pinning reads happen before the write); timelines run on the shared GSAP
ticker; zero React re-renders per line (the scrollback is an imperative list owned by a ref — React only renders the
tile shell and the prompt).

## Accessibility
The visually hidden `role="log"` announcer receives the **final text synchronously at append time**, regardless of the
visual reveal; outputs longer than 10 lines are summarized ("projects: 12 lines. First line: …") with the full text
available in the focusable scrollback region. The `↓ new output` chip is a button and is announced politely.

## Edge cases
Command produces 0 lines → no blank gap (just the next prompt). Tab hidden mid-reveal → completed on return. Resize
mid-reveal → `progress(1)` then re-wrap. Extremely fast typists → each Enter completes the previous reveal; nothing queues.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `LNX-OUT-01` | Block/line DOM model, fragment append, 500-line cap by whole blocks | `unit: cap removes whole blocks; perf: single DOM write per command` | P7 |
| `LNX-OUT-02` | Reveal timeline: 90 ms/line, 12 ms stagger, ≤ 240 ms, ≤ 24 lines, skip > 200 | `unit: timeline builder durations; e2e: R1 variant has no reveal` | P7 |
| `LNX-OUT-03` | **Input completes the reveal instantly; typing never blocked** | `e2e: keypress at t=30 ms → all lines at opacity 1 within one frame; typed chars all present` | P7 |
| `LNX-OUT-04` | Bottom pinning, `↓ new output` chip, no yanking when scrolled up | `e2e: scroll up, run command, position unchanged, chip shown` | P7 |
| `LNX-OUT-05` | Zero React renders per line; compositor-only properties | `perf: render counter = 0 during output; no Layout in reveal` | P7 |
| `LNX-OUT-06` | Synchronous announcer text + long-output summaries | `cmp: announcer receives text synchronously with the reveal on` | P7 |
| `LNX-OUT-07` | Timeline cleanup (no leaks) | `e2e: leak loop — ticker set empty after 200 commands` | P7 |

## Not like the others
The only "animation system" in Linux is a ≤ 240 ms line reveal that **any key cancels**. No springs, no flights, no
easing personality — the restraint is the identity.
