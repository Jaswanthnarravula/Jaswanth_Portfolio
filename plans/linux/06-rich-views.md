# Linux / 06 — Rich views (the viewer tile)

## Role + requirement refs
Commands that open richer content (`open resume`, `open projects/<slug>`, `open experience/<slug>`, `open
education/<slug>`) transition from terminal output into a **viewer** while keeping clear visual continuity back to
the shell. Requirement: R34. Kernel role `viewer`, slug `viewer`.

## Portfolio mapping
Viewer content = shared content views in the `text`-adjacent **`compact`** density, skinned for the terminal world:
`ResumeView` · `ProjectDetail` · `ExperienceDetail` · `EducationList` item. Same facts as every other OS.

## Anatomy
**Tiled layout** (`expanded`/`large`): the workspace splits — terminal tile left, **viewer tile right** (50/50;
divider draggable between 30–70 %, also `Alt+Shift+←/→`). Status bar shows `[1:term] [2:view]`; the focused tile has
the green border.
Viewer tile: title strip `viewer — resume.pdf` (or `projects/portfolio-os.md`) with text buttons `[q] close` ·
`[d] download` (résumé) · `[l] copy link`; body on the terminal background, **monospace headings + proportional-free
layout**: content views render with mono type, box-drawing rules, tags as `[typescript]` chips, links cyan + underlined,
images framed by a 1 px border with a caption line. Résumé: the PDF's page images (shared/03 `VIEW-RESUME-01`) on a slightly lighter panel,
"text version" first in DOM.
**Medium:** viewer overlays the terminal as a full tile (terminal hidden behind, status tags still switch).
**Compact:** full-screen **pager-style** view with a visible `Close` button (not only `q`).

## Behaviour & states
| Step | Behaviour |
|---|---|
| `open …` Enter | The command line and a dim result line (`opening projects/portfolio-os.md in viewer…`) print **first** (continuity: the cause stays visible), then the viewer tile slides in |
| Focus | Moves to the viewer tile's heading; the terminal keeps its scrollback and draft |
| Inside the viewer | Keys: `q` / Esc close · `j`/`k` or arrows scroll · `g`/`G` top/bottom · `d` download (résumé) · `l` copy link · `n`/`p` next/previous sibling (e.g. next project) · Tab moves through links |
| Switch tiles | Click a tile · `Alt+Shift+N/P` · status-bar tags |
| Open another ref while open | Viewer content swaps in place (fade), URL updates, history pushes |
| Close | Viewer slides out; focus returns to the **prompt**; nothing is printed (a closed viewer needs no output) |
| `exit` with the viewer open | Closes the viewer first |
| Loading | Title strip shows `loading…`; content views are in the shell chunk so this is near-instant; the PDF streams |

## Navigation & routes
`open` → `go('/linux/viewer/{refPath}')` (`/linux/viewer/resume`, `/linux/viewer/projects/{slug}`…). Closing →
back-collapse to `/linux/terminal/{cwd}`. Cold deep link to a viewer URL → terminal boots with a **seeded scrollback**
(`cd …` and `open …` lines, dimmed "session restored") so the state is self-explanatory, viewer open, no boot/MOTD.
Browser Back closes the viewer (= previous entry).

## Motion
Tile split: terminal width animates via **grid-template-columns** — avoided; instead both tiles are absolutely
positioned and move with `transform`/`clip-path` (200 ms ease-out), then layout commits once at rest (terminal
re-wraps to its new `cols` **after** the motion, in one pass). Content swap: 120 ms fade. Reduced motion: instant.

## Responsive
See `10-responsive.md`: tiled (expanded+), overlay (medium), pager (compact). Divider has a 44 px touch handle on
coarse pointers.

## Accessibility
Viewer = `<section aria-labelledby>` region with an `h2`; content headings from `h3`; single-key shortcuts (`q`, `j`,
`k`…) are active **only while focus is inside the viewer and not in a text field**, are listed in its title strip, and
follow the global "single-key shortcuts" preference (when off, the buttons and Esc remain). Close is always a visible
button. The terminal tile is **not** `inert` in tiled mode (both are usable); in overlay/pager modes it is `hidden`.

## Edge cases
Terminal narrower than 40 cols after a split → viewer opens as overlay instead. Resize during the split animation →
commit to the final layout immediately. `open` on a text file without a rich view → `less` (pager effect) instead.
Removed ref in a deep link → parent listing printed in the terminal + dim notice. Pages missing → Open / Download + text version.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `LNX-VIEW-01` | Viewer tile (split, overlay, pager modes) with title strip and text buttons | `e2e: L1 open resume at 1440, 900 and 390 px` | P7 |
| `LNX-VIEW-02` | Continuity: command + result line printed before the transition; focus to viewer; prompt on close | `e2e: L1 scrollback shows the cause; focus assertions` | P7 |
| `LNX-VIEW-03` | Terminal-skinned content views (mono, rules, chips) from shared views | `static: shared views; cmp: renders from fixture` | P7 |
| `LNX-VIEW-04` | Viewer keys (q/Esc, j/k, g/G, d, l, n/p) gated by focus + single-key pref | `cmp: keys inert when pref off; buttons remain` | P7 |
| `LNX-VIEW-05` | URL: push on open, back-collapse on close, seeded scrollback on cold deep link | `e2e: D1 /linux/viewer/projects/{slug}; H1 Back closes the viewer` | P7 |
| `LNX-VIEW-06` | Transform-only split with a single re-wrap at rest | `perf: no Layout during the split flight; one re-wrap after` | P7 |
| `LNX-VIEW-07` | Adjustable divider with keyboard alternative | `e2e: Alt+Shift+Arrow resizes; drag resizes` | P7 |

## Not like the others
Rich content appears as a **second tile beside the shell, caused by a visible command**, and leaves without a trace
(GUI OSes open windows/apps from icons). The viewer is keyboard-driven like `less`, yet fully operable by pointer and
screen reader.
