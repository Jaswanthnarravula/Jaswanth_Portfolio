# Windows 11 — folder index

## Identity statement
A **taskbar-anchored** desktop. Everything begins at the centered taskbar: Start is the hub, Search shares its
flyout, pinned apps show pill indicators, windows have caption buttons on the **right**, maximize fills the screen,
and windows **Snap** to halves and quarters. Depth is restrained: Mica in title bars, Acrylic in flyouts, 8 px
corners, 1 px strokes, Segoe UI Variable.

Built in **P4**, reusing the kernel window manager proven by macOS — but with its own skin, behaviours and motion.

## App map (role → app → content)

| Role | App | Slug | Shows | Route example |
|---|---|---|---|---|
| `files` | File Explorer | `explorer` | `experience`, `education` as folders/files | `/windows/explorer/experience/acme` |
| `browser` | Microsoft Edge | `edge` | `about` Overview page · **`resume` as a PDF tab** | `/windows/edge` · `/windows/edge/resume` |
| `github` | GitHub | `github` | `projects` + enrichment | `/windows/github/portfolio-os` |
| `mail` | Outlook | `outlook` | `contact` → `mailto:` | `/windows/outlook` |
| `editor` | VS Code | `vscode` | `skills` workspace | `/windows/vscode` |
| `terminal` | Windows Terminal | `terminal` | shared terminal engine, PowerShell-style prompt | `/windows/terminal` |
| `settings` | Settings | `settings` | preferences, accessibility, legal, privacy, Switch OS; `winver` | `/windows/settings` |

Taskbar order (centered): Start · Search · Task View ‖ File Explorer · Edge · GitHub · Outlook · VS Code ·
Terminal · **Résumé.pdf (pinned)** ‖ running-but-unpinned apps. Right: system tray (chevron, network/volume =
Quick Settings, clock = Notification Center).

## Reading order
1. `01-identity.md` 2. `02-window-manager.md`
3. `surfaces/` — `boot` · `lock-screen` · `taskbar` · `start-menu` · `search` · `desktop` · `notification-center` ·
   `context-menus` · `task-view`
4. `apps/` — `file-explorer` · `edge` · `github` · `outlook` · `vscode` · `windows-terminal` · `settings`
5. `03-motion.md` · `04-responsive.md` · `05-accessibility.md` · `06-edge-cases.md`
6. `07-cross-os-features.md` 7. `08-acceptance.md`

## Feature-ID namespaces
`WIN-ID` · `WIN-WM` · `WIN-BOOT` · `WIN-LOCK` · `WIN-TASK` · `WIN-START` · `WIN-SEARCH` · `WIN-DESK` · `WIN-NOTIF` ·
`WIN-CTX` · `WIN-TV` · `WIN-EXP` · `WIN-EDGE` · `WIN-GH` · `WIN-OUT` · `WIN-CODE` · `WIN-TERM` · `WIN-SET` ·
`WIN-MOTION` · `WIN-RESP` · `WIN-A11Y` · `WIN-CASE` (edge cases) · `WIN-X`.

## Phase
All `WIN-*` IDs are delivered in **P4**, followed by the definition-of-done audit in `08-acceptance.md`.

## Not like the others (folder-level)
Unlike macOS: no global menu bar, no Dock, controls on the **right**, closing the last window **ends** the app (no
"still running" dot), clicking the active app's taskbar button **minimizes** it, windows Snap, maximize covers
everything except the taskbar. Unlike mobile OSes: many windows, pointer first. Unlike Linux: graphical throughout.
