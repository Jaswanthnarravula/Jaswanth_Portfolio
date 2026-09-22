# Linux / 13 — Acceptance ledger

Generated from the feature tables in this folder: every `LNX-*` ID appears **exactly once** here. The feature
description and its named acceptance test live in the spec file; this ledger tracks delivery.

Status: `planned` → `built` → `verified` (or `BLOCKED` + reason + owner sign-off). **Evidence** = passing test
name / CI run / capture. An OS is flipped to `released` only when every row is `verified`.

## Ledger

### `01-identity.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `LNX-ID-01` | Prompt shape, colours, `~` abbreviation, middle-collapse, red `$` after failure | P7 | planned | | |
| `LNX-ID-02` | Mono type metrics: measured cols/rows, 16 px on coarse pointers, pre-wrap | P7 | planned | | |
| `LNX-ID-03` | Colour roles, light/dark, all ≥ 4.5:1 | P7 | planned | | |
| `LNX-ID-04` | Caret: block, blink 1060 ms steps(1), solid while typing, hollow when unfocused | P7 | planned | | |
| `LNX-ID-05` | Status bar with workspace tags, résumé link, help, clock, exit | P7 | planned | | |
| `LNX-ID-06` | Tiled frames with focus border; no chrome buttons | P7 | planned | | |

### `02-shell-engine.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `LNX-SH-01` | Tokenizer: quotes, escapes, comments, operators, spans | P3 | planned | | |
| `LNX-SH-02` | Expansion: tilde, variables, `$?`, globs, history expansion | P3 | planned | | |
| `LNX-SH-03` | Parser: lists, pipelines, redirects (read-only FS), aliases | P3 | planned | | |
| `LNX-SH-04` | Pure execution with pipes, exit codes and returned effects | P3 | planned | | |
| `LNX-SH-05` | Exact error strings + suggestions | P3 | planned | | |
| `LNX-SH-06` | History with draft preservation, Ctrl+R, `history -c` | P3 | planned | | |
| `LNX-SH-07` | Completion (commands, paths, args, flags; double-Tab listing; PASS_THROUGH on empty) | P3 | planned | | |
| `LNX-SH-08` | Line-editing keys; Ctrl+C respects selection; paste trimming | P3 | planned | | |
| `LNX-SH-09` | Flavor adapters (bash / zsh / PowerShell voice) without logic forks | P3 | planned | | |
| `LNX-SH-10` | Totality + caps (8 stages, 2000 lines), no throw | P3 | planned | | |

### `03-filesystem.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `LNX-FS-01` | Tree generated from selectors (no hand-typed content) | P3 | planned | | |
| `LNX-FS-02` | Path resolution incl. `.`, `..`, `~`, `-`, slashes, case sensitivity | P3 | planned | | |
| `LNX-FS-03` | Truthful metadata (size, mtime, mode, owner) | P3 | planned | | |
| `LNX-FS-04` | Width-aware file text via `renderText` | P3 | planned | | |
| `LNX-FS-05` | `.bashrc` is the real alias source; `/usr/bin` mirrors the command table | P3 | planned | | |
| `LNX-FS-06` | cwd ↔ URL mapping; unique extension-less sibling names | P3 | planned | | |
| `LNX-FS-07` | Permission-denied and read-only behaviours | P3 | planned | | |

### `04-commands.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `LNX-CMD-help` | help (generated from the registry) | P3 | planned | | |
| `LNX-CMD-man` | man pages generated from the registry | P3 | planned | | |
| `LNX-CMD-pwd` | pwd | P3 | planned | | |
| `LNX-CMD-cd` | cd incl. `-`, `~`, errors | P3 | planned | | |
| `LNX-CMD-ls` | ls with flags, columns, colours, insertable entries | P3 | planned | | |
| `LNX-CMD-tree` | tree | P3 | planned | | |
| `LNX-CMD-cat` | cat incl. binary notice | P3 | planned | | |
| `LNX-CMD-head` | head | P3 | planned | | |
| `LNX-CMD-tail` | tail | P3 | planned | | |
| `LNX-CMD-less` | pager effect | P3 | planned | | |
| `LNX-CMD-grep` | grep incl. `-r`, exit 1 on no match | P3 | planned | | |
| `LNX-CMD-find` | find | P3 | planned | | |
| `LNX-CMD-wc` | wc | P3 | planned | | |
| `LNX-CMD-sort` | sort | P3 | planned | | |
| `LNX-CMD-uniq` | uniq | P3 | planned | | |
| `LNX-CMD-echo` | echo | P3 | planned | | |
| `LNX-CMD-open` | open → effects per target kind | P3 | planned | | |
| `LNX-CMD-history` | history | P3 | planned | | |
| `LNX-CMD-clear` | clear | P3 | planned | | |
| `LNX-CMD-which` | which | P3 | planned | | |
| `LNX-CMD-type` | type | P3 | planned | | |
| `LNX-CMD-alias` | alias listing from `.bashrc` | P3 | planned | | |
| `LNX-CMD-whoami` | whoami | P3 | planned | | |
| `LNX-CMD-about` | about | P3 | planned | | |
| `LNX-CMD-projects` | projects table | P3 | planned | | |
| `LNX-CMD-skills` | skills bars + filter | P3 | planned | | |
| `LNX-CMD-experience` | experience | P3 | planned | | |
| `LNX-CMD-education` | education | P3 | planned | | |
| `LNX-CMD-contact` | contact with real links | P3 | planned | | |
| `LNX-CMD-resume` | resume / --download | P3 | planned | | |
| `LNX-CMD-mail` | mail → mailto effect | P3 | planned | | |
| `LNX-CMD-settings` | settings list/set → pref effects | P7 | planned | | |
| `LNX-CMD-theme` | theme shorthand | P7 | planned | | |
| `LNX-CMD-motion` | motion shorthand | P7 | planned | | |
| `LNX-CMD-sound` | sound shorthand | P7 | planned | | |
| `LNX-CMD-hints` | hints on/off | P7 | planned | | |
| `LNX-CMD-search` | search over the shared index; never auto-opens | P7 | planned | | |
| `LNX-CMD-switch` | switch / exit / logout | P7 | planned | | |
| `LNX-CMD-tour` | tour | P7 | planned | | |
| `LNX-CMD-legal` | legal notice in pager | P7 | planned | | |
| `LNX-CMD-plain` | plain | P7 | planned | | |
| `LNX-CMD-date` | date | P7 | planned | | |
| `LNX-CMD-uname` | uname | P7 | planned | | |
| `LNX-CMD-hostname` | hostname | P7 | planned | | |
| `LNX-CMD-uptime` | uptime = career length | P7 | planned | | |
| `LNX-CMD-id` | id | P7 | planned | | |
| `LNX-CMD-finger` | finger + .plan | P7 | planned | | |
| `LNX-CMD-aliases` | alias set behaves as listed | P3 | planned | | |
| `LNX-CMD-registry` | One registry generates help, man, which, /usr/bin, completion, search entries | P3 | planned | | |

### `05-hints.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `LNX-HINT-01` | Trigger conditions + rate limits + auto-off after 2 dismissals | P7 | planned | | |
| `LNX-HINT-02` | Nudge copy and the `Need a hint?` disclosure in the fixed hint slot | P7 | planned | | |
| `LNX-HINT-03` | Contextual `nextHint(state)` table | P7 | planned | | |
| `LNX-HINT-04` | **Paste into Terminal inserts and never executes** | P7 | planned | | |
| `LNX-HINT-05` | Draft protection (confirm before replacing non-empty input) | P7 | planned | | |
| `LNX-HINT-06` | `hints on/off/status`; off inside Terminal apps of other OSes | P7 | planned | | |
| `LNX-HINT-07` | Status-region semantics; focus rules | P7 | planned | | |

### `06-rich-views.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `LNX-VIEW-01` | Viewer tile (split, overlay, pager modes) with title strip and text buttons | P7 | planned | | |
| `LNX-VIEW-02` | Continuity: command + result line printed before the transition; focus to viewer; prompt on close | P7 | planned | | |
| `LNX-VIEW-03` | Terminal-skinned content views (mono, rules, chips) from shared views | P7 | planned | | |
| `LNX-VIEW-04` | Viewer keys (q/Esc, j/k, g/G, d, l, n/p) gated by focus + single-key pref | P7 | planned | | |
| `LNX-VIEW-05` | URL: push on open, back-collapse on close, seeded scrollback on cold deep link | P7 | planned | | |
| `LNX-VIEW-06` | Transform-only split with a single re-wrap at rest | P7 | planned | | |
| `LNX-VIEW-07` | Adjustable divider with keyboard alternative | P7 | planned | | |

### `07-output-animation.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `LNX-OUT-01` | Block/line DOM model, fragment append, 500-line cap by whole blocks | P7 | planned | | |
| `LNX-OUT-02` | Reveal timeline: 90 ms/line, 12 ms stagger, ≤ 240 ms, ≤ 24 lines, skip > 200 | P7 | planned | | |
| `LNX-OUT-03` | **Input completes the reveal instantly; typing never blocked** | P7 | planned | | |
| `LNX-OUT-04` | Bottom pinning, `↓ new output` chip, no yanking when scrolled up | P7 | planned | | |
| `LNX-OUT-05` | Zero React renders per line; compositor-only properties | P7 | planned | | |
| `LNX-OUT-06` | Synchronous announcer text + long-output summaries | P7 | planned | | |
| `LNX-OUT-07` | Timeline cleanup (no leaks) | P7 | planned | | |

### `08-boot-and-motd.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `LNX-BOOT-01` | Kernel-log boot from real facts, ≤ 600 ms, doubles as loading, any key skips | P7 | planned | | |
| `LNX-BOOT-02` | Login block with `Last login … from {previousOs}`; no password prompt | P7 | planned | | |
| `LNX-BOOT-03` | MOTD from data with **insertable** entries (never executed) + continuity line | P7 | planned | | |
| `LNX-BOOT-04` | Appearance rules: boot/login first chooser entry only; MOTD per fresh session; none on deep link/re-entry | P7 | planned | | |
| `LNX-BOOT-05` | Autofocus on fine pointers only; "tap here to type" on coarse | P7 | planned | | |
| `LNX-BOOT-06` | Slow/failure states without alarming output | P7 | planned | | |
| `LNX-BOOT-07` | Reduced motion skips boot/login; announcer summaries | P7 | planned | | |

### `09-cross-os-features.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `LNX-X-01` | Résumé fast path: status-bar link, `resume`, MOTD entry, viewer download | P7 | planned | | |
| `LNX-X-02` | `search` output with insertable entries; native `find`/`grep` parity | P7 | planned | | |
| `LNX-X-03` | Continuity via MOTD line / one-time notice | P7 | planned | | |
| `LNX-X-04` | Suggest-and-wait tour; graceful exit on free typing | P7 | planned | | |
| `LNX-X-05` | Eggs registered as hidden commands; found counter in `settings list` | P7 | planned | | |
| `LNX-X-06` | `exit`/`switch` behaviours + logout exit beat | P7 | planned | | |

### `10-responsive.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `LNX-RESP-01` | Layouts per size class incl. 120-col cap, overlay and pager viewer modes | P7 | planned | | |
| `LNX-RESP-02` | Touch prompt: form/input attributes, 16 px, `input`-event reading, no focus on scrollback tap | P7 | planned | | |
| `LNX-RESP-03` | `visualViewport`-driven layout keeps the prompt above the keyboard | P7 | planned | | |
| `LNX-RESP-04` | Accessory key row (keeps focus, completion/history/cancel), hidden with hardware keyboards | P7 | planned | | |
| `LNX-RESP-05` | Tappable entries insert by node kind; never execute | P7 | planned | | |
| `LNX-RESP-06` | Narrow-width output formats (stacked tables, column fitting) | P7 | planned | | |
| `LNX-RESP-07` | Rotation preserves draft, caret, viewer content; safe areas | P7 | planned | | |

### `11-accessibility.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `LNX-A11Y-01` | Landmark/DOM structure: scrollback region, hint slot, labelled prompt, separate log announcer | P7 | planned | | |
| `LNX-A11Y-02` | Synchronous final-text announcements; > 10-line summaries; own echo not announced | P7 | planned | | |
| `LNX-A11Y-03` | **Tab is never a trap** (pass-through on empty; Esc-then-Tab always exits) | P7 | planned | | |
| `LNX-A11Y-04` | Ctrl+C respects selection; no hijacked browser chords | P7 | planned | | |
| `LNX-A11Y-05` | Focus rules (autofocus by pointer type, viewer, hints, scrollback typing redirect) | P7 | planned | | |
| `LNX-A11Y-06` | Contrast, zoom/200 % text, forced-colors, non-colour cues | P7 | planned | | |
| `LNX-A11Y-07` | Insertable entries as named buttons | P7 | planned | | |
| `LNX-A11Y-08` | Screen-reader script recorded for release (NVDA + VoiceOver on the terminal) | P8 | planned | | |

### `12-edge-cases.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `LNX-CASE-01` | E1–E8 (invalid input, errors, read-only FS, caps, paste) | P7 | planned | | |
| `LNX-CASE-02` | E9–E11 (Enter repeat, typing during reveal, cd spam rate degrade) | P7 | planned | | |
| `LNX-CASE-03` | E12–E17 (Back/Forward follows cwd without re-executing, refresh, deep links, layered exit) | P7 | planned | | |
| `LNX-CASE-04` | E18–E23 (resize, keyboard, OS switch/return, storage, hidden tab) | P7 | planned | | |
| `LNX-CASE-05` | E24–E26 (announcer queueing, selection respect, fuzzing) | P7 | planned | | |

**Total feature IDs: 126**

## Definition-of-done audit (run before flipping this OS to `released` — requirement R49)

**Visual language**
- [ ] Tokens only (no magic numbers); system font stack; icons resolve in both asset modes with identical boxes.
- [ ] Focus ring ≥ 3:1; glyphs never rely on colour alone; forced-colors legible.
- [ ] Grayscale smell test against every already-released OS passes.
- [ ] Storyboard test (north-star smell test 8): the reference state side by side with `linux-terminal.png` in `plans/visual-targets/` — only real data and real-OS details differ (`01-identity.md` → Visual target).

**Interactions**
- [ ] Every gesture has its non-gesture alternative; nothing hover-only, drag-only or double-click-only.
- [ ] Context actions reachable by keyboard, long-press and a visible affordance.
- [ ] Impatience test: spam clicks, Back, rotate, resize during every animation — nothing breaks or traps.

**Applications and discoverability**
- [ ] Every section reachable in ≤ 2 actions from the OS home; résumé in 1 action from every surface.
- [ ] Deep link, refresh, Back/Forward and persistence work for every app.
- [ ] Recruiter test: Projects, Résumé and Contact found in < 15 s, uninstructed.
- [ ] No portfolio fact typed into an OS component (selectors + content views only).

**Responsive**
- [ ] All five matrix columns pass; rotation mid-animation; 320 px reflow; 200 % text; 400 % zoom.
- [ ] Real iPhone + Android check with the keyboard up; tap-target audit green.

**Accessibility**
- [ ] axe 0 violations (home + one app + open overlays); "incomplete" contrast results reviewed.
- [ ] ARIA snapshot approved; keyboard-only journey passes; focus never on `<body>`.
- [ ] Screen-reader script passes (NVDA + VoiceOver); reduced motion, reduced transparency, increased contrast verified.

**Performance**
- [ ] Lighthouse CI + INP gates green on this OS's home and one deep link; shell within its JS budget.
- [ ] ≤ 3 live `backdrop-filter` surfaces; no three.js chunk requested; leak loop stable.

**Linux-specific**
- [ ] It is a shell engine over a filesystem: an unscripted session by a technical reviewer (pipes, globs, `cd -`, `ls -la /etc`, quoting) behaves sensibly throughout.
- [ ] Hints and every insertable entry **insert and never execute**; the tour never presses Enter.
- [ ] Tab is never a trap (pass-through on empty input; Esc-then-Tab always leaves); Ctrl+C respects text selection.
- [ ] Any key completes an output reveal instantly; typing is never delayed; zero React renders per output line.
- [ ] On a real iPhone and a real Android phone the prompt stays glued above the virtual keyboard; the accessory row works.
- [ ] Browser Back/Forward moves the cwd/viewer and **never re-executes a command**.
- [ ] Fuzz test (10 000 random inputs) never throws.

**Journeys green:** L1 · L2 · L3 · H1 · D1 · P1 · R1 · O1 · S1 · T1 · C1 · Q1 · X1–X4 on Linux (desktop, tablet, iphone, pixel)

**Plan conformance**
- [ ] Every row above is `verified` with evidence, or `BLOCKED` with owner sign-off.
- [ ] Every "Not like the others" clause in this folder is demonstrably true.
- [ ] Deviations below are complete and signed.

## Deviations log
| Date | ID | What changed vs the spec | Why | Owner sign-off |
|---|---|---|---|---|
| | | | | |
