# iOS / 03 — Motion

## Role + requirement refs
The iOS motion language with real numbers. Primitives and rules: `shared/07-motion-system.md`. R15, R37, R38.

## Character
**Everything is a spring, and the finger is in charge.** Gestures drive progress 1:1; on release the spring inherits
the finger's velocity and a projected end point decides the outcome. Slight, fast-settling overshoot on things that
"arrive"; critically damped for things that must feel precise (sheets, toggles).

## Spring table (response `r` seconds, damping ratio `ζ`)

The flight responses were shortened after the owner's review ("way too slow… should give a premium smooth and fast
feel"): measured on the preview build, an open settled in 707 ms and a return Home in 1152 ms, against 296 ms for a
macOS window. The physics are unchanged — these are the same springs, tuned to land in about a third of a second.

| Interaction | Spec | Purpose |
|---|---|---|
| App open (icon → app) | r 0.26 ζ 0.92 | Causality: the app *is* that icon |
| App close (app → icon) | r 0.28 ζ 0.90 | Spatial: where it lives |
| Interactive Home / switcher | finger-driven; release projection `v × 0.499`; settle r 0.28 ζ 0.90 | Direct manipulation |
| Folder open / close | r 0.26 ζ 0.92 / r 0.28 ζ 0.90 | Same physics as apps |
| Sheet present / dismiss | r 0.32 ζ 1.0 (no overshoot); finger-driven dismiss | Hierarchy |
| Control Center / Spotlight reveal | finger-driven; settle r 0.32 ζ 0.85–1.0 | Direct manipulation |
| Banner in | r 0.38 ζ 0.78 | Peripheral arrival |
| Quick-action menu | r 0.35 ζ 0.75 + scale dip 1 → 0.96 → 1.08 (180 ms) | Feedback ("haptic") |
| Button press | scale 0.97, r 0.18 ζ 1 | Feedback |
| Switch thumb · segmented thumb | r 0.25 ζ 0.9 · r 0.3 ζ 1 | State |

## Curve-based timings

| Interaction | Spec |
|---|---|
| Nav push / pop | 300 ms `cubic-bezier(0.32, 0.72, 0, 1)`; underlay parallax −30 % + dim 10 %; interactive on edge swipe |
| Large-title collapse | scroll-linked, transform-only |
| Press dim | 80 ms in / 200 ms out |
| Banner out | 200 ms ease-in (or velocity hand-off on swipe) |
| Status-bar style crossfade | 200 ms |
| Home arrival fly-in | icons 1.15 → 1 + fade, 12 ms column stagger, spring r 0.5 ζ 0.9 |
| Safari bar collapse | 200 ms `0.32, 0.72, 0, 1` |

## Interruption rules (iOS specifics)
- Every spring supports `retarget()` mid-flight with velocity preserved: tapping another icon during an open
  retargets the first closed and opens the second.
- Gestures can **catch** an in-flight animation (touch down on a moving sheet/surface takes over at its current position).
- Pops/dismissals decide by **projected** position, not current position.
- Any tap skips Messages typing indicators and the arrival fly-in.

## Reduced motion
Per `MOTION-RM-01`: flights → 150 ms crossfade; interactive gestures still track the finger (direct manipulation is
not "motion" to remove) but settle with a fade; no parallax, fly-in, scale dip or typing dots.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `IOS-MOTION-01` | Spring + curve tables as tokens | `unit: iOS motion tokens match this file` | P5 |
| `IOS-MOTION-02` | Velocity hand-off + projection on every gesture | `unit: projection decision; e2e: slow vs fast flick outcomes` | P5 |
| `IOS-MOTION-03` | Catch-and-retarget of in-flight animations | `e2e: tap second icon mid-open; touch down on a moving sheet` | P5 |
| `IOS-MOTION-04` | Compositor-only properties | `perf: no Layout > 1 ms in tagged flights` | P5 |
| `IOS-MOTION-05` | Reduced-motion variants | `e2e: R1 on iOS` | P5 |

## Not like the others
**Springs with velocity projection everywhere** (Android: duration-based **emphasized easing** and ripples; Windows:
fixed duration ladder, no springs; macOS: ease-out scaling, zero-duration menus; Linux: none).
