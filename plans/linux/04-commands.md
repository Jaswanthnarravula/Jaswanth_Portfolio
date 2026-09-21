# Linux / 04 — Commands

## Role + requirement refs
Every command: synopsis, behaviour, aliases, output format and exact errors. Requirements: R28, R29. Commands are pure
functions registered in one table (`lib/terminal/commands/index.ts`); `help`, `man`, `which`, `/usr/bin`, completion
and the search index are all generated from that table — they cannot drift.

Conventions: unknown flag → `cmd: invalid option -- 'x'` + `Try 'man cmd' for more information.` (exit 2).
`--help` on any command prints its synopsis (exit 0). All output respects `cols`.

## Navigation and files (engine core — P3)

| ID | Synopsis | Behaviour | Errors |
|---|---|---|---|
| `LNX-CMD-help` | `help [cmd]` | Grouped list: *Explore* · *About me* · *Files* · *System*; one line each; ends with dim "Some commands aren't listed." With arg → same as `man` summary | unknown → `help: no help topics match 'x'` |
| `LNX-CMD-man` | `man <cmd>` | NAME / SYNOPSIS / DESCRIPTION / EXAMPLES, opened in the pager | `No manual entry for x` (exit 16) |
| `LNX-CMD-pwd` | `pwd` | Absolute cwd (`/home/jaswanth/projects`) | — |
| `LNX-CMD-cd` | `cd [dir \| - \| ~]` | No arg → `$HOME`; `-` → `$OLDPWD` (prints it); effect `cd` → URL updates | `bash: cd: x: No such file or directory` · `…: Not a directory` · `…: Permission denied` |
| `LNX-CMD-ls` | `ls [-l] [-a] [-1] [-h] [path…]` | Column layout fitted to `cols`; dirs **blue** with `/` hint in `-F` style off by default; executables cyan; pdf magenta; `-a` shows dotfiles + `.` `..`; `-l` = mode, links, owner, group, size (`-h` human), date, name + `total N`. Entries carry `insert` data so tapping one *inserts* its name | `ls: cannot access 'x': No such file or directory` (exit 2) |
| `LNX-CMD-tree` | `tree [-L n] [path]` | Box-drawing tree, dirs blue, summary `N directories, M files` | as `ls` |
| `LNX-CMD-cat` | `cat <file…>` | Prints file text (width-aware). `cat resume.pdf` → dim notice `resume.pdf: binary file — try 'open resume'` | `cat: x: No such file or directory` · `cat: projects: Is a directory` |
| `LNX-CMD-head` / `LNX-CMD-tail` | `head\|tail [-n N] [file]` | First/last N (default 10); reads stdin when piped | usage (exit 2) |
| `LNX-CMD-less` | `less <file>` / `… \| less` | Pager effect: full-tile pager, `q` quits, Space/b page, `/` search, `g`/`G` | file errors as `cat` |
| `LNX-CMD-grep` | `grep [-i] [-n] [-r] <pattern> [path…]` | Literal/regex-lite match, highlights matches in red, `-r` walks the VFS, prefixes `path:` | exit 1 when no match (silent) |
| `LNX-CMD-find` | `find [path] [-name glob] [-type f\|d]` | One path per line | path errors |
| `LNX-CMD-wc` / `LNX-CMD-sort` / `LNX-CMD-uniq` | standard subsets | Work on files or stdin | usage |
| `LNX-CMD-echo` | `echo [-n] [args…]` | After expansion | — |
| `LNX-CMD-open` | `open <resume \| path>` (alias `xdg-open`) | Effect `open`: `resume`/`resume.pdf` → viewer at résumé; a project/role/school file → viewer at that ref; a directory → `cd` + `ls`; text files without a rich view → `less` | `open: x: No such file or directory` |
| `LNX-CMD-history` | `history [-c]` | Numbered list; `-c` clears | — |
| `LNX-CMD-clear` | `clear` (also Ctrl+L) | Effect `clear` (scrollback emptied; MOTD not reprinted) | — |
| `LNX-CMD-which` / `LNX-CMD-type` | `which <cmd>` | `/usr/bin/cmd` or `alias ll='ls -l'` | exit 1 silent |
| `LNX-CMD-alias` | `alias` | Lists aliases from `.bashrc` (defining new ones → read-only notice) | — |

## About-me shortcuts (engine core — P3)

| ID | Synopsis | Behaviour |
|---|---|---|
| `LNX-CMD-whoami` | `whoami` | `jaswanth` then a dim one-liner: name — headline · location (so the classic command is also useful) |
| `LNX-CMD-about` | `about` | = `cat ~/about.txt` |
| `LNX-CMD-projects` | `projects [--all]` | Table: slug · name · stack (truncated) · year; featured first; footer dim: `cd projects && ls` · `open projects/<slug>` (entries insertable) |
| `LNX-CMD-skills` | `skills [group]` | Groups with 5-block bars (`█████░`) + years; `skills frontend` filters |
| `LNX-CMD-experience` | `experience` | Reverse-chronological: dates · role @ company · one-line summary; footer hints as above |
| `LNX-CMD-education` | `education` | School · degree · dates |
| `LNX-CMD-contact` | `contact` | Channels as `label  value` rows; links are real `<a>`; footer: `mail` to write to me |
| `LNX-CMD-resume` | `resume [--download]` | = `open resume`; `--download` triggers the download effect and prints `saved: Jaswanth-Resume.pdf` |
| `LNX-CMD-mail` | `mail [-s subject]` | Effect `mailto` (same builder as the GUI mail apps); prints `Handing off to your mail client…` + the address |

## System (P7)

| ID | Synopsis | Behaviour |
|---|---|---|
| `LNX-CMD-settings` | `settings [list \| set <key> <value>]` | Keys: `motion full\|reduced\|system`, `glass`, `theme dark\|light\|system`, `sound on\|off`, `hints on\|off`, `textsize 100-130` → effect `pref` |
| `LNX-CMD-theme` / `LNX-CMD-motion` / `LNX-CMD-sound` / `LNX-CMD-hints` | shorthands | e.g. `motion reduced` |
| `LNX-CMD-search` | `search <query>` | Shared search index (`shared/15`): numbered results as paths/commands; entries insertable; **never opens automatically** |
| `LNX-CMD-switch` | `switch [os]` (aliases `exit`, `logout`, `poweroff` → chooser) | Lists released OSes or switches (effect `switch-os`); `exit` with the viewer open closes the viewer first |
| `LNX-CMD-tour` | `tour` | Starts the Linux tour (suggest-and-wait, `TOUR-LNX-01`) |
| `LNX-CMD-legal` | `legal` | `LegalNotice` text in the pager |
| `LNX-CMD-plain` | `plain` | Opens `/plain` |
| `LNX-CMD-date` / `LNX-CMD-uname` / `LNX-CMD-hostname` / `LNX-CMD-uptime` / `LNX-CMD-id` | standard | `uname -a` → `PortfolioOS portfolio {contentRev} … GNU/Linux`; `uptime` → "up {career length}, 1 user" |
| `LNX-CMD-finger` | `finger [jaswanth]` | Login, name, `.plan` contents |

## Aliases (defined in `~/.bashrc`, shown by `alias`)
`ll='ls -l'` · `la='ls -la'` · `l='ls -1'` · `..='cd ..'` · `cls='clear'` · `dir='ls'` · `type='cat'`\* · `more='less'` ·
`cv='resume'` · `work='experience'` · `repos='projects'` · `email='mail'` · `hello='contact'` · `quit='exit'` ·
`h='help'` · `?='help'`. (\*PowerShell flavor only, to avoid shadowing bash `type`.)

## Easter-egg commands
`sudo`, `neofetch`, `vim`/`vi`/`nano`/`emacs`, `rm`, `cowsay`, `fortune`, `cmatrix` — specified in
`shared/21-easter-eggs.md` (IDs `EGG-*`); registered in the same table with `hidden: true` (absent from `help`,
present in completion after the second letter).

## Feature IDs + acceptance tests
Each `LNX-CMD-*` ID above is a feature. Shared acceptance per command: **`unit: L1 golden output at 80 and 40 cols +
every listed error string + exit code`**. Table-level features:

| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `LNX-CMD-help` | help (generated from the registry) | `unit: every non-hidden command appears exactly once` | P3 |
| `LNX-CMD-man` | man pages generated from the registry | `unit: man for every command` | P3 |
| `LNX-CMD-pwd` | pwd | `unit: L1 golden` | P3 |
| `LNX-CMD-cd` | cd incl. `-`, `~`, errors | `unit: cd into file → not a directory` | P3 |
| `LNX-CMD-ls` | ls with flags, columns, colours, insertable entries | `unit: column fitting at 80/40; -la fields` | P3 |
| `LNX-CMD-tree` | tree | `unit: L1 golden` | P3 |
| `LNX-CMD-cat` | cat incl. binary notice | `unit: cat dir → Is a directory` | P3 |
| `LNX-CMD-head` | head | `unit: stdin + file` | P3 |
| `LNX-CMD-tail` | tail | `unit: stdin + file` | P3 |
| `LNX-CMD-less` | pager effect | `unit: effect shape; e2e: q quits` | P3 |
| `LNX-CMD-grep` | grep incl. `-r`, exit 1 on no match | `unit: highlights + exit codes` | P3 |
| `LNX-CMD-find` | find | `unit: -name/-type` | P3 |
| `LNX-CMD-wc` | wc | `unit: counts` | P3 |
| `LNX-CMD-sort` | sort | `unit: L1 golden` | P3 |
| `LNX-CMD-uniq` | uniq | `unit: L1 golden` | P3 |
| `LNX-CMD-echo` | echo | `unit: expansion applied` | P3 |
| `LNX-CMD-open` | open → effects per target kind | `unit: effect per kind; e2e: L1 open resume` | P3 |
| `LNX-CMD-history` | history | `unit: numbering + -c` | P3 |
| `LNX-CMD-clear` | clear | `unit: effect` | P3 |
| `LNX-CMD-which` | which | `unit: path or alias` | P3 |
| `LNX-CMD-type` | type | `unit: L1 golden` | P3 |
| `LNX-CMD-alias` | alias listing from `.bashrc` | `unit: matches LNX-FS-05` | P3 |
| `LNX-CMD-whoami` | whoami | `unit: L1 golden` | P3 |
| `LNX-CMD-about` | about | `unit: equals cat about.txt` | P3 |
| `LNX-CMD-projects` | projects table | `unit: from fixture; footer insertables` | P3 |
| `LNX-CMD-skills` | skills bars + filter | `unit: L1 golden` | P3 |
| `LNX-CMD-experience` | experience | `unit: L1 golden` | P3 |
| `LNX-CMD-education` | education | `unit: L1 golden` | P3 |
| `LNX-CMD-contact` | contact with real links | `unit: L1 golden; cmp: links rendered as anchors` | P3 |
| `LNX-CMD-resume` | resume / --download | `unit: effects` | P3 |
| `LNX-CMD-mail` | mail → mailto effect | `unit: shares the mailto builder` | P3 |
| `LNX-CMD-settings` | settings list/set → pref effects | `unit: key validation; e2e: motion reduced applies` | P7 |
| `LNX-CMD-theme` | theme shorthand | `unit: effect` | P7 |
| `LNX-CMD-motion` | motion shorthand | `unit: effect` | P7 |
| `LNX-CMD-sound` | sound shorthand | `unit: effect` | P7 |
| `LNX-CMD-hints` | hints on/off | `unit: effect; e2e: chip suppressed` | P7 |
| `LNX-CMD-search` | search over the shared index; never auto-opens | `e2e: S1 on Linux` | P7 |
| `LNX-CMD-switch` | switch / exit / logout | `e2e: exit closes viewer first, then offers Switch OS` | P7 |
| `LNX-CMD-tour` | tour | `e2e: T1 on Linux` | P7 |
| `LNX-CMD-legal` | legal notice in pager | `e2e: ASSET-LEGAL-01 on Linux` | P7 |
| `LNX-CMD-plain` | plain | `e2e: navigates to /plain` | P7 |
| `LNX-CMD-date` | date | `unit: L1 golden (fixed clock)` | P7 |
| `LNX-CMD-uname` | uname | `unit: L1 golden` | P7 |
| `LNX-CMD-hostname` | hostname | `unit: L1 golden` | P7 |
| `LNX-CMD-uptime` | uptime = career length | `unit: derives from data` | P7 |
| `LNX-CMD-id` | id | `unit: L1 golden` | P7 |
| `LNX-CMD-finger` | finger + .plan | `unit: derives from data` | P7 |
| `LNX-CMD-aliases` | alias set behaves as listed | `unit: each alias resolves` | P3 |
| `LNX-CMD-registry` | One registry generates help, man, which, /usr/bin, completion, search entries | `unit: all five views agree` | P3 |

## Not like the others
Where GUI OSes have apps, Linux has **a command vocabulary with Unix semantics** — flags, pipes, exit codes, man pages.
Convenience commands (`projects`, `skills`…) exist for speed, but everything they show is also reachable by plain
`cd`/`ls`/`cat`, which is what makes it explorable rather than scripted.
