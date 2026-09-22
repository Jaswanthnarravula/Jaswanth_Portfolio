# Linux / 01 — Identity

## Role + requirement refs
Restrained, believable terminal aesthetics: prompt, caret, type, colour, spacing, status bar. Requirements: R26, R27.
Tokens: `[data-os="linux"]` in `shared/06-design-system.md`.

## Prompt
`jaswanth@portfolio:~$ ` — exactly this shape (bash style):
- `jaswanth@portfolio` in **green**, `:` default, **path in blue** (`~`, `~/projects`, `/etc`), `$` default, one space.
- Path abbreviates `$HOME` to `~`; paths longer than 32 chars collapse the middle (`~/…/portfolio-os`).
- After a non-zero exit the `$` turns **red** for that one prompt (subtle, authentic).
- The visual prompt string is `aria-hidden`; the input's accessible label carries the cwd (`11-accessibility.md`).

## Typography and metrics
- **JetBrains Mono** (OFL), weights 400/700, loaded only in this chunk (`DS-FONT-01`); fallback
  `ui-monospace, "Cascadia Mono", Menlo, Consolas, monospace`.
- Size 14 px (15 px ≥ `large`; **16 px on coarse pointers** to prevent iOS focus zoom), line-height **1.35**, no
  ligatures, `font-variant-numeric: tabular-nums`, `white-space: pre-wrap`, `tab-size: 8`.
- Columns computed from the measured `ch` width; rows from line height; both exposed to commands (`ls` columns,
  `COLUMNS`, `LINES`).
- Padding 12 px (8 px compact). Text never touches the tile edge.

## Colour (dark by default; light variant follows `prefs.theme`)

| Role | Dark | Light |
|---|---|---|
| Background | `oklch(0.17 0.01 260)` | `oklch(0.985 0.003 90)` |
| Foreground | `oklch(0.90 0.01 260)` | `oklch(0.25 0.01 260)` |
| Dim (comments, hints, meta) | 60 % foreground | 60 % |
| Green (user@host, success) | `oklch(0.80 0.16 150)` | `oklch(0.50 0.13 150)` |
| Blue (paths, directories) | `oklch(0.75 0.12 250)` | `oklch(0.48 0.14 255)` |
| Cyan (links, executables) | `oklch(0.80 0.10 200)` | `oklch(0.50 0.10 210)` |
| Yellow (warnings, headings) | `oklch(0.85 0.13 95)` | `oklch(0.55 0.12 80)` |
| Red (errors) | `oklch(0.70 0.18 25)` | `oklch(0.50 0.19 27)` |
| Magenta (media, pdf) | `oklch(0.75 0.14 330)` | `oklch(0.50 0.15 330)` |
| Selection | foreground 25 % | foreground 18 % |
All text colours ≥ 4.5:1 on their background (unit-tested). Opaque background; optional 6 % translucency on tier ≥ 1
is **off by default** (it buys nothing).

## Caret
Block caret the width of one `ch`, foreground colour at 90 %, character beneath inverted. Blink **1060 ms
`steps(1)`** (CSS), solid while typing (blink resumes 500 ms after the last key), **hollow outline when the terminal
is not focused**, paused under reduced motion (solid).

## Status bar (tiling-WM style, 24 px, mono 12 px)
`[1:term] [2:view]` workspace tags (2 appears only while the viewer exists) ··· **`résumé`** (link →
`/linux/viewer/resume`) · `?` (help/shortcuts) · `HH:MM` (`<time>`, not live) · **`exit`** (Switch OS). Flat, 1 px
bottom border, no icons, no blur. 44 px tall on coarse pointers.

## Tiles
1 px border (`dim`), focused tile border = green. No shadows, no rounded corners beyond 6 px on the outer frame, no
title-bar buttons. A slim title strip per tile: `jaswanth@portfolio: ~/projects` / `viewer — resume.pdf`.

## Sound
Off by default; if enabled: a single soft bell for `\a`/Tab-with-no-completions (the visual bell — a 80 ms border flash
— is the default and is disabled under reduced motion).

## Visual target (owner storyboard — `plans/visual-targets/linux-terminal.png`)
Rules: `shared/06-design-system.md` → Owner visual targets. Where this table and the colour/metric tables above
disagree on a colour, this table wins; metrics stay as above (character cells).

| Element | Exactly as the frame |
|---|---|
| Ground | `#0c1016`, text `#d9dee8`, mono only; no icons at all |
| Status bar | Workspaces `1:term` (active: `#0c1016` on `#7ee6a5`) · `2:view`; right: `résumé` link `#6fb6ff` · `?` · clock `09:41` · `exit`; text `#9aa6b8`, bottom rule `#2a3240` |
| Tiles | Terminal 1.25 fr + viewer 1 fr with equal gutters; 1 px `#2a3240` borders, focused tile `#7ee6a5`; title rows `#8693a6` — `jaswanth@portfolio: {cwd}` and `viewer — {path}   [q] close   [l] copy link` |
| Reference state (chooser snapshot) | MOTD → `cd projects && ls` → `open {featured project}`, viewer showing it, caret at a fresh prompt, hint chip visible |
| Terminal text | MOTD and notices dim `#77849a` ("Welcome. This is Jaswanth's portfolio — as a shell." · "* résumé ready → open resume" · "* {n} projects → cd projects && ls"); prompt user `#7ee6a5`, path `#6fb6ff`; directories/README `#7fdcdc`; block caret blinking 1.06 s |
| Hint chip | Bottom of the terminal tile, 1 px `#2a3240` box: "Lost already? Linux welcomes you." · command chip (`#1a212c`) · underlined "Paste into Terminal" |
| Viewer | `# {name}` bold `#f0d37a` · "{description} · {year}" dim · dashed rules `#2a3240` · summary · `stack` `#f0d37a` + `[tags]` `#e59be0` · `repo ↗` `live ↗` `#7fdcdc` · "n next · p previous" dim |

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `LNX-ID-01` | Prompt shape, colours, `~` abbreviation, middle-collapse, red `$` after failure | `unit: prompt formatter cases; e2e: L1 prompt after error` | P7 |
| `LNX-ID-02` | Mono type metrics: measured cols/rows, 16 px on coarse pointers, pre-wrap | `unit: cols/rows from ch/line height; e2e: no focus zoom on iphone` | P7 |
| `LNX-ID-03` | Colour roles, light/dark, all ≥ 4.5:1 | `unit: contrast matrix for both themes` | P7 |
| `LNX-ID-04` | Caret: block, blink 1060 ms steps(1), solid while typing, hollow when unfocused | `e2e: caret states` | P7 |
| `LNX-ID-05` | Status bar with workspace tags, résumé link, help, clock, exit | `e2e: Q1 résumé link; exit opens Switch OS` | P7 |
| `LNX-ID-06` | Tiled frames with focus border; no chrome buttons | `e2e: visual snapshot; focus border follows the active tile` | P7 |

## Not like the others
Monospace everywhere, character-cell spacing, opaque surfaces, a status bar of **text tags** instead of a Dock/taskbar,
and a caret instead of a pointer target (every other OS is built from icons, materials and motion).
