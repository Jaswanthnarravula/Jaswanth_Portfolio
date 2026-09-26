# macOS / surfaces — Notifications and Notification Center

## Role + requirement refs
Banner notifications that slide in top-right, and the Notification Center panel where every banner also lands
(so nothing time-limited is ever lost — WCAG 2.2.1). R16, R25.

## Portfolio mapping
Notifications are **useful shortcuts**, never noise. Sources (all deterministic, identical for every visitor):

| Trigger | Banner | Action |
|---|---|---|
| First desktop after unlock (once per session) | "Welcome — everything here is an app. Try Spotlight (Ctrl/Cmd+K)." | Open Spotlight |
| Tour offer (`shared/20`) | "New here? Take a 20-second tour." | Start · Not now |
| Continuity offer when the lock screen wasn't shown | handled by the Dock Handoff slot, mirrored here | Open |
| Résumé downloaded | "Résumé.pdf downloaded" | Show in Finder |
| Copy email in Mail | "Email address copied" | — |
| Offline / back online | "You're offline — content still works" | — |

Max one banner visible at a time; others queue (max 3, oldest dropped into the Center silently).

## Anatomy
**Banner:** 344 × auto px card, top-right, 12 px below the menu bar, `--material-thick`, radius 16 px; app icon
24 px, app name (11 px caps), title (13 px semibold), body (13 px), hover reveals ✕ and action buttons.
**Notification Center:** right-side panel 360 px wide, full workspace height, opened by clicking the clock;
contains "Notifications" list (grouped by app) and a small widget area (date, "Open to work" status, **"Now"**
widget, résumé shortcut). The **Now** widget (`MAC-NOTIF-07`, `shared/23`) shows `person.now.text` with "Updated
{now.updated}" in the widget caption style and is a link to Safari's About (`/macos/safari`). It is static (no
timer), a widget and not a banner, so the trigger table above is unchanged.

## Behaviour & states
- Banner dwell 6 s minimum; **pauses on hover and on focus**; ✕ or swipe-right dismisses; clicking the body performs
  the primary action.
- Every banner is appended to the Center regardless of how it was dismissed; "Clear" per group / all.
- Center closes on outside click, Esc, or clicking the clock again. It never steals focus when a banner appears.

## Navigation & routes
No history writes. Actions dispatch kernel actions as usual.

## Motion
In: spring r 0.40 ζ 0.85 from the right (translateX 120 % → 0). Out: 250 ms ease-in to the right. Swipe hands
velocity to the spring. Center panel slides in 300 ms `0.2,0.9,0.3,1`. Reduced motion: fade only.

## Responsive
`compact`: banners span the width minus 16 px margins under the menu bar; Center is a full-screen sheet from the top.

## Accessibility
A `role="status"` container exists in the DOM **from shell mount** (before the first notification). Banner actions
are real buttons, reachable via F6-free navigation: Alt+Shift+O (Overview) is separate; the Center button (clock) is
in the status group. Banners never move focus. The Center is a non-modal labelled region with a heading.

## Edge cases
Banner arrives during a drag → queued until commit. Multiple triggers in one tick → coalesced in order. Reduced
motion → no slide. Notification referencing a closed app → action re-opens it.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `MAC-NOTIF-01` | Banner component, queue (1 visible, max 3), dwell ≥ 6 s, pause on hover/focus | `cmp: Notification region pre-exists; hover pauses` | P3 |
| `MAC-NOTIF-02` | Trigger table (deterministic, identical for all visitors) | `unit: trigger → notification mapping` | P3 |
| `MAC-NOTIF-03` | Notification Center keeps every banner; clear actions | `e2e: dismissed banner present in the Center` | P3 |
| `MAC-NOTIF-04` | Spring in / ease out / swipe with velocity hand-off | `e2e: swipe dismiss; R1 fade-only under reduced motion` | P3 |
| `MAC-NOTIF-05` | Never steals focus; status region semantics | `cmp: focus unchanged when a banner appears` | P3 |
| `MAC-NOTIF-06` | Compact variants | `e2e: M3 full-width banner + sheet Center` | P3 |
| `MAC-NOTIF-07` | "Now" widget in the Center from `person.now`, links to Safari About | `cmp: widget text equals data; link opens Safari; absent when now is missing` | P8 |

## Not like the others
Top-right banners and a right-side Center opened from the **clock** (Windows: bottom-right toasts + a Center that
shares a flyout with the calendar, Quick Settings separate; iOS: top banners that expand, Center pulled from the
top; Android: heads-up cards + the shade).
