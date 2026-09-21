# Linux / 09 — Cross-OS features (Linux presentation)

## Role + requirement refs
How the terminal presents the shared features. Contracts: `shared/14`, `shared/15`, `shared/16`, `shared/20`,
`shared/21`, `04-os-chooser.md`. N5, N9, N10, N11, N14.

## Résumé fast path (`shared/14`) — one action from anywhere
| Where | Element |
|---|---|
| Status bar | **`résumé`** — a real link to `/linux/viewer/resume` (a direct action, not a hint, so it opens immediately) |
| Command | `resume` (alias `cv`) = `open resume`; `resume --download` |
| MOTD | first entry (`→ open resume`, insertable) |
| Viewer | `[d] download` |
| Tile title strip (compact) | `résumé` moves here when the status bar collapses |

## System search (`shared/15`)
`search <query>` prints numbered matches from the shared index:
```
 1  projects/portfolio-os.md      Portfolio OS — five operating systems in a browser
 2  skills.txt:14                 TypeScript ██████ 6y
 3  command: projects             list all projects
```
Entries are **insertable** (`open projects/portfolio-os`, `cat skills.txt`, `projects`) — never opened automatically.
`find`, `grep -r` and Tab completion are the native alternatives. No results → `search: nothing found for 'x'` +
`Try 'ls' or 'help'.` (exit 1).

## Continuity (`shared/16`)
MOTD line on arrival (`LNX-BOOT-03`). If Linux was already running this session (no MOTD on re-entry), the line is
printed once above the prompt as a dim notice with the insertable command. Accepting = the visitor runs it.

## Guided tour (`shared/20`) — suggest-and-wait
`tour` (or the offer, shown in the **hint slot** as `New here? A 20-second tour → tour`, insertable) starts a sequence in
which each step **inserts a suggested command and waits for Enter**:
① `ls` — "Everything is a file." ② `cd projects` ③ `ls` ④ `open projects/{first featured}` — "Rich content opens
beside the shell. Press q to come back." ⑤ `resume` — "The résumé is always one command (or one click, top right)
away." ⑥ `help`.
Between steps a dim line explains what happened. Typing anything else ends the tour gracefully: `You've got it. 'tour'
starts again anytime.` The tour **never presses Enter** (`TOUR-LNX-01`). Reduced motion: identical (there is nothing
to remove).

## Easter eggs (`shared/21`)
All terminal eggs live here first: `sudo hire-me`, `neofetch`, `vim`/`vi`/`nano`/`emacs`, `rm -rf /`, `cowsay`,
`fortune`, `cmatrix`. Plus small authentic touches that are **not** catalogued eggs: `cd .ssh` → permission denied;
`cat /etc/os-release`; `uptime` = career length; `ls -la` reveals `.plan`. `settings list` shows `eggs found: n / N`.

## Switch OS
`exit` · `logout` · `poweroff` · `switch [os]` · status-bar **`exit`** · Alt+Shift+S. With no argument: prints the
released OSes as insertable `switch macos` … and `switch chooser`. **Exit beat:** prints `logout` then
`Connection to portfolio closed.` (≤ 300 ms, instant under reduced motion) → `CHOOSE-EXIT-01`. `switch` is the one
command whose effect leaves the OS, so it asks nothing and does it — the visitor typed it deliberately.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `LNX-X-01` | Résumé fast path: status-bar link, `resume`, MOTD entry, viewer download | `e2e: Q1 on Linux` | P7 |
| `LNX-X-02` | `search` output with insertable entries; native `find`/`grep` parity | `e2e: S1 on Linux; nothing opens automatically` | P7 |
| `LNX-X-03` | Continuity via MOTD line / one-time notice | `e2e: C1 with Linux as target (fresh + re-entry)` | P7 |
| `LNX-X-04` | Suggest-and-wait tour; graceful exit on free typing | `e2e: T1 on Linux — suggested command unsubmitted until Enter` | P7 |
| `LNX-X-05` | Eggs registered as hidden commands; found counter in `settings list` | `unit: hidden from help, present in completion; e2e: counter` | P7 |
| `LNX-X-06` | `exit`/`switch` behaviours + logout exit beat | `e2e: exit closes viewer first; then logs out to the chooser` | P7 |

## Not like the others
Every shared feature becomes **text you can run**: the résumé is a command and a status-bar word, search prints paths,
continuity is a MOTD line, the tour is a conversation with your own prompt, and leaving is `exit`.
