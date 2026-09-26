# shared/24 — Reader motion (`/plain`)

## Purpose
Give the reader page (`/plain`, `ROUTE-PLAIN-01`) a premium, spatial motion layer — depth, text reveals, a live hero
object, sticky case-study storytelling and animated architecture — without breaking any rule the OSes live by
(owner request 2026-09-25: a 46-item motion list, "can we add it"). Requirement: R52.

The page stays a **reader**: every fact is in the HTML, readable with JavaScript off, and no effect ever waits between
the visitor and the text.

## Decisions

| Decision | Rationale | Rejected |
|---|---|---|
| **No WebGL on `/plain`.** Depth comes from CSS 3D (`perspective`, `preserve-3d`), scroll-driven animations and SVG | `shared/10` keeps WebGL to one shader on Hello/chooser, top tier only; a reader page must stay light on every phone | three.js hero scene, shader background, scroll-controlled 3D camera, shader typography, glass refraction, image displacement |
| Scroll effects are **CSS scroll-driven animations** (`animation-timeline: scroll()` / `view()`), inside `@supports` | Run off the main thread, need no JavaScript, follow the scroll exactly (input always wins) | A JS scroll loop / GSAP ScrollTrigger / Lenis smooth scroll |
| Pointer and velocity effects use **one small driver** in `lib/motion/reader-fx.ts`, started by a client island that renders nothing | Raw `requestAnimationFrame` is only allowed in `lib/motion`; values go straight to CSS variables, never React state or JSX `style` | Per-component hooks with state |
| Only `transform`, `opacity` and `clip-path` animate. The one blur is the hero name entrance already approved under `ROUTE-PLAIN-01` | shared/07 compositor rule | Variable-font weight/width animation, letter-spacing "tracking", depth-of-field blur, `stroke-dashoffset` line drawing |
| Numbers are **never counted up**. The real value is shown at once; a before → after meter animates beside it | A counter delays information and lies for a moment | Animated counters |
| Architecture diagrams draw from a new optional `CaseStudy.flow` in `data/portfolio.ts`, written only from facts already in each project's description, highlights and decisions | One fact, one place; nothing invented | Diagrams typed into the page; a generic "API → cache → DB → queue → worker" picture |
| Continuous motion (request pulses) runs **only while its chapter is on screen** (IntersectionObserver) and never without JavaScript | No hidden work off screen; no loops on a static page | Infinite CSS loops |
| Three switches, set before paint (`PERF-TIER-01`): `data-motion="reduced"` / `prefers-reduced-motion` → static depth, nothing moves or dims; `data-tier="0"` → no pointer effects, no grain, no tone layer, no blur; coarse pointer or ≤ 700 px → no pointer effects, no horizontal rail, no sticky visual | Same axes as the rest of the site | One "quality" switch |
| At most **one** live `backdrop-filter` (the sticky header) | shared/10 budget (≤ 3) | Glass cards |
| Scroll entrances **move and clip, they never dim text** below WCAG contrast at any scroll position. The one dim is the About lead's word reveal (≥ 24 px text, floor 0.5 opacity = ≥ 3:1) | Axe / Lighthouse read off-screen text in its start state; a11y ≥ 95 is a budget | Fading headings and paragraphs in from 0.5 |

## Not built here (and why)

| Asked for | Why not on this page | What stands in |
|---|---|---|
| Shader background, 3D-scene hero, scroll camera, shader/extruded 3D type, glass refraction, chromatic shader | WebGL rule above | CSS 3D hero object (`READER-FX-04`), tone layer (`-07`), the grid (`-03`; its node network was removed by the owner 2026-09-26), a static 3-step type extrusion on the Work title, a one-shot RGB split on the name (`-06`) |
| Image distortion, momentum project images, hover image previews, masked video, 3D device mockups | `data/portfolio.ts` has no project images or video (`MediaRef` is unused); inventing media would be fake | The architecture diagram is each project's visual (`-12`); the portrait has momentum (`-04`) |
| Project-to-project transitions, page-transition masks, perspective navigation | `/plain` is one page with no menu and must work without JavaScript; project links leave for `/go/projects/{slug}` | Sticky chapters move project to project inside the page (`-11`) |
| Variable-font animation, tracking animation, depth-of-field | Animate layout/paint properties (shared/07) | Transform-only kinetic type (`-09`) |
| Procedural particles | A continuous canvas loop on a reader page | Nothing (the grid node network that stood in was removed by the owner 2026-09-26) |
| Terminal moments, interactive code snippets | The Linux OS *is* the terminal; the data has no code; typed commands would be career content outside `data/` | — |
| Micro sound | Reader mode is silent; sound lives in `lib/audio` for the OSes | — |

## Specification

**Motion language (`READER-FX-01`).** Easing: `--rx-ease-out: cubic-bezier(0.16, 1, 0.3, 1)` for arrivals,
`--rx-ease-io: cubic-bezier(0.65, 0, 0.35, 1)` for moves, `linear` only on scroll timelines. Hierarchy: major elements
(hero object, chapters) 900–1200 ms or scroll-long; supporting (text, cards) 400–700 ms; micro (links, magnets)
120–180 ms. Reduced motion: nothing moves and nothing dims; the page rests in its final state; the
hero object rests in its 3D pose; shadows and layers keep the depth.

**Features.** Header: sticky, frosted, scroll-progress bar, active section marked `aria-current="location"`
(`-02`). Hero: a coordinate grid and node network behind, rings and portrait in the middle, name in front, each moving
at its own speed on scroll (`-03`); the portrait + three rings form a CSS 3D object that tilts toward the pointer,
turns with the scroll and lags then settles with scroll speed (`-04`); a soft light follows the pointer in the hero and
on dark panels without replacing the cursor (`-05`). Text: name letters stagger in with the approved blur and a
one-shot RGB split; section titles wipe up through a clip-path mask; the About lead reveals word by word with the
scroll; section numbers tilt up in perspective (`-06`). Sections enter with perspective, their top rule draws in, and
a fixed tone layer shifts tint per section and per featured project (`-07`). Grain: a static SVG noise overlay at ≤ 5 %
(`-08`). ~~A decorative outlined type band slides with the scroll and skews with scroll speed (`-09`).~~ **Owner change 2026-09-26:** the type band, the node network and the three rings + orbit dot are removed; the hero keeps the grid, the pointer light, the tilting portrait and its plain circle. Cards (repos,
schools, chapter panels) tilt in perspective with a depth shadow and pointer light; CTAs pull magnetically ≤ 8 px
(`-10`). Featured projects become chapters: a pinned visual (diagram + results) on one side, Challenge → Role →
Decisions → Results beats on the other, the active beat lit in the visual's step rail (`-11`). Diagrams reveal node by
node with the scroll; request pulses travel between nodes while on screen (`-12`). "A → B" results get a meter that
shrinks from before to after (`-13`). GitHub repositories run on a horizontal rail driven by vertical scroll on
desktop; keyboard focus turns it back into a normal scroller (`-14`). The portrait shows a designed placeholder while
it loads (`-15`).

## Edge cases

| Case | Behaviour |
|---|---|
| No JavaScript | Every fact present; scroll-driven CSS still runs; no pointer effects, no pulses |
| Browser without scroll-driven animations | `@supports` fails → static page with its load-time entrances |
| Jump to `#section` | View timelines resolve from position → the target is already fully revealed |
| Keyboard focus inside the rail | Rail animation stops; the rail becomes a native horizontal scroller so focus is visible |
| Short viewport (< 760 px tall) | Chapter visual stops being sticky |
| Forced colours | Grain, tone layer, lights and meters hidden; borders kept |

## Feature IDs

| ID | Feature | Acceptance test |
|---|---|---|
| `READER-FX-01` | Motion language: easing tokens, hierarchy, reduced-motion design, tier gates | `e2e: reader-fx › reduced motion keeps every section visible with no transforms; tier 0 starts no driver` |
| `READER-FX-02` | Sticky header, scroll-progress bar, active section `aria-current` | `e2e: reader-fx › progress bar scales with scroll; the section in view is aria-current` |
| `READER-FX-03` | Hero depth layers: grid, portrait, name at different scroll speeds (node network and rings removed by the owner 2026-09-26) | `e2e: reader-fx › hero layers move at different rates after scrolling` |
| `READER-FX-04` | Interactive CSS 3D hero object: pointer tilt, scroll turn, momentum | `e2e: reader-fx › pointer over the hero tilts the object; decorative layers are aria-hidden` |
| `READER-FX-05` | Cursor-reactive light (hero, dark panels); native cursor kept | `e2e: reader-fx › light follows the pointer; cursor stays auto` |
| `READER-FX-06` | Text reveals: name stagger + RGB split, title mask wipes, word-by-word lead, tilted numbers | `e2e: reader-fx › name and titles keep one accessible name; lead text is complete in the DOM` |
| `READER-FX-07` | Section entrances, drawn rules, per-section / per-project tone layer | `e2e: reader-fx › a section reaches full opacity when in view` |
| `READER-FX-08` | Static grain overlay (off at tier 0, forced colours, phones) | `e2e: reader-fx › grain is pointer-events none and aria-hidden` |
| `READER-FX-09` | ~~Kinetic type band: scroll slide + velocity skew~~ — removed by the owner 2026-09-26 (BLOCKED in the ledger) | `e2e: reader-fx › type band is aria-hidden and moves with scroll` |
| `READER-FX-10` | Card tilt + depth shadow + pointer light; magnetic CTAs | `e2e: reader-fx › hovering a card tilts it; a CTA shifts ≤ 8 px and returns` |
| `READER-FX-11` | Sticky case-study chapters with a lit step rail | `e2e: reader-fx › each featured project shows challenge, role, decisions and results; visual is sticky on desktop` |
| `READER-FX-12` | Architecture diagrams from `CaseStudy.flow`, node reveals, on-screen-only pulses | `unit: reader-fx › every flow step is non-empty; e2e: pulses run only while the chapter is on screen` |
| `READER-FX-13` | Before → after meters; values never counted | `unit: reader-fx › parses "4:20 → 1:45" and "420 → 290 ms"; leaves "No logouts" alone` |
| `READER-FX-14` | Horizontal GitHub rail driven by vertical scroll; focus fallback | `e2e: reader-fx › focusing a repo link keeps it on screen` |
| `READER-FX-15` | Designed portrait loading placeholder | `e2e: reader-fx › placeholder is aria-hidden and sits under the image` |

## Open questions
None. Defaults above close every item; owner review follows the build.
