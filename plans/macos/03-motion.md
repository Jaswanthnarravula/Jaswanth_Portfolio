# macOS / 03 — Motion

## Role + requirement refs
The macOS motion language with real numbers. Primitives, rules and reduced-motion composition are owned by
`shared/07-motion-system.md` — this file only supplies macOS values and techniques. R37, R38.

## Character
Quick, confident ease-outs. Things scale a little and settle; menus do not animate at all. Almost nothing
overshoots (springs are reserved for banners and the Dock envelope).

## Timing table

| Interaction | Spec | Purpose (what it communicates) |
|---|---|---|
| Window open | 200 ms `cubic-bezier(0.2, 0.9, 0.3, 1)`, scale 0.92 → 1 + fade, origin = launcher rect | Causality: this window came from that icon |
| Window close | 140 ms `cubic-bezier(0.4, 0, 1, 1)`, scale → 0.96 + fade | State: gone, quickly |
| Minimize (Scale) | 380 ms; x-scale `power3.in`, y-scale + translate `power2.in` toward the Dock tile rect | Spatial: where it went |
| Restore | 340 ms `power3.out` from the tile rect | Spatial: where it came from |
| Shift-minimize | same at ×6 duration | Authentic detail |
| Zoom / un-zoom | 420 ms `cubic-bezier(0.3, 0, 0.1, 1)`; layout applied once, revealed by `translate` + `clip-path: inset()` | State change without text distortion |
| Focus change | 0 ms (shadow/controls swap instantly) | Feedback must be immediate |
| Menus / context menus | open 0 ms · selection blink 60 ms · fade out 130 ms | macOS signature |
| Dock magnification | per-icon transform; envelope spring r 0.18 ζ 1 | Feedback + hierarchy |
| Dock launch bounce | 520 ms per bounce, 18 px, only while loading | State: loading |
| Spotlight | in 120 ms scale 0.98 → 1 · out 100 ms | Hierarchy: transient overlay |
| Banner in / out | spring r 0.40 ζ 0.85 from the right / 250 ms ease-in | Hierarchy: peripheral |
| Notification Center | 300 ms `0.2, 0.9, 0.3, 1` slide | Spatial |
| Mission Control | 420 ms `0.3, 0, 0.1, 1`, all tiles in one ticker pass | Spatial overview |
| Sheet (compose, Quick Look) | 260 ms `0.2, 0.9, 0.3, 1` drop / 200 ms lift | Hierarchy: belongs to this window |
| Finder column push | 200 ms `0.2, 0.9, 0.3, 1` | Spatial: deeper |
| Lock → desktop | content 220 ms, wallpaper crossfade 260 ms, Dock + menu bar stagger 60 ms | Arrival |

## Interruption rules (macOS specifics)
- Minimize/restore, zoom and Mission Control are **single progress timelines**: a second click reverses
  (`timeline.reverse()`), never queues.
- Window open interrupted by close → open is killed, close starts from current values.
- Any key during boot/lock skips (`MAC-BOOT-03`, `MAC-LOCK-03`).
- Drag always wins over an in-flight open (window becomes draggable at progress > 0.5; the open tween is killed).

## Reduced motion
Per `MOTION-RM-01`: flights → 150 ms crossfade; no magnification, bounce (static pulsing dot instead), parallax or
blink; Mission Control switches layout instantly.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `MAC-MOTION-01` | Timing table implemented as tokens (no magic numbers in components) | `unit: macOS motion tokens match this table` | P3 |
| `MAC-MOTION-02` | Every transition reversible/interruptible as specified | `e2e: impatience script on macOS (spam min/restore/zoom/MC)` | P3 |
| `MAC-MOTION-03` | Compositor-only properties in all flights | `perf: no Layout > 1 ms in tagged flights` | P3 |
| `MAC-MOTION-04` | Reduced-motion variants | `e2e: R1 on macOS` | P3 |

## Not like the others
Zero-duration menus and ease-out scaling (Windows: WinUI duration ladder with a strong entrance curve; iOS:
springs with velocity hand-off everywhere; Android: emphasized two-segment easing and ripples; Linux: no motion).
