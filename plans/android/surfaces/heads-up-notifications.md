# Android / surfaces — Heads-up notifications

## Role + requirement refs
Brief floating cards at the top for things worth noticing now; each one is also stored in the shade. R20, R25.

## Portfolio mapping
Deterministic, identical for every visitor:

| Trigger | Heads-up | Actions |
|---|---|---|
| First launcher after unlock (once per session) | "Welcome — swipe up for all apps. Back always takes you back." | All apps |
| Tour offer (`shared/20`) | "New here? Take a 20-second tour." | Start · Not now |
| Résumé downloaded | "Résumé.pdf · Download complete" | Open · Show in Files |
| Address copied (Gmail) | — uses a **snackbar** instead (M3: transient confirmation at the bottom): "Copied to clipboard" | — |
| Offline / online | snackbar: "You're offline — content still works" | — |
| **Continuity offer** (`shared/16`) | **silent** (no heads-up): appears as the At-a-glance line + a shade card | Open |

## Anatomy
**Heads-up card:** `surface-container-high`, 28 dp radius, level-3 shadow, 8 dp from the top inset and sides (max
width 420 dp); small app icon in a tonal circle + app name · time; Title-M; Body-M (2 lines); **text buttons** row
(Label-L in `primary`). One at a time; queue ≤ 3.
**Snackbar:** bottom, above the navigation bar, `inverse-surface`, 4 dp radius, single line + optional action; 4 s
(≥ 6 s if it has an action), one at a time.

## Behaviour & states
- Dwell ≥ 6 s; pauses on hover/focus/press. Swipe sideways or up dismisses; tap opens (container transform from the
  card). Always recorded in the shade.
- Never steals focus. Over apps as well as the launcher.
- Snackbars never contain essential-only information (they mirror a state already visible).

## Navigation & routes
None.

## Motion
In: translateY −100 % → 0 + fade, 400 ms emphasized-decelerate. Out: 200 ms emphasized-accelerate (or swipe velocity →
distance-scaled duration). Snackbar: fade + 8 dp rise 150 ms in / 75 ms out. Reduced motion: fades.

## Responsive
Phone landscape/pad: card max 420 dp, top-centre; snackbar max 600 dp, bottom-left on pad. Laptops/desktops: same as pad,
on the full page (snackbar sits above the taskbar).

## Accessibility
`role="status"` region present from mount; heads-up actions are buttons; a close button appears on focus/hover;
snackbar text is announced politely once; snackbar actions reachable by Tab while visible and duplicated elsewhere.

## Edge cases
Heads-up during a transform → queued to rest. Shade open → new items appear directly in the shade (no heads-up).
Two snackbars → queued, never stacked.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `AND-HUN-01` | Heads-up card: queue, dwell ≥ 6 s, pause, swipe dismiss, text-button actions | `cmp: region pre-exists; pause on hover/focus` | P6 |
| `AND-HUN-02` | Trigger table incl. snackbars and silent continuity | `unit: trigger → surface mapping` | P6 |
| `AND-HUN-03` | Everything recorded in the shade | `e2e: A2 dismissed heads-up present in the shade` | P6 |
| `AND-HUN-04` | M3 snackbar behaviour (single, timed, non-essential) | `cmp: queueing + durations` | P6 |
| `AND-HUN-05` | Motion + reduced-motion variants; never steals focus | `e2e: R1; focus unchanged` | P6 |

## Not like the others
**Tonal floating card with text buttons, plus bottom snackbars for confirmations**; continuity is **silent**
(iOS: blurred expanding banners; Windows: corner toasts with full-width buttons; macOS: top-right banners).
