# Android / surfaces — Recents (overview)

## Role + requirement refs
The overview of recently used apps: switch, dismiss, or clear all. R20, R25.

## Portfolio mapping
None; each card is titled with the app (icon chip above the card).

## Anatomy
Launcher wallpaper with a 32 % scrim (no blur) · a **horizontal carousel** of large app cards (live surfaces scaled to
≈ 70 % height, 28 dp radius), the **most recent in the centre**, older to the left; each has its app-icon chip above
(tap the chip → menu: App info · Close) · at the far left: **Clear all** button · bottom: the favorites row stays
visible with a suggested-apps feel (4 favorites) and the search bar.

## Behaviour & states
- **Invoke:** Recents button (3-button) · swipe-up-and-hold on the pill (gesture) · Alt+Shift+O.
- Carousel: CSS scroll-snap; arrow keys move; the focused card enlarges slightly (scale 1.03).
- Tap a card → the app returns to the foreground (container transform from the card rect).
- **Swipe a card up** → the app instance is removed (card flies up, others close the gap); alternative: chip menu →
  Close, or Delete key.
- **Clear all** → cards sweep away with a 40 ms stagger → returns to the launcher.
- **Back** / Esc / tapping the scrim → returns to where the visitor came from (app or launcher).
- Empty: "No recent items" centred, with the favorites still available.

## Navigation & routes
Selecting another app → focus change → `go()` (push on mobile). Opening/closing Recents writes nothing.

## Motion
Enter: the current app scales down into its card, 300 ms emphasized; neighbours slide in. Exit reverses. Dismiss:
translateY −100 % + fade 200 ms (velocity-aware). Reduced motion: instant layout + 150 ms fade.

## Responsive
Phone landscape: cards shorter, still horizontal. **Pad:** a **grid** of cards (2 rows) plus the taskbar dock.
Laptops/desktops: same grid across the full page.

## Accessibility
Modal `dialog` "Recent apps" with a `ul` of buttons ("GitHub — portfolio-os"); arrows rove; Enter selects; Delete
closes the focused app (chip menu is the visible alternative); "Clear all" is a button; Back/Esc exits; background `inert`.

## Edge cases
App closed from Recents while it was the foreground → launcher becomes the context. Rotation → carousel re-measures,
keeps the centred card. Clear all with a draft in Gmail → draft is kept in the session (instance state removed, draft
persists via `WindowInstance.draft` archive).

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `AND-RECENTS-01` | Carousel of live cards with icon chips, centred most-recent, scroll-snap | `e2e: cards match instances; arrow navigation` | P6 |
| `AND-RECENTS-02` | Select (transform from card), swipe-up / Delete / chip menu to close, Clear all | `e2e: close one, then Clear all → launcher` | P6 |
| `AND-RECENTS-03` | Three invocations incl. pill hold; Back/Esc exit | `e2e: A1 each invocation` | P6 |
| `AND-RECENTS-04` | Pad grid layout; dialog semantics | `e2e: tablet; X1 with Recents open` | P6 |
| `AND-RECENTS-05` | Draft survives Clear all | `e2e: compose text kept after clearing` | P6 |

## Not like the others
**Centred-most-recent carousel with Clear all and icon chips, no blur** (iOS switcher: overlapping card stack, no
clear-all; macOS Mission Control / Windows Task View: window grids on desktops).
