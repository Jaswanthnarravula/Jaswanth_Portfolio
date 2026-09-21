# Windows 11 / apps — VS Code

## Role + requirement refs
**Skills and engineering depth** as a workspace. R22, R23, R24. `AppRole: editor` · slug `vscode` · owns `skills`.

## Portfolio mapping
**Identical workspace and generated files as macOS** (`macos/apps/vscode.md` — `README.md`, `skills.json`,
`stack.ts`, `experience.log`, `projects/{slug}.md`, `.env.example`), produced by the same formatters. The editor body
is one shared component; this file specifies only the **Windows chrome and behaviours that differ**.

## Anatomy (differences from macOS)
- **Custom title bar (Mica):** app icon (system menu) · **in-window menu bar** `File Edit Selection View Go Run
  Terminal Help` · centred **command centre** pill ("🔍 jaswanth-portfolio") · layout toggles · caption buttons on the
  **right**.
- Menus are per-window (there is no global menu bar on Windows); they use the Windows menu skin (8 px radius,
  glyph column, 167 ms open).
- Command centre click / Ctrl/Cmd+K → opens the **Windows Search flyout** scoped to files (one search system).
- Terminal panel defaults to a **PowerShell-style** prompt (same engine; see `windows-terminal.md`).
- Path separators in breadcrumbs and tab tooltips use backslashes: `C:\Users\Jaswanth\portfolio\skills.json`.
- Default theme "Dark Modern"; light → "Light Modern".

## Behaviour & states
Same as macOS: preview vs pinned tabs (max 6), read-only message (once per session), inlay skill hints, Search view
on the shared index, lightweight tokenizers (no Monaco/Shiki), lazy terminal panel, minimap hidden on T0.
Windows-only: title-bar menu opens with Alt-style access **without** binding Alt (F10 is reserved) — reachable by
Tab and via the system menu.

## Navigation & routes
`/windows/vscode` only; tabs/active file are session state.

## Motion
Windows tokens: side bar 167 ms, panel 167 ms, menu 167/83 ms. No typing animation.

## Responsive
`compact`: same compact layout as macOS (bottom activity bar, drill-down Explorer); the in-window menu bar collapses
into a ☰ button.

## Accessibility
In-window menu = `role="menubar"` (the `Menubar` primitive, Windows skin). Explorer = APG `tree`; tabs = APG tabs;
code in `<pre><code>` with `aria-hidden` line numbers; "View as plain skills list" alternative present.

## Edge cases
Window narrower than the in-window menu bar → menus collapse into ☰ (same rule as compact). Command centre clicked
while the Search flyout is already open → it re-scopes to files without closing. Snapped to a quarter → side bar
auto-collapses; minimap hides below 600 px of editor width. Light theme → the Windows light syntax palette. Terminal
panel opened → lazy-loads the engine chunk with the PowerShell flavor adapter. Mica inactive state applies to the custom
title bar exactly as to system title bars.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `WIN-CODE-01` | Windows chrome: custom Mica title bar, in-window menubar, command centre, right caption buttons | `e2e: N2 menubar inside the window; caption buttons right` | P4 |
| `WIN-CODE-02` | Shared editor body + shared generated files (no fork) | `static: same component + formatters as macOS; unit snapshots reused` | P4 |
| `WIN-CODE-03` | Command centre opens Windows Search scoped to files | `e2e: S1 from VS Code on Windows` | P4 |
| `WIN-CODE-04` | Backslash paths + PowerShell-style terminal panel | `cmp: breadcrumb separators; panel prompt` | P4 |
| `WIN-CODE-05` | Menubar semantics without binding Alt/F10 | `cmp: Menubar APG suite with Windows skin` | P4 |
| `WIN-CODE-06` | Compact layout with ☰ menu | `e2e: N3` | P4 |

## Not like the others
Menus live **inside the window** with a command-centre pill and right-side caption buttons (on macOS the same app's
menus live in the global menu bar and the title bar carries traffic lights). Paths use backslashes.
