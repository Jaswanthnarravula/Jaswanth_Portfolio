# Linux — folder index

## Identity statement
**Not another desktop.** Entering Linux drops the visitor into a convincing, developer-focused **terminal**:
`jaswanth@portfolio:~$`, a blinking caret, command history, tab completion, a real (virtual) filesystem generated from
the portfolio data, pipes, exit codes and honest error messages. There are **no app icons**. Content is reached by
*commands, paths and files*; richer content opens in a **viewer tile** beside the terminal and hands control straight
back to the shell.

The golden rule (north-star B4): it must be a **shell engine over a filesystem**, never a list of hard-coded
responses. If a technical visitor tries something reasonable (`cd ../experience && ls -l | head -3`), it works.

## How content is reached (the Linux "app map")

| Section | In the filesystem | Convenience command | Rich view |
|---|---|---|---|
| `about` | `~/about.txt` | `whoami`, `about` | — (text) |
| `projects` | `~/projects/{slug}.md`, `~/projects/README.md` | `projects` | `open projects/{slug}` → `/linux/viewer/projects/{slug}` |
| `experience` | `~/experience/{slug}.md` | `experience` | `open experience/{slug}` → viewer |
| `education` | `~/education/{slug}.md` | `education` | `open education/{slug}` → viewer |
| `skills` | `~/skills.txt` | `skills` | — (text) |
| `resume` | `~/resume.pdf` | `resume` = `open resume` | `/linux/viewer/resume` |
| `contact` | `~/contact.txt` | `contact` | — (text + `mail` hand-off) |

Addressable "apps" (kernel roles): `terminal` (slug `terminal`, URL carries the cwd) and `viewer` (slug `viewer`).

## Layout (a tiling layout, not a third window manager)
A slim **status bar** on top (workspace tags `1:term` `2:view` · résumé link · help · clock · `exit`) and one or two
**tiles** below: the terminal always; the viewer tile appears to the right on `open` (split 50/50, draggable divider
with keyboard alternative) and disappears on `q`. On phones the viewer is a full-screen pager.

## Reading order
1. `01-identity.md` 2. `02-shell-engine.md` 3. `03-filesystem.md` 4. `04-commands.md`
5. `05-hints.md` 6. `06-rich-views.md` 7. `07-output-animation.md` 8. `08-boot-and-motd.md`
9. `09-cross-os-features.md` 10. `10-responsive.md` 11. `11-accessibility.md` 12. `12-edge-cases.md`
13. `13-acceptance.md`

## Feature-ID namespaces
`LNX-ID` · `LNX-SH` (engine) · `LNX-FS` (filesystem) · `LNX-CMD-{name}` (one per command) · `LNX-HINT` · `LNX-VIEW` ·
`LNX-OUT` · `LNX-BOOT` · `LNX-X` · `LNX-RESP` · `LNX-A11Y` · `LNX-CASE`.

## Phase split (important)
The **engine core is pure TypeScript** (`lib/terminal`) and is first needed by the macOS Terminal app, so:
- **P3:** `LNX-SH-*`, `LNX-FS-*` and the core `LNX-CMD-*` (marked P3) — built and unit-tested as a library.
- **P7:** everything that makes Linux an *operating system*: identity, boot/MOTD, hints, rich views, output animation,
  URL-encoded cwd, status bar/tiling, mobile, eggs, tour — then the definition-of-done audit.

## Not like the others (folder-level)
No icons, no launcher, no windows to drag, almost no animation. Navigation is **typing**. Help is **offered, never
imposed**, and a hinted command is **inserted, never executed** — the visitor presses Enter. The terminal apps inside
macOS and Windows reuse this engine but are *apps in a window*; here the terminal **is** the OS (cwd in the URL, MOTD,
hints, viewer tile, status bar).
