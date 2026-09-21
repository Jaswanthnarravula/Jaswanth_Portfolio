# Android / surfaces — Boot

## Role + requirement refs
The Android boot animation doubling as the chunk-loading screen. R13, N6. Appearance rules fixed by
`04-os-chooser.md` (`CHOOSE-ENTER-02`): **first chooser entry per session only; never on deep links, refresh, `/go`
or re-entry; ≤ 1.5 s; any input skips; removed under reduced motion.**

## Portfolio mapping
None.

## Anatomy
Black stage (dark `surface` in light theme too — boot is always dark) · centred **animated mark** (asset
`and.boot.mark`): in `official` mode the Android/"G"-style boot mark supplied by the owner; in `original` mode an
original mark of **four rounded shapes in the dynamic palette** (primary, secondary, tertiary, primary-container)
that orbit and merge · below it, a thin 96 dp **indeterminate linear progress** (M3 style: two segments sliding).

## Behaviour & states
| State | Behaviour |
|---|---|
| Shown | Only if the Android chunk is still loading 150 ms after the click |
| Animating | Shapes loop (1.6 s): rotate 0 → 90°, scale 1 → 0.8 → 1, colours cross-fade through the palette; CSS `transform`/`opacity` only |
| Complete | Shapes converge into one circle → circle expands as a **circular reveal** of the lock screen / launcher (300 ms emphasized-decelerate) |
| Skip | Any input → reveal starts as soon as the shell is mounted |
| Slow (> 4 s) | Body-M text: "Starting Android…" + text button "Open the plain portfolio" |
| Failure | M3 dialog-style card: "Couldn't start Android" · Retry (filled) · Plain portfolio (text) |

Sets `session.bootSeen = true`.

## Navigation & routes
URL already `/android`. Back during boot → chooser.

## Motion
Circular reveal via `clip-path: circle()`; launcher arrival: At-a-glance and icons fade-through (scale 0.92 → 1,
50 ms stagger by row). Reduced motion: no boot, 150 ms crossfade.

## Responsive
Full page at every size (phone, tablet, laptop, desktop); the mark scales to `clamp(96px, 14vmin, 160px)`.

## Accessibility
`aria-hidden`; status "Starting Android" → "Android ready"; no focus inside; any key skips.

## Edge cases
Cached chunk → no boot frame. Hidden tab → completes silently.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `AND-BOOT-01` | Animated mark in the dynamic palette + indeterminate linear progress (CSS-only) | `e2e: throttled load shows the animation; perf: compositor-only` | P6 |
| `AND-BOOT-02` | Circular reveal into the next surface + fade-through arrival | `e2e: reveal plays once` | P6 |
| `AND-BOOT-03` | Appearance rules | `e2e: D1 deep link + reload show no boot frame` | P6 |
| `AND-BOOT-04` | Skip, slow and failure states | `e2e: keypress skips; offline → Retry + plain link` | P6 |
| `AND-BOOT-05` | Reduced motion removes boot | `e2e: R1` | P6 |

## Not like the others
A **colourful animated mark that ends in a circular reveal** (iOS: static logo; macOS: logo + bar; Windows: dot ring;
Linux: text log).
