# macOS / apps — Terminal

## Role + requirement refs
Engineering depth for people who prefer typing: the **shared terminal engine** (`linux/02`–`04`) running inside a
macOS window. R23, R24. `AppRole: terminal` · slug `terminal`. Owns no section (every section is reachable through it).

## Portfolio mapping
Same VFS and commands as Linux (`linux/03-filesystem.md`, `linux/04-commands.md`), with a macOS flavour:
prompt `jaswanth@MacBook-Pro ~ %` (zsh style), `open <file>` opens the **macOS app** that owns that content
(`open resume` → Preview; `open projects/x` → GitHub at x; `open .` → Finder at cwd).

## Anatomy
Window 720 × 460 (min 420 × 260). Title bar shows `jaswanth — -zsh — 80×24` (live cols×rows). Body: scrollback +
prompt line, mono 13 px, line-height 1.35, padding 8 px, profile "Basic" (light) / "Pro" (dark) following the theme.
A slim tab bar appears only if a second tab is opened (max 2; second tab is a fresh session).

## Behaviour & states
| State | Behaviour |
|---|---|
| Focus | Clicking anywhere in the body focuses the input; caret blinks (1060 ms `steps(1)`), hollow when the window is inactive |
| Commands | Engine behaviour identical to Linux: history (↑/↓), Tab completion, Ctrl+C, Ctrl+L, `clear` |
| `open` | Dispatches `OPEN_APP` for the owning macOS app — the terminal stays open behind it |
| Hints | The "Need a hint?" chip is **not** shown here (that belongs to the Linux OS); `help` is the affordance |
| Output animation | Same capped line reveal as Linux (`linux/07`), instantly completed by any key |
| Resize | Cols × rows recomputed on commit; long lines wrap |
| Engine loading | First open lazy-loads the engine chunk; a static `Last login: …` line shows immediately |

## Navigation & routes
`/macos/terminal` (cwd is **not** encoded here — only the Linux OS encodes cwd in the URL). Session
(`TerminalSession`) persists with the macOS session: cwd, history, capped scrollback.

## Menu-bar menus
Shell: New Tab · Close Tab · Clear (Ctrl+L). Edit: Copy · Paste · Select All. View: Bigger / Smaller text. Help: `help`.

## Motion
None beyond output reveal and caret blink. Window follows normal WM motion.

## Responsive
`compact`: full-window terminal with the accessory key row from `linux/10-responsive.md` when the input is focused
on a coarse pointer; `visualViewport` handling identical.

## Accessibility
Identical contract to Linux (`shared/09` terminal section): labelled native input in a form, scrollback region,
separate `role="log"` announcer with synchronous final text, Tab pass-through rules, Ctrl+C only without a selection.
The native context menu is preserved for copy/paste.

## Edge cases
`exit` closes the window (with the normal close animation). `sudo`, `vim`, `neofetch` eggs work here too
(`shared/21`). Pasting multi-line text inserts only the first line and shows "Multi-line paste trimmed".

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `MAC-TERM-01` | Terminal window skin (zsh prompt, profiles, live cols×rows title) | `e2e: M2 prompt + title update on resize` | P3 |
| `MAC-TERM-02` | Shared engine reuse (no fork of logic) | `static: macOS terminal imports lib/terminal only; L1 command suite passes in this window` | P3 |
| `MAC-TERM-03` | `open` dispatches the owning macOS app | `e2e: open resume → Preview window` | P3 |
| `MAC-TERM-04` | Lazy engine chunk with instant static first line | `perf: engine requested on first open only` | P3 |
| `MAC-TERM-05` | Session persistence (cwd, history, scrollback cap) | `e2e: P1 history survives reload` | P3 |
| `MAC-TERM-06` | Accessibility contract parity with Linux | `cmp: Terminal a11y suite` | P3 |

## Not like the others
zsh `%` prompt in a traffic-light window, and `open` launches **GUI apps** (Windows Terminal: tabbed with a
dropdown, PowerShell-style `PS C:\Users\jaswanth>` prompt, acrylic background; Linux: the terminal *is* the OS — cwd
in the URL, hints, MOTD, viewer tile).
