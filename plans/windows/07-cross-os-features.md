# Windows 11 / 07 — Cross-OS features (Windows presentation)

## Role + requirement refs
How Windows presents the shared features: résumé fast path, continuity, tour, easter eggs, Switch OS. Contracts:
`shared/14`, `shared/16`, `shared/20`, `shared/21`, `04-os-chooser.md`. N5, N9, N10, N14.

## Résumé fast path (`shared/14`)
| Where | Element |
|---|---|
| Taskbar | **Pinned `Résumé.pdf`** (PDF glyph) → opens `/windows/edge/resume`; jump list: Open · Download |
| Start | First "Recommended" row + a pinned "Résumé" tile |
| Desktop | `Résumé.pdf` icon |
| Lock screen | First status card |
| Search zero state | First quick search |
| Compact | Pinned item stays in the scrolling taskbar group (ordered first among apps) |

## Continuity offer (`shared/16`)
A **toast**: header "Continue from {OS}", title = content title, buttons **Open** · **Dismiss**; persists in the
Notification Center until dismissed or 10 min. If the lock screen is showing → third status card instead.

## Guided tour (`shared/20`)
- **Offer:** toast with Start tour · Not now.
- **Script:** ① "Everything starts here." → point at Start → open **Start** briefly (closes on next step) ·
  ② "This is the overview." → open **Edge** · ③ "Projects live in GitHub." → open **GitHub** and **snap the two side
  by side** (shows Snap honestly) · ④ "The résumé is pinned to your taskbar." → point at it · ⑤ "Search finds
  anything." → point at Search. Done → focus the desktop.
- Coach-mark: Acrylic teaching-tip with a tail, 8 px radius, accent ring on the target.
- Restart from: Settings → Tour · Search "Start tour" · `?` dialog · Start → user tile menu.

## Easter eggs (`shared/21`)
`EGG-WINVER-01` (`winver` in Search or Terminal) · `EGG-KONAMI-01` → accent shimmer across the taskbar + toast ·
Terminal eggs through the shared engine with PowerShell-voiced framing. Settings → System → About shows the found counter.

## Switch OS
Start → power → **Shut down** (= back to chooser) · Start → user tile → Switch operating system · Quick Settings tile
· Settings page · Search action · Alt+Shift+S · desktop context menu. Exit beat: windows fade 83 ms, taskbar slides
down 167 ms (≤ 300 ms) → `CHOOSE-EXIT-01`.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `WIN-X-01` | Résumé fast path in all listed places | `e2e: Q1 on Windows` | P4 |
| `WIN-X-02` | Continuity toast (and lock-card variant) | `e2e: C1 with Windows as target` | P4 |
| `WIN-X-03` | Tour offer + Windows script (incl. honest Snap demo) + restart points | `e2e: T1 on Windows` | P4 |
| `WIN-X-04` | Eggs wired + found counter | `e2e: winver + Konami increment once each` | P4 |
| `WIN-X-05` | Switch OS entry points + exit beat | `e2e: each entry point switches; session parked` | P4 |

## Not like the others
Résumé is a **pinned taskbar item**; continuity is a **toast**; the tour teaches **Snap**; leaving is **Shut down**
from Start's power menu (macOS: Dock stack, Dock Handoff icon, banner,  menu).
