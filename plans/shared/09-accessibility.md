# shared/09 — Accessibility

## Purpose
A real, semantic document lives beneath the OS metaphor. Everything is operable by keyboard, understandable by
screen readers, legible at high contrast and calm under reduced motion. Target: Lighthouse Accessibility ≥ 95,
axe 0 violations, WCAG 2.2 AA. Requirements: R43.

## Decisions

| Decision | Rationale | Rejected |
|---|---|---|
| **Never `role="application"`** | It disables browse mode (headings, landmarks, links, virtual cursor); our content is documents | Treating the OS as an app widget |
| Windows are **labelled `<section>` regions with an `h2` title**, not `role="dialog"` | Dialogs imply transient + get auto-read; windows are persistent documents | `role=dialog` on every window |
| **Launchers are real `<a href>` links** intercepted by `KernelLink` | Works without JS, crawlable, middle-click; opening an app *is* navigation | `<button>` launchers |
| `<button>` only for state changes (folders, Start toggle, window controls) | Correct semantics | — |
| Icon grids are `ul > li > a` with **roving tabindex**, not `role="grid"` | Grid role is brittle when the layout reflows | ARIA grid |
| Five **hand-built headless primitives** to WAI-ARIA APG, wired to the kernel FocusManager | `react-aria` brings its own focus/press system that fights the single focus owner, plus bundle weight | `react-aria`, Radix |
| Windows keep **DOM order = open order**; stacking is `z-index` only | Reordering DOM on focus disorients screen readers | Re-parenting on focus |
| Text alternatives are static; **animated text is `aria-hidden`** | Morphing/typewriter text inside live regions is noise | Live-region animation |

## Specification

### Primitives (`components/primitives`, test-first — suites written before the code)
`RovingGroup` (1-D/2-D arrows, Home/End, type-ahead, measures visual columns at keypress) · `Menu` / `Menubar`
(full APG: Left/Right between menus, Down opens, Esc closes to invoker, type-ahead) · `Combobox` + `Listbox`
(`aria-activedescendant`, list autocomplete only, debounced result-count status) · `FocusScope` / inert manager
(modal only for true modals) · `Press` / `LongPress` (500 ms, cancels on move > 10 px).

### Semantics map (shared surfaces — OS files add their own rows)

| Surface | Element / role | Name | Keyboard | Focus in → out |
|---|---|---|---|---|
| Icon grid | `ul > li > a` | visible label; icon `alt=""` | one tab stop, 2-D arrows, Home/End, type-ahead, Enter | last roving item → opened window |
| Dock / taskbar | `nav[aria-label]` > `ul` | app name + hidden ", open" / ", minimized"; active `aria-current="true"` | roving Left/Right (Up/Down as a rail) | Tab → window |
| Menu bar | `role="menubar"` (single menu button in compact) | item text | APG | one tab stop → Esc returns to invoker |
| Window | `<section aria-labelledby tabindex="-1">` + `h2`; content from `h3` | title | not trapped | the section → per focus rules |
| Window controls | `group` "Window controls" + buttons | "Close Projects"; Maximize/Restore name swaps (no `aria-pressed`) | Tab; glyphs on focus-visible, always on in high contrast | — |
| Context menu | `role="menu"` on surfaces that own one; text/inputs/terminal keep the native menu | `aria-label` | APG; Esc/Tab closes | first item → invoker |
| Search (Spotlight/Start/etc.) | modal `dialog` + `input[role=combobox]` + `listbox` of grouped options | "Search" | arrows, Enter, Esc (clear, then close) | input → invoker |
| Notification | `role="status"` container present in DOM **before** the first notification | text | ≥ 6 s, pause on hover/focus, close button, **never steals focus**; all land in a notification centre | — |
| OS chooser cards | `nav > ul > li > a` | heading + description | Tab, Enter | — |
| Profile picker | `group[aria-labelledby]` + five `<button>`s | text; remembered one `aria-pressed` | Tab/arrows, Enter — no auto-advancing radios (WCAG 3.2.2) | → chooser heading |
| Clock | `<time>` — **never** live | — | — | — |

### Focus rules (FocusManager applies the kernel's `focusTarget`, `preventScroll`, at animation **start**)
- **Open:** the window section (apps whose main control is an input focus it on fine pointers). Already open → raise + restore.
- **Close:** next topmost window → else recorded invoker → else the app's Dock/taskbar button → else grid's roving item.
- **Minimize:** the app's Dock/taskbar button. **Restore:** the window. **Maximize:** stays on the button.
- **OS switch:** the shell's visually hidden `h1`; unique `<title>` per route; boot animation is `aria-hidden` and skippable.
- **Back/Forward:** reconcile, then apply the rule for the resulting action; never write history while reconciling.
- **iOS/Android open:** focus heading → set home `inert` → animate. **Close:** jump pager to the icon's page →
  remove `inert` → focus icon → animate.
- Focus moves **before** `inert`/`hidden` is set. Focus never rests on `<body>` (asserted after every e2e step).

### Keyboard shortcuts (one registry: `lib/kernel/keymap.ts`)
Accelerators are **Alt+Shift+letter** (avoiding T, A, B, I). Never Ctrl+Alt (AltGr / VoiceOver), Alt+Space, F6,
F10, Ctrl+L/R/W/U. Ignored while focus is in a text field on macOS.

| Action | Keys |
|---|---|
| Search / command palette | Ctrl/Cmd+K; `/` outside text fields |
| Shortcut help | `?` (single-key shortcuts can be disabled — WCAG 2.1.4) |
| Context menu | the `contextmenu` event (Shift+F10, Menu key, VO Ctrl+Opt+Shift+M) |
| Close / Minimize / Maximize window | Alt+Shift+W / M / F |
| Next / previous window · Overview | Alt+Shift+N / P · Alt+Shift+O |
| Focus Dock/taskbar · Home (mobile OSes) · Switch OS | Alt+Shift+D · Alt+Shift+H · Alt+Shift+S |
| Dismiss topmost transient surface | Esc (also "back one level" on iOS/Android; never closes a desktop window) |
| Move / Size mode | arrows 10 px, Shift+arrows 50 px, Enter commits, Esc reverts |

A unit test checks the registry against a deny-list of reserved chords; the registry renders the help dialog.

### Global affordances
- **"Skip the OS: plain portfolio"** is the first focusable element everywhere → `/plain`.
- **Accessibility & motion settings** in every OS's Settings (and `settings` in Linux): reduce motion, reduce
  transparency, sound, larger text, single-key shortcuts.
- Respect `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-contrast`, `forced-colors`.
- Zoom is never disabled; inputs ≥ 16 px on coarse pointers.

### Terminal (details in `linux/11-accessibility.md`)
Labelled native `<input>` in a `<form>`; scrollback is a labelled focusable region; a separate visually hidden
`role="log"` announcer receives **final text synchronously** regardless of animation and summarizes outputs
> 10 lines. Tab completes only with a non-empty token and candidates; empty input lets Tab pass; Esc then Tab
always exits. Ctrl+C only acts when there is no text selection.

### Per-release manual script
10-minute journey in NVDA + Firefox/Chrome and VoiceOver + Safari (macOS and iOS), TalkBack smoke on Android:
welcome → profile → chooser → one OS → open Projects → open a project → résumé → contact → switch OS.

## Edge cases
`aria-hidden` on a subtree holding focus → forbidden (move focus first). Contrast over wallpaper: axe reports
"incomplete" → guaranteed by scrim tokens (`shared/06`). Global `contextmenu` override → forbidden.

## Feature IDs + acceptance tests

| ID | Feature | Acceptance test |
|---|---|---|
| `A11Y-PRIM-01` | RovingGroup | `cmp: IconGrid single tab stop, 2D arrows, keyboard click opens` |
| `A11Y-PRIM-02` | Menu / Menubar | `cmp: MenuBar APG keys, Esc restores focus` |
| `A11Y-PRIM-03` | Combobox / Listbox | `cmp: Spotlight activedescendant + debounced count` |
| `A11Y-PRIM-04` | FocusScope / inert manager | `cmp: focus moved before inert; no focus loss` |
| `A11Y-PRIM-05` | Press / LongPress | `cmp: long-press opens menu; move cancels; keyboard equivalent exists` |
| `A11Y-SEM-01` | Semantics map honoured | `e2e: X2 toMatchAriaSnapshot per shell` |
| `A11Y-FOCUS-01` | Focus rules | `e2e: H1 + M1 focus target correct after every action; never body` |
| `A11Y-KEY-01` | Keymap registry + deny-list | `unit: keymap has no reserved chord` |
| `A11Y-SKIP-01` | Skip-the-OS link first in tab order | `e2e: first Tab on every route focuses the skip link` |
| `A11Y-PREF-01` | A11y & motion settings surface | `e2e: toggles persist and apply before paint on reload` |
| `A11Y-AXE-01` | axe WCAG 2.2 AA, 0 violations | `e2e: X1 every OS home + one app per OS + open overlays` |
| `A11Y-LIVE-01` | Live-region policy | `cmp: notification region pre-exists; clock not live; hello morph aria-hidden` |
| `A11Y-LH-01` | Lighthouse Accessibility ≥ 95 | `lhci: categories:accessibility ≥ 0.95 on all audited routes` |

## Open questions
None.
