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
| `HELLO-MUTE-01` | P1 | built | e2e: welcome.spec W3 muted preference survives a reload; green locally 2026-09-21 on chromium-desktop · iphone · pixel · reduced-motion (preview build) | Deviations log 2026-09-21 (visual target) |
| `HELLO-RM-01` | P1 | planned | | |
| `HELLO-RETURN-01` | P1 | planned | | |
| `HELLO-A11Y-01` | P1 | built | e2e: welcome.spec "the SSR h1 names Jaswanth…", X1 axe + keyboard only; green locally 2026-09-21 on chromium-desktop · iphone · pixel · reduced-motion (preview build) | Deviations log 2026-09-21 (visual target) |
| `HELLO-RESP-01` | P1 | built | e2e: welcome.spec X4 no horizontal scroll at 320 px, landscape never scrolls; green locally 2026-09-21 on chromium-desktop · iphone · pixel · reduced-motion (preview build) | Deviations log 2026-09-21 (visual target) |

### 03 Netflix page
| ID | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|
| `NFLX-INTRO-01` | P1 | planned | | |
| `NFLX-SKIP-01` | P1 | planned | | |
| `NFLX-AUDIO-01` | P1 | planned | | |
| `NFLX-AUDIO-02` | P1 | planned | | |
| `NFLX-MARK-01` | P1 | built | unit: welcome.test (wordmark = the frame's .mark box); e2e: welcome-visual "the intro lands on the frame"; green locally 2026-09-21 on chromium-desktop · iphone · pixel · reduced-motion (preview build) | Deviations log 2026-09-21 (visual target) |
| `NFLX-PROF-01` | P1 | planned | | |
| `NFLX-PROF-02` | P1 | planned | | |
| `NFLX-CARD-01` | P1 | built | e2e: welcome.spec NFLX-CARD-01 + welcome-visual "Who's watching? lands on the frame"; green locally 2026-09-21 on chromium-desktop · iphone · pixel · reduced-motion (preview build) | Deviations log 2026-09-21 (visual target) |
| `NFLX-RETURN-01` | P1 | built | e2e: welcome.spec W1 second visit (last one marked, replay + Sound shown); green locally 2026-09-21 on chromium-desktop · iphone · pixel · reduced-motion (preview build) | Deviations log 2026-09-21 (visual target) |
| `NFLX-RM-01` | P1 | planned | | |
| `NFLX-A11Y-01` | P1 | built | e2e: welcome.spec X1 axe + keyboard only, welcome-visual (no first-visit chrome); green locally 2026-09-21 on chromium-desktop · iphone · pixel · reduced-motion (preview build) | Deviations log 2026-09-21 (visual target) |
| `NFLX-HAND-01` | P1 | planned | | |

### 04 OS chooser
| ID | Phase | Status | Evidence | Deviation |
|---|---|---|---|---|
| `CHOOSE-CARD-01` | P1 | built | e2e: chooser-visual W1 the foyer lands on the frame, chooser.spec; green locally 2026-09-21 on chromium-desktop · iphone · pixel · reduced-motion (preview build) | Deviations log 2026-09-21 (visual target) |
| `CHOOSE-BADGE-01` | P1 | built | component/welcome/chooser.test.tsx + e2e/chooser.spec.ts assert neutral cards with no recommendation badge 2026-09-23 | Owner refinement 2026-09-23 |
| `CHOOSE-REL-01` | P1 | planned | | |
| `CHOOSE-PREF-01` | P1 | planned | | |
| `CHOOSE-ENTER-01` | P1 | planned | | |
| `CHOOSE-ENTER-02` | P2 | verified | `component/welcome/chooser-stage.test.tsx` › CHOOSE-ENTER-02 the boot frame · `e2e/macos-chooser.spec.ts` › CHOOSE-ENTER-02 a cached chunk shows no boot frame · `e2e/macos-chooser.spec.ts` › CHOOSE-ENTER-02 a slow chunk shows the boot frame; any key skips its extra beats; once per session · green locally 2026-09-22 (preview build) |  |
| `CHOOSE-EXIT-01` | P2 | verified | `component/welcome/chooser-stage.test.tsx` › CHOOSE-EXIT-01 the return flight after a leaving OS’s exit beat · `e2e/macos-chooser.spec.ts` › CHOOSE-HIST-01 · CHOOSE-EXIT-01 Back from macOS: exit beat, the snapshot flies home into its card, session parked · green locally 2026-09-22 (preview build) |  |
| `CHOOSE-HIST-01` | P2 | verified | `e2e/macos-chooser.spec.ts` › CHOOSE-HIST-01 · CHOOSE-EXIT-01 Back from macOS: exit beat, the snapshot flies home into its card, session parked · green locally 2026-09-22 (preview build) |  |
| `CHOOSE-CONT-01` | P2 | verified | `e2e/macos-chooser.spec.ts` › CHOOSE-CONT-01 a returning visitor gets "Continue in macOS" above the grid; a first visit does not · green locally 2026-09-22 (preview build) |  |
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
| 2026-09-21 | `CHOOSE-CARD-01` | Each snapshot ships as AVIF **and** a WebP fallback (both ≤ 25 KB, same capture), rendered through `<picture>` | Engines without AVIF decode (older Safari; Playwright WebKit on Windows) showed blank cards; the flight copies `currentSrc`, so it keeps whichever format loaded | Owner authorization 2026-09-21; for review at the P1 gate |
| 2026-09-21 | `CHOOSE-CARD-01` · `CHOOSE-BADGE-01` · `CHOOSE-A11Y-01` | The foyer is the storyboard frame (plans/04 "Visual target"): light field, Bricolage Grotesque heading, five white glass cards with centred IBM Plex Sans labels, the badge as a pill on the card's top edge (was a dark field, left-aligned labels, badge under the name). Until an OS home is built its card shows the frame's miniature of that home (`scripts/snapshot-miniatures.mjs`, chosen automatically while the route renders `[data-stub-os]`), not the preview stub; the real home replaces it on re-capture. The footer ("Résumé" · "Skip the OS") is the one addition to the frame | Owner: "I want exactly same as this pictures … 100% should be matching"; at 1440 × 900 cards, snapshots and badge land on the frame's boxes to 0.1 px and 0.2 % of pixels differ (anti-aliased edges only); the footer stays because the résumé must be one click from every surface (`RES-PRE-01`) | Owner, 2026-09-21 (this request) |
| 2026-09-23 | `CHOOSE-CARD-01` · `CHOOSE-BADGE-01` · `CHOOSE-A11Y-01` | Cards, labels and heading are smaller; every wallpaper preview is square; the "Suits your device" badge and its accessible-name suffix are removed | The owner requested a quieter, more compact and neutral chooser after reviewing the five-OS implementation | Owner, 2026-09-23 (this request) |
| 2026-09-21 | `NFLX-HAND-01` | The chooser has no header avatar (the frame has none), so the hand-off's second half — a clone flying into the header — is gone. What still holds: the profiles-side hand-off runs (chosen avatar to screen centre, 420 ms, others fade), the chooser holds its reveal until that hand-off lands, then fades in over it, so the avatar dissolves under the foyer with no blank frame | Match the approved frame | Owner, 2026-09-21 (this request); evidence `e2e: W1 no blank frame between the profiles and the chooser` |
| 2026-09-21 | `NFLX-INTRO-01` | The intro ends on a wall-clock deadline counted from the tap — 3400 ms for the full intro (800 / 1200 ms reduced / muted) — which finishes the timeline; the 2600 ms zoom is therefore cut at 2500 ms | "≤ 3500 ms → profiles" must hold on slow devices too: a late motion chunk or GSAP lag smoothing stretched the timeline past 3.5 s (e2e measured 3.7–5.4 s on WebKit), and the React commit needs headroom; the zoom's last 100 ms are below 0.2 % opacity (expo-out), so nothing visible is cut | Owner authorization 2026-09-21; for review at the P1 gate |
| 2026-09-21 | `HELLO-A11Y-01` · `HELLO-MUTE-01` · `HELLO-RESP-01` | Hello's top bar, field, face and name are the storyboard frame's (plans/02 "Visual target"): plain-text "Skip the OS" and "Résumé · Sound on" at every size (no icons); the `<h1>` is "{givenName} — {role}" (was "{name} — {headline}"); Sound keeps its name and `aria-pressed`, with a visible, `aria-hidden` "on" / "off"; IBM Plex Sans; a static field (no drift, no 3 % grain) | Owner: "I want exactly same as this html page … 100% should be matching"; at 1280–1920 px (16:10) the screen differs from the frame on ≤ 0.05 % of pixels | Owner, 2026-09-21 (this request) |
| 2026-09-21 | `HELLO-GL-01` | `hello.frag` draws the frame's field exactly (the three CSS radial gradients, no drifting lights, no pointer light, no grain) and frosts the lens interior exactly as the lens's CSS glass does; refraction and the fresnel rim stay on the lens edge only; the stage draws a frame only when something changed | Tier 2 must not change the look — only the glass edge; a static picture needs no 30 fps loop. Forced-tier capture: identical to the frame except the rim band | Owner, 2026-09-21 (this request) |
| 2026-09-21 | `NFLX-MARK-01` | The wordmark is the frame's flat `.mark` (Bebas Neue at 13 em, letter-spacing .015 em, line-height .9, padding .1 em / .12 em) with the frame's ellipse trimming the letters' feet into a shallow arc, instead of letters warped taller toward the ends; the SVG view box is the whole `.mark` box, so it lands on the frame with no offsets | Match the approved frame (intro differs on ≤ 0.8 % of pixels, all anti-aliased edges; the ink sits within 0.3 px) | Owner, 2026-09-21 (this request) |
| 2026-09-21 | `NFLX-CARD-01` | Desktop sizes are the frame's (`--u`): heading 3.3 em, 8.2 em avatars with a .22 em border, gap 2 em, names 1.1 em (were clamp values); hover / focus is the frame's chosen state — white border, the avatar alone lifted .4 em, no scale, no glow (was 3 px border + glow, card −6 px and ×1.02) | Match the approved frame | Owner, 2026-09-21 (this request) |
| 2026-09-21 | `NFLX-A11Y-01` · `NFLX-RETURN-01` | The intro and a first visit's profiles carry no top chrome, as in the frame: "Skip intro" stops the sound; the Sound toggle and the replay wordmark show only on a returning visitor's profiles screen (they skip Hello, where Sound otherwise lives) | The frame shows neither; the sound is ≤ 3.5 s, user-started and stopped by Skip (WCAG 1.4.2), so a returning-only control keeps both the frame and the mute requirement | Owner, 2026-09-21 (this request) |
| 2026-09-21 | `HELLO-GLASS-01` · `HELLO-DRAW-01` · `HELLO-MORPH-01` · `HELLO-GL-01` | Hello's lens, glyph and pill leave the storyboard frame for Apple-grade liquid glass (values in plans/02 "Visual target"): the glyph is a clear glass rod of layered strokes of one path (the `#hiGlass` lighting filter is gone; only the shadow is blurred) and 25 em wide (was 17 em); the lens is clear glass with a light lensing blur, bright rim and corner speculars; the pill is glass with the same beam; the T2 shader frosts to match. The stroke draw runs on the rod's `<g data-ink>` (every layer inherits it), and a crossfade now goes out, then in (it overlapped, showing "Hello" and "Hola" at once). With the filter region gone, no greeting is clipped ("Bonjour" lost its "r") | The owner judged the frame's Hello "not liquid glass, not Apple's professionalism" (pastel jelly ink on a pastel card, blurred highlights, no contrast, small word) and approved a side-by-side of the new look | Owner, 2026-09-21 ("yes do it", after the now-vs-proposed comparison); supersedes the 2026-09-21 "100 % match the storyboard" request for these three elements only |
| 2026-09-21 | `HELLO-GLASS-01` · `HELLO-GL-01` | The lens really refracts: in Chromium on a desktop screen its backdrop layer bends the page through an SVG displacement map inside `backdrop-filter` (technique after GlassiFy, github.com/Saviru/GlassiFy, MIT — no code or map copied; ours is generated for the lens's size and radius by `components/welcome/refraction.ts`). The plan had allowed this only on the pill; it now runs on the lens (still one backdrop surface), none on the pill. Guarded by design: Chromium + fine pointer + ≥ 1024 px + full glass + not T0 + not forced colours, else the blur; a failed first 1.5 s flight (`flightFailed`) drops to the blur for the page (`data-refract="slow"`); `pf.debug.refract=on` skips that check in CI (software GL always fails it). The lens is now three layers (backdrop < surface < speculars) so the bend never picks up the glass's own tint or shadow. T2's shader matches the profile and now bends outward, `field(uv + n·k)` as its spec says (the code had `−`) | The owner pointed at GlassiFy and said the glass "doesn't look like Apple-level liquid glass": the previous lens only painted highlights and bent nothing | Owner, 2026-09-21 ("Use this repo for reference"; the look shown in the before/after edge comparison) |
