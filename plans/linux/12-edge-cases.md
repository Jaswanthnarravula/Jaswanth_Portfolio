# Linux / 12 — Edge cases

## Role + requirement refs
Linux manifestations of the engineered edge cases, plus the ones only a shell has. Generic mechanisms:
`shared/04-os-kernel.md`. R46, smell test 6.

| # | Scenario | Expected result | Mechanism |
|---|---|---|---|
| E1 | Invalid command (`projcts`) | `bash: projcts: command not found` + dim `Did you mean 'projects'?`; exit 127; red `$` on the next prompt; URL untouched | `LNX-SH-05` |
| E2 | Three invalid commands in a row | The hint nudge appears (rate-limited) | `LNX-HINT-01` |
| E3 | Empty Enter / whitespace only | New prompt line, no output, not recorded in history | engine no-op |
| E4 | Unterminated quote / stray operator | `bash: unexpected EOF…` / `syntax error near unexpected token` (exit 2); never a JS error | tokenizer/parser totality |
| E5 | `cat projects` · `cd about.txt` · `cd nope` · `cd .ssh` | The four exact POSIX-style errors | VFS resolve reasons |
| E6 | `echo hi > x` · `rm about.txt` · `touch x` · `mkdir y` | `Read-only file system` (or the `rm` egg for `rm -rf /`) | read-only FS |
| E7 | Huge output (`grep -r e /`, `cat` of everything) | Capped at 2000 lines with the truncation notice; reveal skipped above 200 lines; UI stays responsive | engine caps + `LNX-OUT-02` |
| E8 | Pasting multi-line text / a 5 000-char line | First line only + notice; input length capped at 1000 chars with a notice | line editing |
| E9 | Holding Enter (key repeat) | Prompts appear at frame rate without reveals stacking; no timeline leak | `progress(1)` on each Enter |
| E10 | Typing during a reveal | All characters land; reveal completes instantly | `LNX-OUT-03` |
| E11 | Rapid `cd` spam (`cd projects` / `cd ..` × 30) | URL follows; after 20 pushes in 10 s history degrades to `replace` (Safari limit) and recovers | `ROUTE-TERM-01` |
| E12 | Browser Back/Forward | Walks previous cwds/viewer states; the **shell's cwd follows the URL** and prints a dim `cd {path}` notice so the scrollback stays truthful; never re-executes commands | route reconcile → `TERMINAL_CD` without execution |
| E13 | Refresh on `/linux/terminal/projects` | Fallback → shell revives: session scrollback restored if < 24 h (ends with dim `— session restored —`), cwd from the URL; MOTD not reprinted; no boot | URL wins; snapshot for the rest |
| E14 | Cold deep link to `/linux/viewer/projects/{slug}` | Seeded scrollback (`cd projects`, `open …`) + viewer open; no boot/MOTD | `LNX-VIEW-05` |
| E15 | Removed slug in URL/session | Parent directory listing + dim notice; URL canonicalized | `ROUTE-CODEC-02` |
| E16 | `open` while the viewer is already open | Content swaps in place; one history entry | `LNX-VIEW-01` |
| E17 | `exit` with viewer open · `exit` in pager | Closes viewer · quits pager; a second `exit` logs out | layered exit |
| E18 | Resize/rotate during split animation or reveal | Both complete instantly; single re-wrap; draft and caret kept | `LNX-VIEW-06`, `LNX-RESP-07` |
| E19 | Virtual keyboard opens/closes repeatedly; iOS URL bar collapses | Prompt stays glued above the keyboard; no layout jump beyond the keyboard height | `--vvh` |
| E20 | Switch OS mid-reveal or mid-boot | Epoch bump; reveal killed; session parks with cwd, history, scrollback | `KRN-SWITCH-01` |
| E21 | Return to Linux later in the session | Same scrollback, cwd, draft; no boot/MOTD; continuity notice if applicable | `KRN-SES-01` |
| E22 | Storage disabled | History/scrollback live for the session only; `settings list` notes it | safe storage |
| E23 | Hidden tab mid-boot or mid-reveal | Completed on return | derive-from-state |
| E24 | Screen reader + fast commands | Announcements are queued politely, never truncated mid-word; summaries for long outputs | announcer |
| E25 | Selection + Ctrl+C / right-click | Browser copy / native context menu — never intercepted | `LNX-A11Y-04` |
| E26 | Fuzzed input (random bytes, emoji, RTL text, 10 000 random command strings) | Never throws; output is an error line | `LNX-SH-10` |

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `LNX-CASE-01` | E1–E8 (invalid input, errors, read-only FS, caps, paste) | `e2e: L1 Linux command suite + exact error strings` | P7 |
| `LNX-CASE-02` | E9–E11 (Enter repeat, typing during reveal, cd spam rate degrade) | `e2e: Linux impatience script part A` | P7 |
| `LNX-CASE-03` | E12–E17 (Back/Forward follows cwd without re-executing, refresh, deep links, layered exit) | `e2e: H1 + D1 + P1 on Linux` | P7 |
| `LNX-CASE-04` | E18–E23 (resize, keyboard, OS switch/return, storage, hidden tab) | `e2e: part B + L3` | P7 |
| `LNX-CASE-05` | E24–E26 (announcer queueing, selection respect, fuzzing) | `cmp + unit: fuzz 10k inputs never throws` | P7 |

## Not like the others
Only Linux has **language-level** edge cases (quoting, operators, fuzzing) and the rule that **history traversal moves
the cwd but never re-runs a command**. GUI OSes worry about windows and gestures; Linux worries about strings.
