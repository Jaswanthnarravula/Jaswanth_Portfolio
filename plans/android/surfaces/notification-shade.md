# Android / surfaces — Notification shade and Quick Settings

## Role + requirement refs
The single pull-down surface that holds **both** Quick Settings and notifications. R20, R25, `A11Y-PREF-01`.
Everything that appears as a heads-up notification also lands here (WCAG 2.2.1).

## Portfolio mapping
Notifications are the deterministic set from `heads-up-notifications.md`. A **silent** section holds the continuity
offer and "Open to work" (`person.openTo` → Gmail).

## Anatomy
Scrim 32 % over the current screen (no blur). Sheet from the top, `surface-container-low`, bottom corners 28 dp.
**State 1 (first pull):** date + status icons header · **a row of 4 large Quick Settings tiles** (2 × 2, pill-shaped
56 dp tall, 28 dp radius; active = `primary` fill with `on-primary` text; inactive = `surface-container-highest`) ·
brightness slider (cosmetic dim 0–30 %) · notification list: "Notifications" header + cards (grouped per app,
28 dp outer / 4 dp inner corners), "Silent" header + cards, footer: **Manage** (→ Settings) · **Clear all**.
**State 2 (second pull / expand chevron):** full Quick Settings grid (2 columns × 4) + user chip + ⚙ Settings + ✎
(decorative hidden) + **power/“Switch OS”** button.

| Tile | Pref |
|---|---|
| **Sound** | `prefs.sound.enabled` (long-press → volume slider dialog) |
| **Reduce motion** | `prefs.motion` |
| **Reduce transparency → "Solid surfaces"** | `prefs.glass` (mostly relevant to other OSes; still stored) |
| **Dark theme** | `prefs.theme` |
| **Themed icons** | Android-only pref |
| **3-button navigation** | Android-only pref (gesture ↔ 3-button, `status-and-navigation-bars.md`) |
| **Résumé** | opens `/android/files/resume` |
| **Switch OS** | OS list dialog (released OSes + Back to chooser) |

## Behaviour & states
- **Open:** swipe down from the status bar or on the home · click the status bar (button) · keyboard via that button.
  Interactive: tracks the finger; a second pull expands to State 2.
- **Close:** swipe up · **Back** (State 2 → State 1 → closed) · Esc · tap the scrim.
- Tiles toggle instantly (`SET_PREF`) with a ripple; labels show state ("On"/"Off") in Label-M under the title.
- Notification: tap → opens the app (container transform from the card) and closes the shade; swipe sideways →
  dismiss; chevron expands long text and actions; long-press → "Turn off notifications" (decorative toast "Noted —
  nothing is ever pushed to you here.").
- **Clear all** sweeps cards right with a 40 ms stagger (instant under reduced motion).

## Navigation & routes
No history writes; Back arbitration closes it.

## Motion
Finger-driven; settle 350 ms emphasized-decelerate / 200 ms accelerate. Tile toggle: fill morph 200 ms standard.
State 1 → 2: tiles reflow with shared-axis Y (no layout animation — FLIP transforms).

## Responsive
Phone landscape: QS left column, notifications right. **Pad: two-pane shade** (QS left, notifications right) as a
centred panel. Laptops/desktops: same two-pane shade, dropping from the top of the full page.

## Accessibility
Modal `dialog` "Notifications and quick settings". Tiles = `button[aria-pressed]` with text names + state text;
brightness = native range; notifications = `ul`; each card has Dismiss and (if expandable) Expand buttons; Clear all
and Manage are buttons. Focus → first tile; close returns to the status-bar button. `role="status"` region for
heads-up lives **outside** this dialog and exists from mount.

## Edge cases
Pull while the drawer is open → the drawer closes first (Back-style arbitration). Tile toggled "Reduce motion" →
the shade's own close uses the reduced variant immediately. Brightness never breaks AA (cap 30 %; off under
`prefers-contrast: more`).

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `AND-SHADE-01` | One shade: QS row + notifications (State 1), full QS grid (State 2) | `cmp: both states; silent section from data` | P6 |
| `AND-SHADE-02` | Tiles wired to prefs incl. Android-only (themed icons, 3-button nav) | `e2e: A11Y-PREF-01 on Android; nav mode switches live` | P6 |
| `AND-SHADE-03` | Interactive pull + button/keyboard open; **Back steps State 2 → 1 → closed** | `e2e: A2 goBack() sequence` | P6 |
| `AND-SHADE-04` | Notification cards: open, expand, dismiss, Clear all; history of heads-up | `e2e: A2 shade → notification → app` | P6 |
| `AND-SHADE-05` | Switch OS + Résumé tiles | `e2e: switch parks the session; Q1 from the shade` | P6 |
| `AND-SHADE-06` | Two-pane pad layout; dialog semantics | `e2e: tablet; X1 with shade open` | P6 |

## Not like the others
**Notifications and Quick Settings share one pull-down with a two-stage expansion, tonal pills, no blur** (iOS:
separate Notification Center and Control Center with blurred modules; Windows: two separate tray flyouts; macOS:
clock-opened Center + menu-bar Control Center).
