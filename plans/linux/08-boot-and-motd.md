# Linux / 08 — Boot, login and MOTD

## Role + requirement refs
The Linux equivalents of the boot screen and the lock screen: a **kernel-log boot**, a **login line**, and a **message
of the day** whose entries work like lock-screen notifications — useful, insertable shortcuts. Requirements: R27, N6, N7,
R38. Appearance rules match every OS: **boot + login only on the first chooser entry per session; never on deep links,
refresh, `/go` or re-entry; any key skips; removed under reduced motion.** The **MOTD prints on every fresh session**
(it is the welcome message R27 asks for) but is short.

## Boot log (`LNX-BOOT-01`)
Black tile, dim mono text, lines appended at **8 ms per line, ≤ 600 ms total** (own timeline), each with a bracketed
status:
```
[    0.000000] PortfolioOS version {contentRev} (jaswanth@portfolio)
[    0.004211] Command line: BOOT_IMAGE=/boot/career root=/dev/skills ro quiet
[  OK  ] Mounted /home/jaswanth.
[  OK  ] Started Portfolio Data Layer ({n} projects, {m} roles).
[  OK  ] Reached target Shell.
```
- Line content is **generated from real facts** (counts from data, `contentRev`), 12–18 lines, no fake errors, no
  scary red text.
- It doubles as the chunk-loading screen: if the Linux chunk is not ready the last line waits as
  `[ **** ] Starting Shell…` with a text spinner (`|/-\`, 100 ms steps); ready → `[  OK  ]`.
- Any key/click → jumps to the end state immediately. Slow (> 4 s) → appends `If this takes long: open the plain
  portfolio` (link). Failure → `[FAILED] Failed to start Shell.` + `Retry` · `Plain portfolio` text buttons.

## Login (`LNX-BOOT-02`)
After the log clears (one frame):
```
PortfolioOS {resume.updated} portfolio tty1

portfolio login: jaswanth
Last login: {weekday} {month} {day} {HH:MM} from {previousOs | "the-internet"}
```
The username is printed, not typed (no fake typing delay). No password prompt (it would imply a gate).
`from {previousOs}` uses the OS the visitor came from — a quiet continuity touch.

## MOTD (`LNX-BOOT-03`) — `/etc/motd`, also readable with `cat /etc/motd`
```
Welcome, {visitor is never named}. This is Jaswanth's portfolio — as a shell.

  * résumé ready          →  open resume
  * {n} projects          →  cd projects && ls
  * {person.openTo}       →  contact
  * new here?             →  help        (or: tour)

Tip: Tab completes, ↑ recalls, and nothing here can be broken.
```
- The `→ command` parts are **insertable entries** (`data-insert`): click/tap/Enter on one **inserts** the command
  into the prompt — never executes (same rule as hints).
- **Continuity line** (when an offer exists, `shared/16`): `Last viewed on {os}: {path} — run 'open {path}' to
  continue` with the command insertable.
- ≤ 10 lines; respects `cols` (wraps the arrows column under 50 cols).
- Returning within the same session (OS re-entry) → **no MOTD**, the previous scrollback is simply there.
  Refresh / new session → MOTD only (no boot, no login). Deep link → MOTD is skipped; seeded scrollback instead
  (`06-rich-views.md`) or just the prompt at the URL's cwd.

## After the MOTD
The prompt `jaswanth@portfolio:~$ ` with a blinking caret; on fine pointers the input is **autofocused**; on coarse
pointers it is **not** (it would pop the keyboard and cover the screen) — a dim line says `tap here to type`.

## Navigation & routes
URL is already `/linux`. No history writes. Back during boot → chooser.

## Motion
Boot timeline only (8 ms/line). Login + MOTD appear as one reveal block per `07-output-animation.md`. Reduced motion:
everything appears instantly; boot and login are skipped.

## Accessibility
Boot log is `aria-hidden` (noise); status region says "Starting Linux" → "Linux ready". Login + MOTD go through the
normal `role="log"` announcer as one summarized message ("Welcome. 4 suggestions available."). MOTD insertables are
buttons named "Insert command: open resume".

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `LNX-BOOT-01` | Kernel-log boot from real facts, ≤ 600 ms, doubles as loading, any key skips | `e2e: throttled load shows the log; keypress jumps to the prompt` | P7 |
| `LNX-BOOT-02` | Login block with `Last login … from {previousOs}`; no password prompt | `unit: login text from session state` | P7 |
| `LNX-BOOT-03` | MOTD from data with **insertable** entries (never executed) + continuity line | `e2e: L2-style: clicking an MOTD entry inserts only; C1 with Linux as target` | P7 |
| `LNX-BOOT-04` | Appearance rules: boot/login first chooser entry only; MOTD per fresh session; none on deep link/re-entry | `e2e: D1 + reload + re-entry matrices` | P7 |
| `LNX-BOOT-05` | Autofocus on fine pointers only; "tap here to type" on coarse | `e2e: desktop focused; iphone not focused` | P7 |
| `LNX-BOOT-06` | Slow/failure states without alarming output | `e2e: offline → [FAILED] line + Retry + plain link` | P7 |
| `LNX-BOOT-07` | Reduced motion skips boot/login; announcer summaries | `e2e: R1; cmp: single summarized announcement` | P7 |

## Not like the others
Boot is a **scrolling kernel log**, the lock screen is a **login line**, and "notifications" are **MOTD lines you can
insert into your prompt** (GUI OSes: logos, progress indicators, clocks and tappable notification cards).
