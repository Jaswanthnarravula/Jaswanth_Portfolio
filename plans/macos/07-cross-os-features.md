# macOS / 07 — Cross-OS features (macOS presentation)

## Role + requirement refs
How macOS presents the features every OS shares: résumé fast path, continuity offer, guided tour, easter eggs,
Switch OS. Contracts: `shared/14`, `shared/16`, `shared/20`, `shared/21`, `04-os-chooser.md`. N5, N9, N10, N14.

## Résumé fast path (`shared/14`)
| Where | Element |
|---|---|
| Dock | **Résumé stack** right of the separator → popover: Open in Preview · Download PDF |
| Menu bar | Status item (document glyph) → Open · Download |
| Desktop | `Résumé.pdf` item |
| Lock screen | First notification |
| Spotlight zero state | First row |
| Compact mode | Menu-bar item stays; Dock stack stays (scrolls into view first) |
Opens `/macos/preview`.

## Continuity offer (`shared/16`)
**Handoff slot at the left end of the Dock**: the owning app's icon with a small badge; label "Continue: {title} —
from {OS}". Click → opens the app at that content. Disappears on accept, after 10 min, or via its context menu
"Dismiss". Mirrored once in the status region. If the lock screen is showing, it appears as a lock notification instead.

## Guided tour (`shared/20`)
- **Offer:** a banner (`MAC-NOTIF-02`) with Start · Not now.
- **Script:** ① "Everything here is an app — this is the Dock." → point at Dock → open **Safari** · ② "Projects
  live in GitHub." → open **GitHub** (window cascades) · ③ "Windows move, minimize and zoom." → point at the traffic
  lights (no action) · ④ "The résumé is always one click away." → point at the Dock stack · ⑤ "Spotlight finds
  anything — Ctrl/Cmd+K." → point at the magnifier. Done → focus the desktop.
- Coach-mark card uses `--material-thick`, 12 px radius, anchored with an arrow; highlight ring = accent 2 px.
- Restart from: Apple menu → Take the Tour · Settings → General → Tour · Spotlight "Start tour" · `?` dialog.

## Easter eggs (`shared/21`)
`EGG-ABOUT-01` About This Mac (Apple menu) · `EGG-KONAMI-01` (desktop focused) → wallpaper shimmer (a single
`opacity` pulse on a gradient overlay, 600 ms) + banner · Terminal eggs (`sudo hire-me`, `neofetch`, `vim`,
`rm -rf /`, `cowsay`) via the shared engine. Settings → General → About shows "Easter eggs found: n / N".

## Switch OS
Apple menu → Switch Operating System… · Control Center → Switch OS · Settings → General · Spotlight action ·
Alt+Shift+S. Opens a small sheet listing released OSes + "Back to chooser". Exit beat: windows fade 120 ms, Dock
drops, menu bar fades (≤ 300 ms total) → `CHOOSE-EXIT-01`.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `MAC-X-01` | Résumé fast path in all six places | `e2e: Q1 on macOS (each entry point opens Preview or downloads)` | P3 |
| `MAC-X-02` | Dock Handoff slot for continuity | `e2e: C1 with macOS as target` | P4 |
| `MAC-X-03` | Tour offer + macOS script + restart entry points | `e2e: T1 on macOS` | P3 |
| `MAC-X-04` | Eggs wired (About This Mac, Konami, terminal eggs) + found counter | `e2e: eggs increment the counter once each` | P3 |
| `MAC-X-05` | Switch OS entry points + exit beat | `e2e: each entry point switches; session parked` | P3 |

## Not like the others
Résumé lives in a **Dock stack**; continuity is a **Dock Handoff icon**; the tour is offered by a **top-right
banner**; OS switching lives under the ** menu** (Windows: pinned taskbar item, toast, Start power menu; iOS: Dock
app + widget, top banner, Control Center; Android: favorites + At-a-glance chip, shade; Linux: commands + MOTD).
