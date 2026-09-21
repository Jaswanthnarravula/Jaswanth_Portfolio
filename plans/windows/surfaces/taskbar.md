# Windows 11 / surfaces — Taskbar

## Role + requirement refs
The anchor of the whole OS: centered Start/Search/Task View, pinned and running apps with pill indicators, and the
system tray. R18, R19, R25.

## Portfolio mapping
Pinned apps from the registry in `README.md` order; the **pinned `Résumé.pdf`** item is the résumé fast path
(`RES-IDIOM-01`).

## Anatomy (48 px tall; full width; Acrylic; 1 px top stroke)
`[ centred group:  ⊞ Start · 🔍 Search · ⧉ Task View ‖ pinned + running apps ]            [ ⌃ · 🌐🔊 · 9:41 AM 9/21/2026 ]`
- App button: 40 × 40 px, 4 px radius, 24 px icon, hover fill `rgb(255 255 255 / .06)`.
- **Indicator pill** under the icon: none (not running) · 6 × 3 px grey (running, not active) · **16 × 3 px accent**
  (active) · pulsing accent (needs attention — used when a download/toast originates from that app).
- Tray: overflow chevron (hidden icons: none → shows "No hidden icons"), network+volume combined button → **Quick
  Settings**, clock+date → **Notification Center** + calendar.
- Far-right 12 px sliver: **Show desktop** (minimizes all; click again restores).

## Behaviour & states
| Interaction | Behaviour |
|---|---|
| Click app button | `WIN-WM-08` table (open / restore / focus / **minimize if active**) |
| Hover app button (fine pointer, 400 ms) | **Thumbnail preview flyout**: a titled card per window (live DOM is not cloned — shows app icon, title and the content heading) with a ✕ to close; hover the card → window peeks (others dim to 30 %) |
| Launch while loading | Button shows a subtle left-to-right shimmer under the icon until the first frame (no bounce — that is macOS) |
| Right-click / long-press | Jump list: app-specific tasks (e.g. GitHub → each featured project; Explorer → Experience, Education) · Pin/Unpin (decorative, disabled) · Close window |
| Start / Search / Task View | Toggle their surfaces; button shows pressed state while open |
| Overflow (too many buttons) | Group scrolls horizontally inside the centred area; never wraps |
| Show desktop | Minimize-all with a 30 ms stagger; second click restores the previous set |

## Navigation & routes
Buttons are links (`/windows/{slug}`) intercepted by `KernelLink`.

## Motion
Pill width changes 167 ms point-to-point `cubic-bezier(0.55, 0.55, 0, 1)` via `scaleX`; button press: icon scales
0.85 → 1 (83 ms down / 167 ms up); flyouts 167 ms in / 83 ms out.

## Responsive
`medium`/touch: 44 px spacing, no hover previews (long-press opens the jump list). `compact` portrait: Start · Search
· Task View · scrolling running apps; tray collapses into one button (opens a combined Quick Settings + notifications
sheet). `compact` landscape: 40 px tall.

## Accessibility
`nav[aria-label="Taskbar"] > ul`; names with ", running" / ", active, press to minimize" suffixes; active app
`aria-current="true"`; roving Left/Right; Alt+Shift+D focuses the taskbar. Tray = `group` "System tray". Clock is
`<time>`, never live. Preview flyout cards are buttons reachable with Down from the app button.

## Edge cases
Pointer leaves during the 400 ms hover intent → no flyout. Peek active when the window closes → peek ends. Show
desktop with nothing open → no-op. Button for an app whose chunk failed → tooltip "Couldn't open — try again".

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `WIN-TASK-01` | Centered taskbar with Start/Search/Task View + pinned apps as links | `e2e: N1 layout; W2 links work without JS` | P4 |
| `WIN-TASK-02` | Pill indicators (none / 6 px / 16 px accent / attention) animated by `scaleX` | `e2e: N2 pill widths per state` | P4 |
| `WIN-TASK-03` | Hover thumbnail flyout + peek | `e2e: N2 hover 400 ms shows card; hovering it dims other windows` | P4 |
| `WIN-TASK-04` | Jump lists (right-click / long-press) | `e2e: GitHub jump list opens a project` | P4 |
| `WIN-TASK-05` | System tray → Quick Settings and Notification Center | `e2e: tray buttons toggle their flyouts` | P4 |
| `WIN-TASK-06` | Show desktop sliver | `e2e: minimize-all then restore` | P4 |
| `WIN-TASK-07` | Pinned Résumé.pdf item | `e2e: Q1 from the taskbar` | P4 |
| `WIN-TASK-08` | Roving keyboard model + state suffixes | `cmp: roving + names` | P4 |
| `WIN-TASK-09` | Compact + landscape variants | `e2e: N3` | P4 |

## Not like the others
Full-width bar with **centred** icons, **pill** indicators, hover **thumbnail previews** and jump lists; clicking the
active app minimizes it (macOS Dock: floating magnifying pill, dots, bounce, no previews, active click is a no-op).
