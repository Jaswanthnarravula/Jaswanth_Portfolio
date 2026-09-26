# Windows 11 / surfaces — Start menu

## Role + requirement refs
The hub: pinned apps, recommended items (real portfolio shortcuts), the user tile and power options. R18, R25.

## Portfolio mapping
- **Pinned** (grid 6 × 3): every Windows app + shortcuts *Résumé*, *Projects*, *Experience*, *Contact* (open the
  owning app at that section).
- **Recommended** (2 columns × 3): generated from data — "Résumé.pdf · Updated {date}", the three featured projects
  ("Recently added"), the current role ("Most used"), "Say hello". The first Recommended slot is **"Now"**
  (`WIN-START-09`, `shared/23`): Edge icon (it opens in Edge), title "Now — {first sentence of person.now.text}", caption "Updated
  {now.updated}"; it opens Edge at About. The grid stays 2 × 3, so the last generated item drops off.
- **User tile:** initials avatar + "Jaswanth" → flyout: About me (Edge) · Settings · **Switch operating system** · Lock.

## Anatomy
Acrylic panel 640 × 720 px (max 92 vw / workspace height − 24 px), 8 px radius, centred above the taskbar with a
12 px gap. Top: search box (clicking/typing hands off to `search.md`). "Pinned" header + "All apps ›" button. Grid
tiles 96 × 84 px: 32 px icon + 12 px label (2 lines). "Recommended" header + "More ›". Footer bar (darker): user tile
left, power button right (Sleep = lock · **Shut down = back to chooser** · Restart = replay boot).

**All apps** view: slides in from the right — alphabetical list with letter headers (A–Z jump grid on letter click).

## Behaviour & states
| Interaction | Behaviour |
|---|---|
| Open | Start button, the Windows-key equivalent **Alt+Shift+H is not used here** — use Ctrl/Cmd+K for search or click Start; Esc closes |
| Type while open | Focus is in the search box by default on fine pointers → typing immediately searches (`search.md`) |
| Click tile / recommended | Opens the app (window animates from the tile rect) and closes Start |
| Right-click tile | Context menu: Open · Pin to taskbar (decorative) · App settings |
| All apps | In-panel navigation (no history write); Back arrow returns |
| Click outside / Esc / Start again | Closes; focus returns to the Start button |

## Navigation & routes
Start writes no history. Opening an item = one kernel action + one `go()`.

## Motion
Open: `translateY(56px)` → 0 + fade, 250 ms entrance `cubic-bezier(0, 0, 0, 1)`. Close: 167 ms exit
`cubic-bezier(1, 0, 1, 1)`. Tiles press-scale 0.97. All-apps slide 250 ms. Reduced motion: fades only.

## Responsive
`medium`: panel 560 px wide, grid 5 columns. `compact`: **full-height sheet** above the taskbar (Start as a page):
search on top, pinned grid 4 columns, recommended as a single column; modal with the rest `inert`; system/browser
Back closes it (it is pushed as a transient state handled by Esc/Back arbitration, not as a URL).

## Accessibility
Non-modal `dialog` "Start" (modal in compact). Regions: search combobox · "Pinned" `ul` of links with a roving 2-D
grid · "Recommended" `ul` · footer buttons. Tab cycles regions; arrows within; Esc closes → Start button. Focus on
open: search field on fine pointers, the "Pinned" heading on coarse (avoids popping the keyboard).

## Edge cases
Open during a window drag → ignored until commit. Start open when OS switch begins → closed by the epoch bump.
Recommended item whose content was removed → omitted. Very short viewport → panel scrolls internally.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `WIN-START-01` | Panel layout: search, pinned grid, recommended, footer | `e2e: N1 opens above the centred taskbar` | P4 |
| `WIN-START-02` | Pinned + Recommended generated from registry and data | `unit: recommended list derives from fixture` | P4 |
| `WIN-START-03` | Type-to-search hand-off | `e2e: N1 typing in Start shows search results` | P4 |
| `WIN-START-04` | All apps view with letter jump | `e2e: navigate to All apps and open an app` | P4 |
| `WIN-START-05` | User tile + power menu (Lock, Switch OS / Shut down → chooser, Restart) | `e2e: Shut down returns to the chooser; session parked` | P4 |
| `WIN-START-06` | Open/close motion (250 / 167 ms), window opens from the tile rect | `e2e: R1 variant fades only` | P4 |
| `WIN-START-07` | Compact full-height sheet, modal, Back closes | `e2e: N3 Start sheet + Back` | P4 |
| `WIN-START-08` | Dialog semantics, 2-D roving grid, focus rules | `cmp: grid roving; e2e: X1 with Start open` | P4 |
| `WIN-START-09` | "Now" as the first Recommended item, opens Edge About | `unit: recommended list starts with Now when person.now exists; cmp: item opens Edge` | P8 |

## Not like the others
A **centred Acrylic panel that rises from the taskbar** with Pinned/Recommended and a power footer (macOS has no
Start — Launchpad is not built; iOS/Android have the home grid and app drawer as the launcher itself).
