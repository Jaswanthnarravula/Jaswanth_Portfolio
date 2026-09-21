# shared/07 — Motion system

## Purpose
The primitives, rules and numbers that make every interaction feel immediate, physical and deliberate — without
React re-renders, layout thrash or blocked input. Per-OS values live in `{os}/03-motion.md`. Requirements: R37, R38, R39.

## Decisions

| Decision | Rationale | Rejected |
|---|---|---|
| **Closed-form damped spring** (~1 KB) for physical things | Exact, frame-rate independent, keeps velocity on retarget → interruptible | Keyframe springs; framer-motion |
| **GSAP timelines** for authored sequences (Hello, intro, OS enter/exit, macOS minimize, terminal output, menus) | Deterministic `progress(1)`, reversible, `useGSAP` cleanup | CSS keyframes for sequences |
| One **ticker** (GSAP's) drives everything; no raw `requestAnimationFrame` | One clock, easy pause on hidden tab, leak-checkable | Multiple rAF loops |
| Animated values are written **imperatively to refs**, never via JSX `style` or React state | A re-render would overwrite in-flight values | State-driven animation |
| Only `transform`, `opacity`, `clip-path`, `filter` on small layers animate | Compositor-friendly | `width/height/top/left`, `transition: all` |
| Reduced motion handled **once**, in the primitives | No per-component branching | `if (reduced)` everywhere |
| No View Transitions API | Uninterruptible; raster snapshots blur on scale-up; blocks input | — |
| `gsap.ticker.lagSmoothing` left at default | Setting 0 globally turns a hitch into a visible jump everywhere | Lenis recipe default |

## Specification

### Primitives (`lib/motion`)
- **`spring(target, {response, damping})`** — critically/under-damped oscillator; `retarget(to)` preserves
  velocity; `k = (2π/response)²`, `c = 2·damping·√k`, `m = 1`.
- **`flight(from: Rect, to: Rect, opts)`** — shared-element rect interpolation: uniform `translate + scale`, plus
  `clip-path: inset(... round r)` for aspect/corner changes. Used by iOS icon↔app, Android container transform,
  window open-from-launcher, OS chooser → OS. **Targets are re-measured at start and on every retarget.**
- **`director`** — epoch-keyed registry of timelines for OS-level transitions; `kill(epochBefore)`.
- **`dur(ms)`** — returns 0 (or a 150 ms crossfade token) under reduced motion; all timelines use it.
- **`drag(handle, {onMove, onCommit})`** — pointer capture; handler only stores coordinates; the ticker writes
  `translate3d`; commits to the kernel on `pointerup`/`pointercancel`/`lostpointercapture`.

### Rules every animation must satisfy (`MOTION-RULE-*`)
1. **Purpose:** it communicates hierarchy, state, causality, spatial relationship or feedback — named in the spec.
2. **Input wins:** any click/key/touch retargets or completes the animation instantly; nothing is `await`ed
   before responding.
3. **End state derives from kernel state**, so `kill()` + set-final is always safe.
4. **No mount-blocking:** feedback starts synchronously (launch placeholder); heavy content mounts at progress
   > 0.9 or at rest.
5. `will-change` is set at flight start and removed at rest; never in static CSS; ≤ 30 layers on mobile.
6. Elements in flight are `inert`; focus has already moved (`shared/09-accessibility.md`).

### Reduced motion composition (`MOTION-RM-01`)
`data-motion="reduced"` (system or in-app setting): flights → 150 ms opacity crossfade · springs snap ·
magnification and parallax off · Hello static · terminal lines appear instantly · ripple → state-layer opacity only
· boot and lock animations removed · intro → crossfade. Sound is independent of motion.

### Signature numbers (summary — full tables in each OS's `03-motion.md`)

| OS | Open | Close | Signature |
|---|---|---|---|
| iOS | spring r 0.42 ζ 0.86 | spring r 0.50 ζ 0.80 | nav push 350 ms `0.32,0.72,0,1`; press dim 80 in / 200 out |
| macOS | 200 ms `0.2,0.9,0.3,1` scale 0.92→1 | 140 ms `0.4,0,1,1` | minimize (Scale) 380 ms; menus open 0 ms; Dock bounce 520 ms |
| Windows 11 | 250 ms from scale 0.9, curve `0,0,0,1` | 167 ms `1,0,1,1` | WinUI ladder 83/167/250/333/500 ms; taskbar pill 167 ms |
| Android | container transform 450 ms emphasized | 350 ms | ripple grow 450 / fade 375 ms; emphasized path easing |
| Linux | 0 ms | 0 ms | line reveal 90 ms, 12 ms stagger, ≤ 240 ms total |

### Techniques fixed here
- **macOS minimize = the authentic Scale effect** (a real macOS setting). A true genie needs rasterized DOM
  (html2canvas) — rejected as slow and inaccurate.
- **Maximize/restore:** apply the target layout once, then animate `translate` + `clip-path: inset()` to reveal it
  (no non-uniform scale → no distorted text); reversible at any progress.
- **Dock magnification:** per-icon `transform` from pointer distance, `scale = 1 + 0.6·cos²(πd/2R)`, R = 3 pitches,
  cumulative `translateX` so neighbours part; three-slice background pill; entry/exit smoothed by spring r 0.18 ζ 1;
  off on coarse pointers; keyboard focus scales to 1.25.
- **Ripple:** one pooled span per surface, WAAPI on the compositor, starts on `pointerdown` (80 ms delay inside scrollers).
- **Banners/toasts:** transform + opacity in a fixed region; swipe dismissal hands velocity to the spring.

### Scroll (Lenis + ScrollTrigger) — narrowly scoped
Only the long-form "Overview" page inside the desktop browser apps, on a nested scroller, fine pointer and
tier ≥ 1. Lenis `autoRaf: false`, driven by the ticker; ScrollTrigger uses that `scroller`. Never on the document
(the shell does not scroll), never on touch, never in Linux.

### Leak rules
All GSAP inside `useGSAP({scope})`; handler tweens via `contextSafe`; finished timelines `kill()`ed and nulled;
listeners registered with an `AbortController` signal; ticker callbacks remove themselves at rest; in dev,
`__motion.debug()` must report an empty set when idle.

## Edge cases
Tab hidden mid-animation → ticker pauses; on return, state snaps to kernel truth. Icon moved/removed before close
→ re-measure; if gone, centre scale 0.85 + fade. Rotation during flight → retarget to the new rect. Two retargets
in one frame → last wins.

## Feature IDs + acceptance tests

| ID | Feature | Acceptance test |
|---|---|---|
| `MOTION-SPRING-01` | Spring with velocity-preserving retarget | `unit: retarget mid-flight keeps velocity continuity` |
| `MOTION-FLIGHT-01` | Rect flight with re-measure | `e2e: O1 rotate mid-session, return animation lands on the new icon rect` |
| `MOTION-DRAG-01` | Pointer-capture drag, commit on release | `e2e: M2 drag commits once; zero React renders during drag` |
| `MOTION-DIR-01` | Epoch director | `unit: kill(epoch) stops older timelines only` |
| `MOTION-RULE-01` | Input always wins | `e2e: click during every open/close animation acts immediately` |
| `MOTION-RULE-02` | Compositor-only properties | `perf: no Layout > 1 ms inside a tagged flight` |
| `MOTION-RM-01` | Reduced-motion composition | `e2e: R1 getAnimations() shows nothing > 200 ms; end states identical` |
| `MOTION-LEAK-01` | No leaked tickers/listeners | `e2e: leak loop — ticker set empty at idle, listener count stable` |
| `MOTION-SCROLL-01` | Lenis/ScrollTrigger scoped to Overview | `perf: neither library requested on iOS, Android, Linux routes` |

## Open questions
None.
