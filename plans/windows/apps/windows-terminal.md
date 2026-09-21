# Windows 11 / apps — Windows Terminal

## Role + requirement refs
The shared terminal engine (`linux/02`–`04`) in a Windows Terminal skin. R23, R24. `AppRole: terminal` · slug
`terminal`. Owns no section.

## Portfolio mapping
Same VFS and command set, presented with Windows flavour:
- Prompt `PS C:\Users\Jaswanth>` ; paths print with backslashes (`C:\Users\Jaswanth\projects`); the engine's POSIX
  paths are mapped by a **display adapter** only (internally still `~/projects`).
- **Aliases that Windows users expect** map onto the same commands: `dir` → `ls` · `type` → `cat` · `cls` → `clear` ·
  `start <file>` / `ii <file>` → `open` · `cd ..` and `cd \` work · `Get-Help` → `help`. Both `/` and `\` separators
  are accepted on input.
- `open`/`start` dispatches the **Windows app** that owns the content (`start resume` → Edge PDF tab).

## Anatomy
Window 760 × 480 (min 420 × 260). **Tab strip in the title bar**: "Windows PowerShell" tab with icon · "+" · **▾
dropdown** (profiles: Windows PowerShell · Command Prompt · *Ubuntu* → "Switch to the Linux experience…" which offers
`SWITCH_OS{linux}`). Body: **Acrylic background** (one live blur surface; solid on T0), Cascadia-like mono via the
shared mono face, 14 px, line-height 1.3. Command Prompt profile changes prompt to `C:\Users\Jaswanth>` and colours.

## Behaviour & states
Engine behaviours identical to Linux (history, Tab completion, Ctrl+C, Ctrl+L). Differences:
- Errors use PowerShell voice: `foo : The term 'foo' is not recognized as the name of a cmdlet…` followed by the
  engine's suggestion line ("Did you mean `ls`?").
- No hint chip (belongs to Linux); `help` / `Get-Help` is the affordance.
- Max 3 tabs; each tab is a fresh session; closing the last tab closes the window.
- Output reveal per `linux/07`, instantly completed by any key.

## Navigation & routes
`/windows/terminal`; cwd not encoded (only the Linux OS encodes cwd). Session persists with the Windows session.

## Motion
Tab open/close 167 ms; dropdown 167/83 ms. Otherwise none.

## Responsive
`compact`: full-window terminal + the accessory key row from `linux/10-responsive.md` on coarse pointers (adds a `\`
key); `visualViewport` handling identical.

## Accessibility
Same terminal contract as Linux (`shared/09`). Tab strip = APG tabs; dropdown = `Menu`. Native context menu preserved.

## Edge cases
`exit` closes the tab. Eggs work (`sudo` replies "sudo: not on Windows — but the answer is still yes." then the
`EGG-SUDO-01` block). Multi-line paste trimmed to one line with a notice.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `WIN-TERM-01` | Terminal skin: tab strip in title bar, profile dropdown, Acrylic body | `e2e: N2 tabs + dropdown; blur count within cap` | P4 |
| `WIN-TERM-02` | PowerShell/CMD prompts + backslash display adapter over the shared VFS | `unit: path display adapter round-trips; input accepts / and \` | P4 |
| `WIN-TERM-03` | Windows aliases (`dir`, `type`, `cls`, `start`, `ii`, `Get-Help`) | `unit: alias table resolves to engine commands` | P4 |
| `WIN-TERM-04` | PowerShell-voiced errors with suggestions | `unit: error formatter snapshot` | P4 |
| `WIN-TERM-05` | `start`/`open` dispatches the owning Windows app | `e2e: start resume → Edge PDF tab` | P4 |
| `WIN-TERM-06` | Shared engine reuse + a11y contract parity | `static: imports lib/terminal only; cmp: Terminal a11y suite` | P4 |
| `WIN-TERM-07` | "Ubuntu" profile offers the Linux OS | `e2e: choosing it asks to switch; never switches silently` | P4 |

## Not like the others
**PowerShell prompt, backslash paths, `dir`/`type`/`cls` aliases, tabs + profile dropdown, Acrylic body** (macOS
Terminal: zsh `%`, plain window; Linux: the terminal is the whole OS with hints, MOTD and cwd in the URL).
