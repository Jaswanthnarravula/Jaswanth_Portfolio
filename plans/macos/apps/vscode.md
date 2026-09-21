# macOS / apps — VS Code

## Role + requirement refs
**Skills and engineering depth**, presented as a workspace of files in an editor — the most credible place for a
developer to describe how they work. R22, R23, R24. `AppRole: editor` · slug `vscode` · owns `skills`.

## Portfolio mapping
`SkillsMatrix` + selected project/experience data rendered as read-only "files". Every file's text is generated
from data by `renderText`/formatters — nothing is hand-duplicated.

| File (Explorer) | Generated from | Rendering |
|---|---|---|
| `README.md` | person summary + how-I-work bullets | Markdown preview style |
| `skills.json` | `SkillGroup[]` (name, level, years) | syntax-highlighted JSON |
| `stack.ts` | skills grouped as typed constants | syntax-highlighted TS |
| `experience.log` | roles as dated log lines | log colouring |
| `projects/{slug}.md` | project highlights + stack | Markdown |
| `.env.example` | contact channels as keys (no secrets) | dotenv |

## Anatomy
Window 1100 × 700 (min 640 × 420), dark theme by default (follows `prefs.theme`). **Activity bar** (48 px):
Explorer · Search · Source Control (decorative, shows "main ✓") · Extensions (lists tools from skills as
"installed extensions"). **Side bar** 240 px (Explorer tree). **Editor group** with tabs, breadcrumbs, line numbers,
minimap (decorative canvas-free: a scaled-down clone using `transform`, hidden on T0). **Status bar**: branch ·
errors 0 · language · "Prettier ✓" · line/col. **Panel** (toggle): Terminal tab embedding the shared terminal engine.

## Behaviour & states
| State | Behaviour |
|---|---|
| Open file | Single click = preview tab (italic title), double click = pinned tab; max 6 tabs then oldest preview closes |
| Read-only | Typing shows a status-bar message: "Read-only workspace — but thanks for trying to fix my code." (once per session) |
| Search view | Queries the shared search index restricted to skills/projects; results open files at the matching line |
| Command Palette | Ctrl/Cmd+K inside the window opens **Spotlight** (one search system — no second palette) |
| Syntax highlighting | Tiny tokenizer per file type (JSON, TS subset, Markdown, log, dotenv) — no Monaco, no Shiki (budget) |
| Skill levels | In `skills.json`, hovering/focusing a skill shows an inlay hint ("4/5 · 6 yrs") |

## Navigation & routes
`/macos/vscode` only. Open tabs/active file are session state (restored with the OS session).

## Menu-bar menus
File: Open File… (quick pick of files) · Close Tab. View: Explorer · Search · Extensions · Toggle Panel · Toggle
Minimap. Go: each file. Terminal: New Terminal (opens the panel).

## Motion
Tab switch instant; side-bar toggle 160 ms `transform`; panel slide 180 ms. No typing animation (content is for
reading — requirement 38).

## Responsive
`medium`: side bar overlays. `compact`: activity bar becomes a bottom bar; Explorer is the first screen, files push
in; minimap and panel hidden; code wraps softly with a 13 px mono and horizontal scroll per block as fallback.

## Accessibility
Explorer is an APG `tree` (arrows expand/collapse, type-ahead). Tabs follow APG tabs. Code is rendered as real text
in `<pre><code>` with line numbers as `aria-hidden` gutters; colours meet 4.5:1. A "View as plain skills list"
button at the top of `skills.json` renders `SkillsMatrix` semantically.

## Edge cases
Many skills → files stay readable via folding by group. Light theme → a matching light syntax palette. Terminal
panel opened → lazy-loads the terminal engine chunk.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `MAC-CODE-01` | Editor shell: activity bar, Explorer tree, tabs, status bar | `e2e: M2 files listed; open/pin tab rules` | P3 |
| `MAC-CODE-02` | Files generated from data by formatters | `unit: generated file text snapshots from fixture` | P3 |
| `MAC-CODE-03` | Lightweight syntax tokenizers (no editor library) | `perf: vscode app chunk ≤ 15 KB gz; unit: tokenizer fixtures` | P3 |
| `MAC-CODE-04` | Read-only message, inlay skill hints | `cmp: typing shows message once; hint on focus` | P3 |
| `MAC-CODE-05` | Search view on the shared index; palette = Spotlight | `e2e: S1 from VS Code` | P3 |
| `MAC-CODE-06` | Embedded Terminal panel (lazy engine) | `perf: terminal chunk requested only on panel open` | P3 |
| `MAC-CODE-07` | Tree/tabs semantics + plain skills alternative | `e2e: X1 axe clean; keyboard tree navigation` | P3 |
| `MAC-CODE-08` | Compact layout | `e2e: M3` | P3 |

## Not like the others
On macOS the title bar carries traffic lights and the menus live in the global menu bar (on Windows the same app
has a custom title bar with **in-window** menus and right-side caption buttons). iOS/Android have no editor —
skills live in Notes / Keep as notes.
