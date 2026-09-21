# Linux / 02 — Shell engine

## Role + requirement refs
The pure-TypeScript engine (`lib/terminal`) that makes navigation **coherent** rather than a set of hard-coded demos.
Requirements: R28, R29, R45, north-star B4. No React, no DOM; consumed by the Linux OS and by the macOS/Windows
Terminal apps.

## Pipeline
`input string → tokenize → expand → parse → execute → { lines, exitCode, effects }`

### Tokenizer (`LNX-SH-01`)
Whitespace-separated words; **single quotes** (literal), **double quotes** (allow `$VAR`, `\"`, `\\`), **backslash**
escapes, `#` comments (when at word start), operators `|`, `&&`, `||`, `;`, `>`, `>>`, `<`. Unterminated quote →
`bash: unexpected EOF while looking for matching '"'` (exit 2). Output tokens keep source spans (for completion and
for error carets).

### Expansion (`LNX-SH-02`)
Order: tilde (`~`, `~/x`) → variables (`$HOME`, `$USER`, `$PWD`, `$OLDPWD`, `$HOSTNAME`, `$SHELL`, `$COLUMNS`,
`$LINES`, `$?`, `${VAR}`; unknown → empty) → **globs** (`*`, `?`, `[a-z]` against the VFS; no match → literal, like
bash) → quote removal. **History expansion:** `!!`, `!n`, `!prefix` (echoed before running, as bash does).

### Parser (`LNX-SH-03`)
Grammar: `list := pipeline (('&&' | '||' | ';') pipeline)*` · `pipeline := command ('|' command)*` ·
`command := WORD (WORD)* (redirect)*`. **Redirections to files fail by design:** `bash: x: Read-only file system`
(exit 1) — the portfolio is read-only. `<` works for VFS files. Aliases (`.bashrc`) are expanded on the first word.

### Execution (`LNX-SH-04`)
```ts
interface Ctx { cwd: VfsPath; env: Readonly<Record<string,string>>; vfs: Vfs; cols: number; rows: number;
  stdin: readonly string[] | null; flavor: 'bash' | 'zsh' | 'powershell'; os: OsId }
type Line = { t: string; cls?: 'dir'|'exe'|'link'|'err'|'warn'|'dim'|'head'|'ok'; href?: RoutePath | string; insert?: string };
interface Result { lines: readonly Line[]; exitCode: number; effects: readonly Effect[] }
type Effect = { k: 'cd'; to: VfsPath } | { k: 'open'; ref: ContentRef | 'resume' } | { k: 'clear' } | { k: 'exit' }
  | { k: 'pref'; key: string; value: unknown } | { k: 'switch-os'; to?: OsId } | { k: 'mailto' } | { k: 'pager'; lines: readonly Line[] }
  | { k: 'tour' } | { k: 'egg'; id: string };
type Command = (args: ParsedArgs, ctx: Ctx) => Result;   // pure; no I/O
```
- **Pipes** pass `lines[].t` as `stdin` to the next command (`grep`, `head`, `tail`, `wc`, `sort`, `uniq`, `less`, `cat`).
- `&&` / `||` / `;` follow exit codes. `$?` = last exit code.
- **Exit codes:** 0 ok · 1 general error · 2 usage · 126 not executable · **127 command not found** · 130 Ctrl+C.
- Effects are returned, never performed — the host (Linux OS / Terminal app) maps them to kernel actions. That is why
  `open resume` opens Preview on macOS, Edge on Windows and the viewer tile on Linux with one engine.
- `flavor` only changes *voice* (prompt, error phrasing, path display) through adapters — never logic.

### Errors (`LNX-SH-05`) — exact strings
`bash: foo: command not found` (+ dim suggestion line `Did you mean 'ls'?` when Damerau-Levenshtein ≤ 2, else
`Try 'help'.`) · `bash: cd: nope: No such file or directory` · `bash: cd: about.txt: Not a directory` ·
`cat: projects: Is a directory` · `cat: x: No such file or directory` · `ls: cannot access 'x': No such file or
directory` · `bash: ./resume.pdf: Permission denied` (exit 126) · `bash: syntax error near unexpected token '|'`.

### History (`LNX-SH-06`)
Session list (cap 200), consecutive duplicates collapsed, lines starting with a space not recorded. ↑/↓ navigate with
the **current draft preserved**; Ctrl+R reverse-search (inline `(reverse-i-search)'q':` prompt); `history`, `history -c`.

### Completion (`LNX-SH-07`)
Tab on: first word → commands + aliases; later words → VFS paths relative to cwd (directories get `/`), command-specific
argument sets (`open` → openable refs, `man` → commands, `switch` → released OSes), flags after `-`.
Single candidate → completes (+ space, or `/` for directories). Multiple → completes the common prefix; **second Tab
lists candidates** in columns. None → visual bell. **Empty input → returns `PASS_THROUGH`** so Tab moves focus
(`11-accessibility.md`).

### Line editing (`LNX-SH-08`)
Native `<input>` editing plus: Ctrl+A/E (home/end), Ctrl+U (kill to start), Ctrl+K (kill to end), Ctrl+W (kill word),
Ctrl+L (clear), Ctrl+C (cancel line → prints `^C`, exit 130; **only when no text is selected**, otherwise copy),
Ctrl+D on empty line → `exit`. Multi-line paste → first line only + dim notice.

## Edge cases
Deeply nested pipelines capped at 8 stages; output capped at 2000 lines per command (then `… output truncated — pipe
to 'less'`); recursion-safe alias expansion (no loops); every command is total (never throws — unknown flags → usage
error exit 2).

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `LNX-SH-01` | Tokenizer: quotes, escapes, comments, operators, spans | `unit: tokenizer: quotes, escapes, unterminated quote errors` | P3 |
| `LNX-SH-02` | Expansion: tilde, variables, `$?`, globs, history expansion | `unit: expansion table incl. no-match glob stays literal` | P3 |
| `LNX-SH-03` | Parser: lists, pipelines, redirects (read-only FS), aliases | `unit: AST fixtures; '>' yields Read-only file system` | P3 |
| `LNX-SH-04` | Pure execution with pipes, exit codes and returned effects | `unit: 'ls | head -2 && echo ok' → lines + exit 0; effects never performed by the engine` | P3 |
| `LNX-SH-05` | Exact error strings + suggestions | `unit: error snapshot table` | P3 |
| `LNX-SH-06` | History with draft preservation, Ctrl+R, `history -c` | `unit: history model; e2e: L1 up/down keeps the draft` | P3 |
| `LNX-SH-07` | Completion (commands, paths, args, flags; double-Tab listing; PASS_THROUGH on empty) | `unit: completion: empty input returns PASS_THROUGH; path/arg cases` | P3 |
| `LNX-SH-08` | Line-editing keys; Ctrl+C respects selection; paste trimming | `cmp: Ctrl+C with selection copies; Ctrl+U/K/W` | P3 |
| `LNX-SH-09` | Flavor adapters (bash / zsh / PowerShell voice) without logic forks | `unit: same AST + effects across flavors; only strings differ` | P3 |
| `LNX-SH-10` | Totality + caps (8 stages, 2000 lines), no throw | `unit: fuzz 5k random inputs never throws` | P3 |

## Not like the others
The only part of the product that is a **language interpreter**. Other OSes map clicks to kernel actions; here text is
parsed into an AST, executed purely, and only then mapped to the same kernel actions through effects.
