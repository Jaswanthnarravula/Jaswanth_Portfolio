# Windows 11 / 03 — Motion

## Role + requirement refs
The Windows (WinUI/Fluent) motion language with real numbers. Primitives and rules: `shared/07-motion-system.md`.
R37, R38.

## Character
Disciplined and quick. A fixed **duration ladder** and three curves; entrances decelerate hard, exits accelerate
and are shorter than entrances. Nothing bounces.

## Tokens
- **Durations:** 83 · 167 · 250 · 333 · 500 ms.
- **Curves:** entrance `cubic-bezier(0, 0, 0, 1)` · exit `cubic-bezier(1, 0, 1, 1)` · point-to-point
  `cubic-bezier(0.55, 0.55, 0, 1)` · window-manager `cubic-bezier(0.1, 0.9, 0.2, 1)`.

## Timing table

| Interaction | Spec | Purpose |
|---|---|---|
| Window open | 250 ms, scale 0.9 → 1 + fade, from the launcher rect, entrance curve | Causality |
| Window close | 167 ms, scale → 0.95 + fade, exit curve | State |
| Minimize | 250 ms `cubic-bezier(0.8, 0, 0.78, 1)` toward the taskbar button | Spatial |
| Restore from taskbar | 250 ms window-manager curve | Spatial |
| Maximize / restore | 250 ms / 200 ms window-manager curve; layout-once + `clip-path` reveal; radius 8 → 0 | State |
| Snap preview | fade + scale 0.98 → 1 in 167 ms; commit flight 250 ms | Feedforward |
| Start / Search open · close | 250 ms `translateY(56px)` + fade · 167 ms | Hierarchy |
| Flyouts (tray, snap layouts, jump lists, menus) | 167 ms in · 83 ms out | Hierarchy |
| Toast in · out | 333 ms from the right · 167 ms | Peripheral |
| Taskbar pill | `scaleX` 167 ms point-to-point | State |
| Taskbar icon press | scale 0.85 (83 ms) → 1 (167 ms) | Feedback |
| Page drill-in · drill-out (Settings, GitHub, Explorer) | 250 ms rise 16 px + fade · 167 ms | Spatial depth |
| Hover fills | 83 ms | Feedback |
| Task View enter · exit | 333 ms · 250 ms | Overview |
| Lock slide-up · desktop reveal | 333 ms · taskbar 250 ms | Arrival |
| Expander | 167 ms `clip-path` reveal | Disclosure |

## Interruption rules (Windows specifics)
Minimize/restore, maximize/restore, Task View and Snap commit are single progress timelines → second input
reverses. Esc during a Snap preview cancels and returns the window under the pointer. Drag wins over an in-flight open.

## Reduced motion
Per `MOTION-RM-01`: all flights → 150 ms crossfade; no pill sliding (instant width), no icon press scale, no drill
translation; spinner on the boot screen is removed with the boot itself.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `WIN-MOTION-01` | Duration ladder + curves as tokens; table implemented from tokens | `unit: Windows motion tokens match this file` | P4 |
| `WIN-MOTION-02` | Reversible/interruptible transitions incl. Snap cancel | `e2e: impatience script on Windows` | P4 |
| `WIN-MOTION-03` | Compositor-only properties | `perf: no Layout > 1 ms in tagged flights` | P4 |
| `WIN-MOTION-04` | Reduced-motion variants | `e2e: R1 on Windows` | P4 |

## Not like the others
A strict **ladder of five durations** and hard-decelerating entrances, exits shorter than entrances, **no springs at
all** (macOS: ease-out scaling with zero-duration menus; iOS: springs everywhere; Android: emphasized easing + ripple).
