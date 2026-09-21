# 06 — Acceptance ledger (Hello · Netflix · OS chooser)

Every feature ID defined in `02-hello-page.md`, `03-netflix-page.md` and `04-os-chooser.md` appears **exactly
once** here. All are delivered in **P1 Welcome** unless noted.

## Ledger

### 02 Hello page
| ID | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|
| `HELLO-LCP-01` | P1 | planned | | |
| `HELLO-DRAW-01` | P1 | planned | | |
| `HELLO-MORPH-01` | P1 | planned | | |
| `HELLO-PATHS-01` | P1 | planned | | |
| `HELLO-GLASS-01` | P1 | planned | | |
| `HELLO-GL-01` | P1 | planned | | |
| `HELLO-TAP-01` | P1 | planned | | |
| `HELLO-MUTE-01` | P1 | planned | | |
| `HELLO-RM-01` | P1 | planned | | |
| `HELLO-RETURN-01` | P1 | planned | | |
| `HELLO-A11Y-01` | P1 | planned | | |
| `HELLO-RESP-01` | P1 | planned | | |

### 03 Netflix page
| ID | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|
| `NFLX-INTRO-01` | P1 | planned | | |
| `NFLX-SKIP-01` | P1 | planned | | |
| `NFLX-AUDIO-01` | P1 | planned | | |
| `NFLX-AUDIO-02` | P1 | planned | | |
| `NFLX-MARK-01` | P1 | planned | | |
| `NFLX-PROF-01` | P1 | planned | | |
| `NFLX-PROF-02` | P1 | planned | | |
| `NFLX-CARD-01` | P1 | planned | | |
| `NFLX-RETURN-01` | P1 | planned | | |
| `NFLX-RM-01` | P1 | planned | | |
| `NFLX-A11Y-01` | P1 | planned | | |
| `NFLX-HAND-01` | P1 | planned | | |

### 04 OS chooser
| ID | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|
| `CHOOSE-CARD-01` | P1 | planned | | |
| `CHOOSE-BADGE-01` | P1 | planned | | |
| `CHOOSE-REL-01` | P1 | planned | | |
| `CHOOSE-PREF-01` | P1 | planned | | |
| `CHOOSE-ENTER-01` | P1 | planned | | |
| `CHOOSE-ENTER-02` | P2 | planned | | |
| `CHOOSE-EXIT-01` | P2 | planned | | |
| `CHOOSE-HIST-01` | P2 | planned | | |
| `CHOOSE-CONT-01` | P2 | planned | | |
| `CHOOSE-FAIL-01` | P1 | planned | | |
| `CHOOSE-RM-01` | P1 | planned | | |
| `CHOOSE-A11Y-01` | P1 | planned | | |

(P1 exercises the chooser against a stub OS; IDs marked P2 need the first real OS shell.)

## Definition of done — onboarding
- [ ] W1, W2, W3 journeys green on `chromium-desktop`, `iphone`, `pixel`, `reduced-motion`, `no-js`, `asset-original`.
- [ ] LCP node on `/` is the `<h1>`; LCP ≤ 2.5 s, CLS ≤ 0.1, Lighthouse Accessibility ≥ 95.
- [ ] No three.js, GSAP or audio request before the `load` event / first paint respectively.
- [ ] **All five profiles produce the identical transition and land on the chooser** (e2e + unit).
- [ ] Intro skippable from its first frame; mute persists; silent when audio is blocked or missing.
- [ ] Neither "Netflix" nor any third-party mark appears in UI text, metadata or OG cards.
- [ ] Résumé and "Skip the OS" links reachable by keyboard on all three pages.
- [ ] Smell tests 5 (keyboard) and 6 (impatience) pass on all three pages.

## Deviations log
| Date | ID | What changed vs the spec | Why | Owner sign-off |
|---|---|---|---|---|
| 2026-09-21 | `HELLO-PATHS-01`, `HELLO-DRAW-01`, `HELLO-GLASS-01`, `HELLO-GL-01` | Hello matches `assets-inbox/preview/storyboard.html`: the opening greeting is the storyboard's authored cursive "hello" (one pen stroke, resampled + normalized by `build-hello-paths.mjs`; the other four stay font-generated); glass-ribbon ink (gradient + SVG light filter, dropped on T0); draw 3200 ms `cubic-bezier(.6,.12,.36,.96)` after 500 ms (was 1600 ms); light pastel field in CSS and in `hello.frag`; name + pill sit inside the lens; top bar is plain links (no glass, not a WebGL panel) | Owner rejected the dark print-letter Hello as not matching the approved storyboard | Owner, 2026-09-21 ("I was expecting the same output" as the storyboard) |
| 2026-09-21 | `HELLO-PATHS-01` | The four font greetings are centrelines extracted from OFL handwriting fonts (Kalam for Latin + Devanagari, Klee One for Japanese): the shaped text is rasterized with HarfBuzz (via `sharp`), thinned (Zhang–Suen), traced into pen strokes and smoothed | No open-licensed single-line font covers Devanagari and Japanese; centrelines keep one pen stroke per line and correct shaping (the स्ते conjunct) | Owner authorization 2026-09-21 (plans/README); for review at the P1 gate |
| 2026-09-21 | `HELLO-MORPH-01` | Shapes are normalized and paired (morph or crossfade) at build time; MorphSVG matches points at idle in the browser rather than shipping precompiled point data | The pairing rule is the part the plan fixes and is tested; point matching costs a few ms once per pair, off the input path | Owner authorization 2026-09-21; for review at the P1 gate |
| 2026-09-21 | `HELLO-GL-01` · `PERF-GL-01` | "dispose leaves memory zero" is asserted in Playwright on a real (software) WebGL2 context behind a test-only session flag (`pf.debug.tier=2`), not in a unit test; `glass-stage.ts` is excluded from unit coverage | jsdom has no WebGL, so a unit test could only check that dispose methods are called, not that GPU memory returns to zero | Owner authorization 2026-09-21; for review at the P1 gate |
| 2026-09-21 | `NFLX-MARK-01` | The word appears in exactly one place: the Legal credits name the rights holder of the avatar and intro-sound artwork in official mode | Attribution of third-party artwork is required (shared/11 credits, `TAKEDOWN.md`); no UI copy, title, metadata, wordmark or card uses it (tested) | Owner authorization 2026-09-21; for review at the P1 gate |
| 2026-09-21 | `NFLX-PROF-02` · `NFLX-HAND-01` | `SELECT_PERSONA` moves the kernel straight to `chooser` (one atomic step, so a double click can never pick twice); the chooser layer holds its reveal until the avatar hand-off lands, so the visitor still sees select → 420 ms flight → chooser | Keeps the plan's visual order while making the kernel, not the animation, the guard | Owner authorization 2026-09-21; for review at the P1 gate |
| 2026-09-21 | `CHOOSE-CARD-01` | Snapshots are captured by `scripts/capture-snapshots.mjs` from the preview build; until an OS home is built they show that OS's preview stub on its own wallpaper, and each OS's release re-captures its card | The pipeline is the deliverable; the images improve with each OS without code changes | Owner authorization 2026-09-21; for review at the P1 gate |
