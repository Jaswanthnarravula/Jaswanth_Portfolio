# Android / 03 — Motion (Material 3)

## Role + requirement refs
The Material motion language with real numbers. Primitives and rules: `shared/07-motion-system.md`. R20, R37, R38.

## Character
**Duration-based, easing-driven, pattern-based.** A small set of named transition patterns (container transform,
shared axis, fade-through, fade) with **emphasized** easing; touch feedback is a **ripple** that starts where the
finger landed. Springs are used only where a finger lets go (shade, sheets, drawer, predictive Back).

## Easing and duration tokens
- **Emphasized** (two-segment path): `M0,0 C0.05,0 0.133,0.06 0.167,0.4 C0.208,0.82 0.25,1 1,1` (GSAP CustomEase).
- **Emphasized-decelerate** `cubic-bezier(0.05, 0.7, 0.1, 1)` · **Emphasized-accelerate** `cubic-bezier(0.3, 0, 0.8, 0.15)`
  · **Standard** `cubic-bezier(0.2, 0, 0, 1)`.
- Durations: short 50–200 ms · medium 250–400 ms · long 450–600 ms.

## Timing table

| Interaction | Spec | Purpose |
|---|---|---|
| App open (container transform) | 450 ms emphasized; icon fade-out 0–35 %, content fade-through 35–100 % from scale 0.92 | Causality |
| App close / leave via Back | 350 ms emphasized (accelerate → decelerate), into the icon or centre-bottom | Spatial |
| Predictive Back preview | finger-linked: scale → 0.9, radius → 28 dp, shift 8 % toward the edge; commit 250 ms · cancel 350 ms decelerate | Feedforward |
| Card → detail / FAB → compose | 300 ms emphasized container transform | Continuity |
| Shared-axis X (forward/back) | 300 ms emphasized; 30 dp slide + fade (out 0–35 %, in 35–100 %) | Hierarchy depth |
| Fade-through (bottom nav) | out 90 ms accelerate → in 210 ms decelerate, scale 0.92 → 1 | Peer switch |
| **Ripple** | grow 450 ms (decelerate) from the touch point; min press 225 ms; fade 375 ms; WAAPI on a pooled span | Touch feedback |
| State layer | hover 8 % · focus 10 % · pressed 10 % · dragged 16 %; 100 ms | Feedback |
| Shade / drawer / sheets | finger-linked; settle spring ζ 0.9, k 700 (≈ 350 ms), velocity inherited | Direct manipulation |
| Heads-up in · out | 400 ms emph-decelerate · 200 ms emph-accelerate | Peripheral |
| Snackbar in · out | 150 ms · 75 ms | Confirmation |
| Menu / dialog | 150–200 ms decelerate (scale from origin) · 75–100 ms out | Hierarchy |
| FAB extend / shrink | 200 ms standard | State |
| Switch thumb | 150 ms standard + halo | State |
| Re-theme (wallpaper change) | 300 ms colour crossfade via CSS variables | Identity |
| Boot → circular reveal | 300 ms emph-decelerate `clip-path: circle()` | Arrival |

## Interruption rules (Android specifics)
Duration-based tweens interrupted by input are **killed and re-created from the current progress**, duration scaled by
remaining distance (min 150 ms). Finger-linked surfaces can be caught mid-settle. Back during any transform reverses it.
Ripples never block: they are decorative layers on the compositor.

## Reduced motion ("Remove animations")
Per `MOTION-RM-01`: transforms → 150 ms fade; **ripple becomes a state-layer opacity change only**; no predictive
preview animation (Back acts immediately); no circular reveal; finger-linked sheets still track the finger.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `AND-MOTION-01` | M3 easing + duration tokens incl. the emphasized CustomEase path | `unit: Android motion tokens match this file` | P6 |
| `AND-MOTION-02` | Pattern library: container transform, shared axis, fade-through | `cmp: pattern helpers produce specified keyframes` | P6 |
| `AND-MOTION-03` | **Ripple from the touch point** (pooled span, WAAPI, 80 ms delay inside scrollers) + state layers | `e2e: ripple origin = pointer coords; perf: compositor-only` | P6 |
| `AND-MOTION-04` | Interruption: distance-scaled re-creation; Back reverses | `e2e: Android impatience script` | P6 |
| `AND-MOTION-05` | Reduced-motion variants (ripple → state layer) | `e2e: R1 on Android` | P6 |

## Not like the others
**Named transition patterns with emphasized easing and ripples** (iOS: velocity springs + dim-on-press; Windows:
duration ladder, no ripples; macOS: ease-out scaling; Linux: none).
