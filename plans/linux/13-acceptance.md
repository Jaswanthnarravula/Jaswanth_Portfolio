# Linux / 13 — Acceptance ledger

Generated from the feature tables in this folder: every `LNX-*` ID appears **exactly once** here. The feature
description and its named acceptance test live in the spec file; this ledger tracks delivery.

Status: `planned` → `built` → `verified` (or `BLOCKED` + reason + owner sign-off). **Evidence** = passing test
name / CI run / capture. An OS is flipped to `released` only when every row is `verified`.

## Ledger

### `01-identity.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `LNX-ID-01` | Prompt shape, colours, `~` abbreviation, middle-collapse, red `$` after failure | P7 | verified | unit/linux/model.test.ts + component/linux/shell.test.tsx green 2026-09-23 | |
| `LNX-ID-02` | Mono type metrics: measured cols/rows, 16 px on coarse pointers, pre-wrap | P7 | verified | unit/linux/model.test.ts + component/linux/shell.test.tsx green 2026-09-23 | |
| `LNX-ID-03` | Colour roles, light/dark, all ≥ 4.5:1 | P7 | verified | e2e/linux.spec.ts light + dark browser axe runs green 2026-09-23 | |
| `LNX-ID-04` | Caret: block, blink 1060 ms steps(1), solid while typing, hollow when unfocused | P7 | verified | component/terminal/terminal-view.test.tsx + terminal.module.css contract green 2026-09-23 | |
| `LNX-ID-05` | Status bar with workspace tags, résumé link, help, clock, exit | P7 | verified | unit/linux/model.test.ts + component/linux/shell.test.tsx green 2026-09-23 | |
| `LNX-ID-06` | Tiled frames with focus border; no chrome buttons | P7 | verified | component/linux/shell.test.tsx + e2e/linux.spec.ts green 2026-09-23 | |

### `02-shell-engine.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `LNX-SH-01` | Tokenizer: quotes, escapes, comments, operators, spans | P3 | verified | `unit/terminal/language.test.ts` › LNX-SH-01 tokenizer: quotes, escapes, comments, operators, spans · green locally 2026-09-22 (vitest) |  |
| `LNX-SH-02` | Expansion: tilde, variables, `$?`, globs, history expansion | P3 | verified | `unit/terminal/language.test.ts` › LNX-SH-02 expansion: tilde, variables, $?, globs, history expansion · green locally 2026-09-22 (vitest) |  |
| `LNX-SH-03` | Parser: lists, pipelines, redirects (read-only FS), aliases | P3 | verified | `unit/terminal/language.test.ts` › LNX-SH-03 parser: lists, pipelines, redirects (read-only FS), aliases · green locally 2026-09-22 (vitest) |  |
| `LNX-SH-04` | Pure execution with pipes, exit codes and returned effects | P3 | verified | `unit/terminal/language.test.ts` › LNX-SH-04 pure execution: pipes, exit codes, returned effects · green locally 2026-09-22 (vitest) |  |
| `LNX-SH-05` | Exact error strings + suggestions | P3 | verified | `unit/terminal/shell.test.ts` › LNX-SH-05 exact error strings + suggestions · green locally 2026-09-22 (vitest) |  |
| `LNX-SH-06` | History with draft preservation, Ctrl+R, `history -c` | P3 | verified | `unit/terminal/shell.test.ts` › LNX-SH-06 history: draft preserved, Ctrl+R, history -c · green locally 2026-09-22 (vitest) |  |
| `LNX-SH-07` | Completion (commands, paths, args, flags; double-Tab listing; PASS_THROUGH on empty) | P3 | verified | `unit/terminal/shell.test.ts` › LNX-SH-07 completion · green locally 2026-09-22 (vitest) |  |
| `LNX-SH-08` | Line-editing keys; Ctrl+C respects selection; paste trimming | P3 | verified | `unit/terminal/shell.test.ts` › LNX-SH-08 line editing: Ctrl+A/E/U/K/W, Ctrl+C respects selection, paste trimming · green locally 2026-09-22 (vitest) |  |
| `LNX-SH-09` | Flavor adapters (bash / zsh / PowerShell voice) without logic forks | P3 | verified | `unit/terminal/hosts.test.ts` › LNX-SH-09 every voice phrases every shell-level message · `unit/terminal/shell.test.ts` › LNX-SH-09 flavor voices: same AST and effects, only strings differ · green locally 2026-09-22 (vitest) |  |
| `LNX-SH-10` | Totality + caps (8 stages, 2000 lines), no throw | P3 | verified | `unit/terminal/shell.test.ts` › LNX-SH-10 totality and caps · green locally 2026-09-22 (vitest) |  |

### `03-filesystem.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `LNX-FS-01` | Tree generated from selectors (no hand-typed content) | P3 | verified | `unit/terminal/vfs.test.ts` › LNX-FS-01 tree generated from selectors (no hand-typed content) · green locally 2026-09-22 (vitest) |  |
| `LNX-FS-02` | Path resolution incl. `.`, `..`, `~`, `-`, slashes, case sensitivity | P3 | verified | `unit/terminal/vfs.test.ts` › LNX-FS-02 path resolution · green locally 2026-09-22 (vitest) |  |
| `LNX-FS-03` | Truthful metadata (size, mtime, mode, owner) | P3 | verified | `unit/terminal/vfs.test.ts` › LNX-FS-03 truthful metadata · green locally 2026-09-22 (vitest) |  |
| `LNX-FS-04` | Width-aware file text via `renderText` | P3 | verified | `unit/terminal/vfs.test.ts` › LNX-FS-04 width-aware file text · green locally 2026-09-22 (vitest) |  |
| `LNX-FS-05` | `.bashrc` is the real alias source; `/usr/bin` mirrors the command table | P3 | verified | `unit/terminal/vfs.test.ts` › LNX-FS-05 .bashrc is the alias source; /usr/bin mirrors the command table · green locally 2026-09-22 (vitest) |  |
| `LNX-FS-06` | cwd ↔ URL mapping; unique extension-less sibling names | P3 | verified | `unit/terminal/vfs.test.ts` › LNX-FS-06 cwd ↔ URL mapping; unique extension-less sibling names · green locally 2026-09-22 (vitest) |  |
| `LNX-FS-07` | Permission-denied and read-only behaviours | P3 | verified | `unit/terminal/vfs.test.ts` › LNX-FS-07 permission-denied and read-only behaviours · green locally 2026-09-22 (vitest) |  |

### `04-commands.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `LNX-CMD-help` | help (generated from the registry) | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-help — generated from the registry: every visible command exactly once · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-man` | man pages generated from the registry | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-man — a page for every command, opened in the pager (printed when piped) · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-pwd` | pwd | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-pwd · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-cd` | cd incl. `-`, `~`, errors | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-cd — incl. -, ~ and cd into a file → Not a directory · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-ls` | ls with flags, columns, colours, insertable entries | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-ls — column fitting at 80/40; -la fields; entries insertable · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-tree` | tree | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-tree · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-cat` | cat incl. binary notice | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-cat — incl. the binary notice and cat dir → Is a directory · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-head` | head | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-head / LNX-CMD-tail — stdin and file · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-tail` | tail | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-head / LNX-CMD-tail — stdin and file · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-less` | pager effect | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-less — pager effect (q quits in the host); prints when not the last stage · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-grep` | grep incl. `-r`, exit 1 on no match | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-grep — highlights and exit codes, -r walks the VFS · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-find` | find | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-find — -name / -type · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-wc` | wc | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-wc — counts · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-sort` | sort | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-sort / LNX-CMD-uniq · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-uniq` | uniq | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-sort / LNX-CMD-uniq · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-echo` | echo | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-echo — expansion applied · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-open` | open → effects per target kind | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-open — an effect per target kind · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-history` | history | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-history / LNX-CMD-clear · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-clear` | clear | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-history / LNX-CMD-clear · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-which` | which | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-which / LNX-CMD-type — path, alias, builtin · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-type` | type | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-which / LNX-CMD-type — path, alias, builtin · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-alias` | alias listing from `.bashrc` | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-alias — listing from .bashrc; defining is refused (read-only) · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-whoami` | whoami | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-whoami / LNX-CMD-about · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-about` | about | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-whoami / LNX-CMD-about · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-projects` | projects table | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-projects — table from data, featured first, footer insertables · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-skills` | skills bars + filter | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-skills — groups (bars only for published levels) + filter · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-experience` | experience | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-experience / LNX-CMD-education · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-education` | education | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-experience / LNX-CMD-education · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-contact` | contact with real links | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-contact — real links · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-resume` | resume / --download | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-resume — open / --download effects · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-mail` | mail → mailto effect | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-mail — the mailto effect (same builder as the GUI apps) · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-settings` | settings list/set → pref effects | P7 | verified | unit/linux/commands.test.ts green 2026-09-23 | |
| `LNX-CMD-theme` | theme shorthand | P7 | verified | unit/linux/commands.test.ts green 2026-09-23 | |
| `LNX-CMD-motion` | motion shorthand | P7 | verified | unit/linux/commands.test.ts green 2026-09-23 | |
| `LNX-CMD-sound` | sound shorthand | P7 | verified | unit/linux/commands.test.ts green 2026-09-23 | |
| `LNX-CMD-hints` | hints on/off | P7 | verified | unit/linux/commands.test.ts green 2026-09-23 | |
| `LNX-CMD-search` | search over the shared index; never auto-opens | P7 | verified | unit/linux/commands.test.ts green 2026-09-23 | |
| `LNX-CMD-switch` | switch / exit / logout | P7 | verified | unit/linux/commands.test.ts green 2026-09-23 | |
| `LNX-CMD-tour` | tour | P7 | verified | unit/linux/commands.test.ts green 2026-09-23 | |
| `LNX-CMD-legal` | legal notice in pager | P7 | verified | unit/linux/commands.test.ts green 2026-09-23 | |
| `LNX-CMD-plain` | plain | P7 | verified | unit/linux/commands.test.ts + component/linux/shell.test.tsx + e2e/linux.spec.ts green 2026-09-23 | |
| `LNX-CMD-date` | date | P7 | verified | unit/linux/commands.test.ts green 2026-09-23 | |
| `LNX-CMD-uname` | uname | P7 | verified | unit/linux/commands.test.ts green 2026-09-23 | |
| `LNX-CMD-hostname` | hostname | P7 | verified | unit/linux/commands.test.ts green 2026-09-23 | |
| `LNX-CMD-uptime` | uptime = career length | P7 | verified | unit/linux/commands.test.ts green 2026-09-23 | |
| `LNX-CMD-id` | id | P7 | verified | unit/linux/commands.test.ts green 2026-09-23 | |
| `LNX-CMD-finger` | finger + .plan | P7 | verified | unit/linux/commands.test.ts green 2026-09-23 | |
| `LNX-CMD-aliases` | alias set behaves as listed | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-aliases — each alias resolves as listed · green locally 2026-09-22 (vitest) |  |
| `LNX-CMD-registry` | One registry generates help, man, which, /usr/bin, completion, search entries | P3 | verified | `unit/terminal/commands.test.ts` › LNX-CMD-registry — one table generates help, man, which, /usr/bin, completion and search entries · green locally 2026-09-22 (vitest) |  |

### `05-hints.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `LNX-HINT-01` | Trigger conditions + rate limits + auto-off after 2 dismissals | P7 | verified | component/linux/shell.test.tsx rate-limit + two-dismissal cases green 2026-09-23 | |
| `LNX-HINT-02` | Nudge copy and the `Need a hint?` disclosure in the fixed hint slot | P7 | verified | component/linux/shell.test.tsx green 2026-09-23 | |
| `LNX-HINT-03` | Contextual `nextHint(state)` table | P7 | verified | unit/linux/model.test.ts + component/linux/shell.test.tsx green 2026-09-23 | |
| `LNX-HINT-04` | **Paste into Terminal inserts and never executes** | P7 | verified | component/linux/shell.test.tsx green 2026-09-23 | |
| `LNX-HINT-05` | Draft protection (confirm before replacing non-empty input) | P7 | verified | component/linux/shell.test.tsx confirm-path case green 2026-09-23 | |
| `LNX-HINT-06` | `hints on/off/status`; off inside Terminal apps of other OSes | P7 | verified | unit/linux/commands.test.ts + component/linux/shell.test.tsx green 2026-09-23 | |
| `LNX-HINT-07` | Status-region semantics; focus rules | P7 | verified | component/linux/shell.test.tsx green 2026-09-23 | |

### `06-rich-views.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `LNX-VIEW-01` | Viewer tile (split, overlay, pager modes) with title strip and text buttons | P7 | verified | component/linux/shell.test.tsx + e2e/linux.spec.ts green across desktop, iPhone, Pixel and reduced-motion 2026-09-23 | |
| `LNX-VIEW-02` | Continuity: command + result line printed before the transition; focus to viewer; prompt on close | P7 | verified | component/linux/shell.test.tsx + e2e/linux.spec.ts green across desktop, iPhone, Pixel and reduced-motion 2026-09-23 | |
| `LNX-VIEW-03` | Terminal-skinned content views (mono, rules, chips) from shared views | P7 | verified | component/linux/shell.test.tsx + e2e/linux.spec.ts browser axe green 2026-09-23 | |
| `LNX-VIEW-04` | Viewer keys (q/Esc, j/k, g/G, d, l, n/p) gated by focus + single-key pref | P7 | verified | component/linux/shell.test.tsx preference gate + e2e/linux.spec.ts keys green 2026-09-23 | |
| `LNX-VIEW-05` | URL: push on open, back-collapse on close, seeded scrollback on cold deep link | P7 | verified | component/linux/shell.test.tsx + e2e/linux.spec.ts green across desktop, iPhone, Pixel and reduced-motion 2026-09-23 | |
| `LNX-VIEW-06` | Transform-only split with a single re-wrap at rest | P7 | verified | component/linux/shell.test.tsx split/resize + e2e/linux.spec.ts rewrap counter green 2026-09-23 | |
| `LNX-VIEW-07` | Adjustable divider with keyboard alternative | P7 | verified | e2e/linux.spec.ts drag + Alt+Shift+Arrow green 2026-09-23 | |

### `07-output-animation.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `LNX-OUT-01` | Block/line DOM model, fragment append, 500-line cap by whole blocks | P7 | verified | component/linux/output.test.tsx fragment-append and whole-block trim cases green 2026-09-23 | |
| `LNX-OUT-02` | Reveal timeline: 90 ms/line, 12 ms stagger, ≤ 240 ms, ≤ 24 lines, skip > 200 | P7 | verified | unit/linux/output.test.ts timing-boundary cases green 2026-09-23 | |
| `LNX-OUT-03` | **Input completes the reveal instantly; typing never blocked** | P7 | verified | component/terminal/terminal-view.test.tsx input-during-reveal case green 2026-09-23 | |
| `LNX-OUT-04` | Bottom pinning, `↓ new output` chip, no yanking when scrolled up | P7 | verified | e2e/linux.spec.ts OUT-04 scroll-pinning case green 2026-09-23 | |
| `LNX-OUT-05` | Zero React renders per line; compositor-only properties | P7 | verified | component/terminal/terminal-view.test.tsx React Profiler long-output case green 2026-09-23 | |
| `LNX-OUT-06` | Synchronous announcer text + long-output summaries | P7 | verified | unit/linux/output.test.ts + component/terminal/terminal-view.test.tsx announcer cases green 2026-09-23 | |
| `LNX-OUT-07` | Timeline cleanup (no leaks) | P7 | verified | component/linux/output.test.tsx 200-reveal cleanup loop green 2026-09-23 | |

### `08-boot-and-motd.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `LNX-BOOT-01` | Kernel-log boot from real facts, ≤ 600 ms, doubles as loading, any key skips | P7 | verified | component/linux/shell.test.tsx boot facts, duration and any-key skip cases green 2026-09-23 | |
| `LNX-BOOT-02` | Login block with `Last login … from {previousOs}`; no password prompt | P7 | verified | component/linux/shell.test.tsx previous-OS login and no-password case green 2026-09-23 | |
| `LNX-BOOT-03` | MOTD from data with **insertable** entries (never executed) + continuity line | P7 | verified | unit/linux/model.test.ts + component/linux/shell.test.tsx green 2026-09-23 | |
| `LNX-BOOT-04` | Appearance rules: boot/login first chooser entry only; MOTD per fresh session; none on deep link/re-entry | P7 | verified | component/linux/shell.test.tsx first-entry, re-entry and deep-link cases green 2026-09-23 | |
| `LNX-BOOT-05` | Autofocus on fine pointers only; "tap here to type" on coarse | P7 | verified | component/linux/shell.test.tsx + e2e/linux.spec.ts green across desktop, iPhone, Pixel and reduced-motion 2026-09-23 | |
| `LNX-BOOT-06` | Slow/failure states without alarming output | P7 | verified | component/terminal/terminal-view.test.tsx calm loading failure and retry case green 2026-09-23 | |
| `LNX-BOOT-07` | Reduced motion skips boot/login; announcer summaries | P7 | verified | component/linux/shell.test.tsx + e2e/linux.spec.ts green across desktop, iPhone, Pixel and reduced-motion 2026-09-23 | |

### `09-cross-os-features.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `LNX-X-01` | Résumé fast path: status-bar link, `resume`, MOTD entry, viewer download | P7 | verified | component/linux/shell.test.tsx + e2e/linux.spec.ts green across desktop, iPhone, Pixel and reduced-motion 2026-09-23 · the viewer shows the published PDF's page: `e2e/resume.spec.ts` › linux: the résumé viewer shows the published PDF's page green 2026-09-23 (preview build .next-resume) | |
| `LNX-X-02` | `search` output with insertable entries; native `find`/`grep` parity | P7 | verified | component/linux/shell.test.tsx + e2e/linux.spec.ts green across desktop, iPhone, Pixel and reduced-motion 2026-09-23 | |
| `LNX-X-03` | Continuity via MOTD line / one-time notice | P7 | verified | component/linux/shell.test.tsx one-time continuity notice case green 2026-09-23 | |
| `LNX-X-04` | Suggest-and-wait tour; graceful exit on free typing | P7 | verified | component/linux/shell.test.tsx real tour and free-typing exit case green 2026-09-23 | |
| `LNX-X-05` | Eggs registered as hidden commands; found counter in `settings list` | P7 | verified | unit/terminal/commands.test.ts + component/linux/shell.test.tsx settings counter case green 2026-09-23 | |
| `LNX-X-06` | `exit`/`switch` behaviours + logout exit beat | P7 | verified | e2e/linux.spec.ts X-06 layered exit and switch cases green 2026-09-23 | |

### `10-responsive.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `LNX-RESP-01` | Layouts per size class incl. 120-col cap, overlay and pager viewer modes | P7 | verified | unit/linux/model.test.ts + component/linux/shell.test.tsx green 2026-09-23 | |
| `LNX-RESP-02` | Touch prompt: form/input attributes, 16 px, `input`-event reading, no focus on scrollback tap | P7 | verified | component/linux/shell.test.tsx + e2e/linux.spec.ts green across desktop, iPhone, Pixel and reduced-motion 2026-09-23 | |
| `LNX-RESP-03` | `visualViewport`-driven layout keeps the prompt above the keyboard | P7 | verified | e2e/linux.spec.ts visualViewport prompt-position case green 2026-09-23 | |
| `LNX-RESP-04` | Accessory key row (keeps focus, completion/history/cancel), hidden with hardware keyboards | P7 | verified | e2e/linux.spec.ts touch accessory completion/history/cancel case green 2026-09-23 | |
| `LNX-RESP-05` | Tappable entries insert by node kind; never execute | P7 | verified | component/linux/shell.test.tsx + e2e/linux.spec.ts green across desktop, iPhone, Pixel and reduced-motion 2026-09-23 | |
| `LNX-RESP-06` | Narrow-width output formats (stacked tables, column fitting) | P7 | verified | unit/terminal/golden.test.ts 40-column fixtures + component/linux/shell.test.tsx narrow layout green 2026-09-23 | |
| `LNX-RESP-07` | Rotation preserves draft, caret, viewer content; safe areas | P7 | verified | e2e/linux.spec.ts rotation draft/viewer preservation and safe-area case green 2026-09-23 | |

### `11-accessibility.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `LNX-A11Y-01` | Landmark/DOM structure: scrollback region, hint slot, labelled prompt, separate log announcer | P7 | verified | component/linux/shell.test.tsx + e2e/linux.spec.ts green across desktop, iPhone, Pixel and reduced-motion 2026-09-23 | |
| `LNX-A11Y-02` | Synchronous final-text announcements; > 10-line summaries; own echo not announced | P7 | verified | unit/linux/output.test.ts + component/terminal/terminal-view.test.tsx announcement cases green 2026-09-23 | |
| `LNX-A11Y-03` | **Tab is never a trap** (pass-through on empty; Esc-then-Tab always exits) | P7 | verified | component/linux/shell.test.tsx + e2e/linux.spec.ts green across desktop, iPhone, Pixel and reduced-motion 2026-09-23 | |
| `LNX-A11Y-04` | Ctrl+C respects selection; no hijacked browser chords | P7 | verified | component/terminal/terminal-view.test.tsx selection and browser-chord cases green 2026-09-23 | |
| `LNX-A11Y-05` | Focus rules (autofocus by pointer type, viewer, hints, scrollback typing redirect) | P7 | verified | component/linux/shell.test.tsx + e2e/linux.spec.ts green across desktop, iPhone, Pixel and reduced-motion 2026-09-23 | |
| `LNX-A11Y-06` | Contrast, zoom/200 % text, forced-colors, non-colour cues | P7 | verified | e2e/linux.spec.ts light/dark axe, 200% text and forced-colors cases green 2026-09-23 | |
| `LNX-A11Y-07` | Insertable entries as named buttons | P7 | verified | component/linux/shell.test.tsx + e2e/linux.spec.ts green across desktop, iPhone, Pixel and reduced-motion 2026-09-23 | |
| `LNX-A11Y-08` | Screen-reader script recorded for release (NVDA + VoiceOver on the terminal) | P8 | planned | | |

### `12-edge-cases.md`
| ID | Feature | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|---|
| `LNX-CASE-01` | E1–E8 (invalid input, errors, read-only FS, caps, paste) | P7 | verified | unit/terminal/shell.test.ts + e2e/linux.spec.ts invalid/read-only/cap/paste cases green 2026-09-23 | |
| `LNX-CASE-02` | E9–E11 (Enter repeat, typing during reveal, cd spam rate degrade) | P7 | verified | component/terminal/terminal-view.test.tsx reveal/rate cases + unit/terminal/history.test.ts green 2026-09-23 | |
| `LNX-CASE-03` | E12–E17 (Back/Forward follows cwd without re-executing, refresh, deep links, layered exit) | P7 | verified | component/linux/shell.test.tsx + e2e/linux.spec.ts green across desktop, iPhone, Pixel and reduced-motion 2026-09-23 | |
| `LNX-CASE-04` | E18–E23 (resize, keyboard, OS switch/return, storage, hidden tab) | P7 | verified | unit/kernel flows/validation + component/linux/shell.test.tsx + e2e/linux.spec.ts switch/rotation/storage/hidden-tab cases green 2026-09-23 | |
| `LNX-CASE-05` | E24–E26 (announcer queueing, selection respect, fuzzing) | P7 | verified | unit/terminal/shell.test.ts 10,000-case fuzz + component announcer/selection cases green 2026-09-23 | |

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
