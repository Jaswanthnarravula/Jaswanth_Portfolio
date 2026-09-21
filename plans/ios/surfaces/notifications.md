# iOS / surfaces — Banners and Notification Center

## Role + requirement refs
Banners that drop from the top and expand, plus the Notification Center pulled from the top-left/centre where every
banner also lands (WCAG 2.2.1). R14, R25.

## Portfolio mapping
Deterministic, identical for every visitor:

| Trigger | Banner | Action |
|---|---|---|
| First Home Screen after unlock (once per session) | "Welcome — tap any app. Pull down to search." | Open Spotlight |
| Tour offer (`shared/20`) | "New here? Take a 20-second tour." | Start · Not now |
| **Continuity offer** (`shared/16`) | "Handoff · {title}" — "From {OS}" | Open |
| Résumé downloaded | "Résumé.pdf saved" | Open in Files |
| Address copied (Mail/Messages) | "Copied" | — |
| Offline / online | "No connection — content still works" | — |

## Anatomy
**Banner:** capsule-ish card under the status bar, 8 pt side margins, radius 24 pt, material `thin`; app icon 38 pt,
app name caps 13 pt + "now", title 15 pt semibold, body 15 pt (2 lines). Expanded state (pull down or long-press):
grows to show full text + action buttons as a stacked list. One at a time; queue ≤ 3.
**Notification Center:** full-screen sheet pulled down from the top-left two-thirds (or opened by clicking the status
bar clock): large clock/date header, notifications grouped in stacks by app, "Clear" per stack; swipe up / Home
indicator closes.

## Behaviour & states
- Dwell ≥ 6 s; pauses while pressed, hovered or focused. Swipe **up** dismisses; tap performs the primary action
  (opens the app with a flight **from the banner rect**); pull down expands.
- However a banner ends, it is appended to the Center.
- Never steals focus. While an app is open, banners overlay the app (not the Home Screen only).
- In the Center: tap → open; swipe left → Clear (button also revealed on focus).

## Navigation & routes
No history writes for banners/Center. Actions follow normal app-open rules.

## Motion
In: spring r 0.45 ζ 0.78 from y −120 %. Out: 250 ms ease-in upward, or finger velocity handed to the spring. Expand:
height via `clip-path` reveal + content fade 200 ms. Center: finger-driven sheet, spring r 0.38 ζ 1. Reduced motion: fades.

## Responsive
Phone landscape: banner max 420 pt, centred. Pad: banner 380 pt at the top-centre; Center is a 420 pt column.
Laptops/desktops: same as pad, at the top-centre of the full page.

## Accessibility
`role="status"` region present from mount; banner actions are buttons; expansion is available via a "More" button
(not only by gesture); Center is a modal `dialog` with a heading and Close button; clock `<time>` not live.

## Edge cases
Banner during a flight → queued until rest. Center opened during an app flight → ignored until rest. Reduced motion
→ no spring. Top-left pull vs top-right pull (Control Center) are separated at 60 % of the width; both have buttons
in the status bar as alternatives.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `IOS-NOTIF-01` | Banner component: queue, dwell ≥ 6 s, pause, swipe-up dismiss, expand | `cmp: region pre-exists; pause on hover/focus; More button expands` | P5 |
| `IOS-NOTIF-02` | Trigger table incl. Handoff banner | `unit: trigger mapping; e2e: C1 with iOS as target` | P5 |
| `IOS-NOTIF-03` | Banner tap opens the app from the banner rect | `e2e: flight origin = banner` | P5 |
| `IOS-NOTIF-04` | Notification Center keeps everything; Clear per stack | `e2e: dismissed banner present in the Center` | P5 |
| `IOS-NOTIF-05` | Never steals focus; dialog semantics for the Center | `e2e: X1 with Center open` | P5 |

## Not like the others
Banners drop from the **top and expand in place**; the Center is a **pull-down sheet** separate from Control Center
(Android: heads-up cards and one shade containing notifications **and** Quick Settings; desktops: corner toasts/banners).
