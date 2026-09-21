# macOS — folder index

## Identity statement
A calm, spatial **desktop**: a wallpaper, a global menu bar that changes with the focused app, a Dock that
magnifies under the pointer, and free-floating layered windows with traffic lights on the left. Many things are
open at once; the visitor arranges them. Nothing snaps, nothing is tiled, menus appear instantly.

It is the first OS built (P2 vertical slice, then P3) because it exercises the hardest part of the kernel — the
window manager — which Windows then reuses.

## App map (role → app → content)

| Role | App | Slug | Shows | Route example |
|---|---|---|---|---|
| `files` | Finder | `finder` | `experience`, `education` as folders/files; shortcuts to Résumé | `/macos/finder/experience/acme` |
| `browser` | Safari | `safari` | `about` — the long-form Overview page (the only place Lenis/ScrollTrigger run) | `/macos/safari` |
| `github` | GitHub | `github` | `projects` + GitHub enrichment | `/macos/github/portfolio-os` |
| `viewer` | Preview | `preview` | `resume` PDF | `/macos/preview` |
| `mail` | Mail | `mail` | `contact` — compose → `mailto:` | `/macos/mail` |
| `editor` | VS Code | `vscode` | `skills` as a workspace of files | `/macos/vscode` |
| `terminal` | Terminal | `terminal` | the shared terminal engine in a window | `/macos/terminal` |
| `settings` | System Settings | `settings` | preferences, accessibility, legal, privacy, Switch OS; **About This Mac** | `/macos/settings` |

Dock order (left → right): Finder · Safari · GitHub · Mail · VS Code · Terminal · System Settings ‖ Résumé stack ·
Handoff slot (left end, only when offered) · minimized windows · Trash (decorative, non-functional, labelled).

## Reading order
1. `01-identity.md` — what makes it macOS
2. `02-window-manager.md` — the core
3. `surfaces/` — `boot` · `lock-screen` · `menu-bar` · `desktop` · `dock` · `spotlight` · `notifications` ·
   `context-menus` · `mission-control`
4. `apps/` — `finder` · `safari` · `github` · `preview` · `mail` · `vscode` · `terminal` · `system-settings`
5. `03-motion.md` · `04-responsive.md` · `05-accessibility.md` · `06-edge-cases.md`
6. `07-cross-os-features.md` — résumé fast path, continuity, tour script, easter eggs
7. `08-acceptance.md` — ledger, definition of done, deviations

Shared contracts these files link to (never restate): `shared/04` kernel · `shared/05` routing · `shared/06`
tokens · `shared/07` motion primitives · `shared/08` responsive · `shared/09` accessibility · `shared/15` search.

## Feature-ID namespaces
`MAC-ID` identity · `MAC-WM` window manager · `MAC-BOOT` · `MAC-LOCK` · `MAC-MENU` · `MAC-DESK` · `MAC-DOCK` ·
`MAC-SPOT` · `MAC-NOTIF` · `MAC-CTX` · `MAC-MC` · `MAC-FIND` · `MAC-SAF` · `MAC-GH` · `MAC-PREV` · `MAC-MAIL` ·
`MAC-CODE` · `MAC-TERM` · `MAC-SET` · `MAC-MOTION` · `MAC-RESP` · `MAC-A11Y` · `MAC-EDGE` · `MAC-X`.

## Phase split
- **P2 (vertical slice):** desktop wallpaper, menu bar (static), Dock (no magnification yet), one Finder window
  end-to-end — open, drag, focus, minimize, zoom, close, deep link, Back/Forward, persistence, compact mode,
  keyboard. IDs marked P2 in the ledger.
- **P3 (complete):** everything else, then the definition-of-done audit.

## Not like the others (folder-level)
Unlike Windows: no taskbar, no Start, no Snap, controls on the **left**, a **global** menu bar instead of per-window
menus, closing a window does not quit the app (Dock dot stays). Unlike iOS/Android: many windows at once, pointer
first. Unlike Linux: everything is direct manipulation.
