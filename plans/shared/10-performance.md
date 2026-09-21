# shared/10 — Performance

## Tooling budget clarification (2026-09-21)
`@vitest/coverage-v8` is a development-only companion to Vitest required to enforce the planned coverage gates.
It adds zero browser bytes; all runtime budgets below remain unchanged.

## Purpose
Hit and hold the targets on real devices: **LCP < 2.5 s · INP < 200 ms · CLS < 0.1 · Lighthouse Accessibility
≥ 95 · 60 fps transitions · WebGL lazy · graceful fallbacks.** Requirements: R39, R40, R41, R48, T.

## Decisions

| Decision | Rationale | Rejected |
|---|---|---|
| Three **independent axes** set before paint: tier, motion, glass | A powerful GPU can still prefer reduced motion | One combined "quality" level |
| Tier 1 (CSS glass) is the default; **tier 2 (WebGL) is opt-in by evidence**; phones/tablets never get it | Mobile contexts get killed; `hardwareConcurrency` lies | Feature-detect WebGL → use it |
| The **runtime governor is the source of truth**; it only demotes, and remembers | Detection is a guess | Promote/demote oscillation |
| WebGL = **imperative three.js**, one fullscreen-triangle shader, Hello/chooser only | No reconciler coupling (R3F vs Next's vendored React); zero render targets | R3F canvas; MeshTransmissionMaterial; WebGL inside OSes |
| **No animated or WebGL wallpapers inside any OS** | They force every `backdrop-filter` surface to re-blur each frame | Parallax shader wallpapers |
| R3F + drei + GLTF/Draco/Meshopt/KTX2 are **dormant** with a documented trigger | No 3D asset beats real full-page OS snapshots + typography here | Decorative models |
| INP is measured in **Playwright with `web-vitals`**; Lighthouse CI covers LCP/CLS/TBT/a11y/budgets | Lighthouse navigation mode cannot measure INP | Lighthouse for everything |

## Specification

### Tier detection (`PERF-TIER-01`) — ≤ 600 B synchronous inline script sets `<html data-tier data-motion data-glass>`
1. A persisted demotion `{tier, exp}` (14-day TTL) caps the tier.
2. Force **T0** if any: `saveData` / `prefers-reduced-data` · `deviceMemory ≤ 2` · `hardwareConcurrency ≤ 2` ·
   no `backdrop-filter` · `forced-colors: active`.
3. Otherwise **T1** (CSS only — nothing extra loads).
4. **T2 candidacy** evaluated in idle time after `load`, all required: `(pointer: fine)` and `(hover: hover)` ·
   width ≥ 1024 · `deviceMemory ≥ 8` or undefined · `hardwareConcurrency ≥ 8` · battery not low
   (`!charging && level < 0.3` disqualifies) · motion full · glass full.
5. **GPU probe** (T2 candidates only, ~20 ms idle): WebGL2 context with `failIfMajorPerformanceCaveat: true`;
   renderer string via `WEBGL_debug_renderer_info` or `gl.RENDERER`; deny
   `/SwiftShader|llvmpipe|Software|Basic Render|Intel.*(HD|UHD)|Mali|Adreno|PowerVR/`; allow Iris Xe / Arc at
   DPR 1.0; release via `WEBGL_lose_context`.
`motion=reduced` ← system preference or in-app setting. `glass=solid` ← `prefers-reduced-transparency`,
`prefers-contrast: more`, or setting. T2 requires motion full **and** glass full. Tiers change paint, never layout.

### Governor (`PERF-GOV-01`)
Samples ticker deltas only during tagged flights. A flight fails if p95 > 22 ms or three frames > 50 ms (first two
frames ignored). Three failed flights in a rolling ten → demote one tier, persist, apply at the next app-open or
route boundary. Never promotes mid-session. WebGL: DPR steps 1.5 → 1.25 → 1.0, then unmount to T1;
`webglcontextlost` → `preventDefault`, drop to T1 for the session, no restore loop (risk 18).

### JavaScript budgets (gzip; enforced by Lighthouse CI `resource-summary` per route)

| Chunk | Budget | Load trigger |
|---|---|---|
| Framework | ~105 KB (fixed) | initial |
| Welcome app JS | ≤ 20 KB → **first load ≤ 130 KB** | initial |
| `welcome-motion` (gsap + MorphSVG + precompiled paths + intro) | ≤ 45 KB | idle after first paint |
| `welcome-webgl` (three + shader + GlassStage) | **≤ 190 KB** | T2 only, after `load`, idle, no input for 500 ms |
| Intro audio | ~66 KB mp3 | idle after first paint; never before first paint |
| `os-kernel` | ≤ 28 KB | any OS route |
| Shells: macOS / Windows / iOS / Android / Linux | ≤ 40 / 38 / 30 / 32 / 12 KB | per OS |
| Terminal engine | ≤ 18 KB | Linux; lazy in macOS/Windows Terminal apps |
| Content apps | ≤ 15 KB each (Overview ≤ 20 + ScrollTrigger ~18 + Lenis ~5) | app launch; prefetch on icon hover/focus |
| Search matcher + index | ≤ 4 KB + ≤ 10 KB | OS idle |
| Tour director · each easter egg · analytics | ≤ 8 KB · on trigger · ≤ 3 KB on idle | lazy |
| **OS first load total** | **≤ 200 KB** | |

**Never in an initial bundle:** three, shaders, GSAP, Lenis, kernel/shell code on `/`, terminal, wallpapers,
decoders, non-Inter fonts, audio, tour, eggs, analytics.

### LCP / INP / CLS tactics
- **LCP:** the element is a server-rendered `<h1>`/section block that never starts at `opacity: 0` and needs no
  webfont (inline SVG paths are not LCP candidates). **Anchoring rule (risk 7):** the SSR section block is ≥ the
  largest text/image block in the first OS frame; wallpapers are full-viewport (excluded by Chrome) CSS gradients
  or low-priority AVIF; the URL's OS chunk imports at module scope. Target ≤ 1.5 s on `/`.
- **INP:** handlers do O(1) synchronous writes; store commits deferred to rest or `startTransition`; one delegated
  passive listener per shell; launch placeholders decouple feedback from chunk loading; ≤ 3 live
  `backdrop-filter` surfaces; none on T0.
- **CLS:** shell is `position: fixed; inset: 0; height: 100dvh`; onboarding steps share one grid cell; all media
  has explicit dimensions; tier/asset-mode switches repaint but never relayout.
- `content-visibility: auto` + `contain-intrinsic-size` on long lists and off-screen home pages; `hidden` for
  minimized/background apps. `will-change` only during flights.

### Canvas lifecycle (`PERF-GL-01`)
Mounted via dynamic import, `position: fixed; z-index: -1; pointer-events: none; aria-hidden`; shader compiled
with `compileAsync` in idle time; fades in over 600 ms above a palette-matched CSS gradient; 30 fps when idle,
full rate on input; paused on `visibilitychange`; disposed when leaving `/` — `renderer.info.memory` must read
zero before unmount.

### Dormant 3D pipeline — trigger and budget (`PERF-3D-01`)
Trigger: a portfolio project that is itself a physical/3D artifact; it lives in that project's detail view, T2
only, loaded on click. Budget: ≤ 25k triangles, ≤ 2 materials, two 1024² WebP/AVIF textures (not KTX2), **Meshopt
not Draco** (decoder is a ~10 KB bundled module), ≤ 450 KB total. Entry gate for R3F/drei: compat test on Next's
vendored React, self-hosted decoder paths always passed explicitly, `useDetectGPU` never used.

### Leak prevention
One canvas. All GSAP in `useGSAP({scope})`. Every listener via `AbortController`. No raw rAF. One shared
`ResizeObserver` per shell with unsubscribe handles. Lenis `destroy()` + ticker removal. Stores hold ids, never
DOM nodes. StrictMode double-mount is the first leak test.

### Profiling procedure (production build + `next start`, never the dev server)
1. Cold `/` at 4× CPU, Fast 4G: LCP node is the `<h1>`; TBT < 150 ms; three chunk requested only after `load`.
2. Each signature interaction ×5 at 4–6× throttle: no Layout/Recalculate Style > 1 ms inside a flight; INP from Live Metrics.
3. Paint flashing + layer borders: only the moving layer repaints; ≤ 30 layers.
4. Leak loop: open/close each app ×20, enter/exit each OS ×5, force GC, heap diff < 2 MB growth, zero detached
   elements growth, stable listener count.
5. Real devices: mid-range Android, iPhone, Intel-iGPU laptop on battery (confirm the governor demotes).
6. Median of three Lighthouse mobile runs on a Vercel preview vs budgets.

## Edge cases
Battery API missing → ignored. `deviceMemory` undefined (Safari/Firefox) → treated as unknown, not as low.
Background tab → ticker and canvas pause. Save-Data on → T0 and no audio/GitHub imagery prefetch.

## Feature IDs + acceptance tests

| ID | Feature | Acceptance test |
|---|---|---|
| `PERF-TIER-01` | Pre-paint tier script, three axes | `unit: detection table; e2e: attributes present before first paint` |
| `PERF-GOV-01` | Demote-only governor | `unit: 3/10 failed flights demote and persist; never promotes` |
| `PERF-BUDGET-01` | JS budgets per route | `lhci: resource-summary:script:size per route` |
| `PERF-LCP-01` | LCP ≤ 2.5 s on `/` and one deep link per OS | `lhci: largest-contentful-paint ≤ 2500` |
| `PERF-INP-01` | INP ≤ 200 ms under 4× CPU | `e2e: perf project scripted interactions per OS` |
| `PERF-CLS-01` | CLS ≤ 0.1 (session) | `lhci + e2e: cumulative-layout-shift ≤ 0.1` |
| `PERF-GL-01` | Canvas lifecycle + disposal | `unit: GlassStage unmount leaves renderer.info.memory zero` |
| `PERF-GL-02` | Context loss / mobile never gets WebGL | `e2e: forced context loss → working Hello; no WebGL request on coarse pointer` |
| `PERF-LAZY-01` | Nothing heavy in initial bundles | `perf: three/gsap/audio absent before load event` |
| `PERF-3D-01` | Dormant pipeline rules documented | `static: no import of @react-three/* or useGLTF in v1 code` |
| `PERF-LEAK-01` | Leak loop | `e2e: nightly heap/listener stability script` |
| `PERF-BLUR-01` | ≤ 3 live blur surfaces | `e2e: X5 backdrop-filter count per screen` |

## Open questions
None.
