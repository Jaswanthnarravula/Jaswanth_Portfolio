# 03 — Netflix page (intro + "Who's watching?")

## Role + requirement refs
The layer between Hello and the OS chooser: a Netflix-style intro with sound, then a "Who's watching?" profile
picker. **Every profile does exactly the same thing: it goes to the OS chooser.** Requirements: R11, N1, N2.
Kernel onboarding states: `intro` → `profiles`.

Behavioural and visual reference: `github.com/Sandhit06/Netflix-Portfolio` (`src/NetflixTitle.tsx`,
`src/browse/browse.tsx`, `src/components/ProfileCard.tsx`). It has **no licence** and uses CRA + framer-motion +
react-router, so it is **re-implemented natively (GSAP + kernel), never copied**.

## Portfolio mapping
None. Profiles are pure data (`PersonaId`), stored as a preference and counted in analytics. They never change
content, routes, badges, notifications, hints or anything else (`KRN-PERSONA-01`, north-star B16).

## Anatomy

### A. Intro
- Stage `#141414` (Hello's canvas dims to it via `uDim`; no hard cut).
- **Wordmark:** "PORTFOLIO" in the storyboard frame's red arc style: flat Bebas Neue capitals whose feet are trimmed
  into a shallow arc by the frame's ellipse (Visual target), red `#E50914`, inline SVG paths (original in both asset
  modes; Netflix's logo / "N" / the word "Netflix" never appear in UI or metadata).
- "Skip intro" text button, bottom-right, visible from the first frame. It also stops the sound (no other chrome on
  the intro, as in the frame).

### B. Who's watching?
- Heading "Who's watching?" (`<h1>`), white, weight 400 (desktop size: Visual target).
- Five profile cards in a row: avatar square + name below; name colour `#808080` → white on hover/focus.
  Desktop: the Visual target. **≤ 768 px:** 2-column grid, 100 px avatars, gap 30 × 20 px, fifth card centred on its
  own row.
- Avatars: `official` mode = Netflix smiley avatars (blue, grey, yellow, red, green — the green one is the blue one
  through the frame's `hue-rotate(-62deg) saturate(1.15)`, baked in at ingest); `original` mode = original geometric
  face tiles in the same colours. Identical boxes in both modes.
- Footer text links "Résumé" (`RES-PRE-01`) + "Skip the OS".
- Returning visitors only (they skip Hello, so the frame's first-visit screen does not show these): the small
  wordmark top-left (replay) and the Sound toggle top-right.

## Visual target (owner storyboard — `plans/visual-targets/frames/intro.png`, `frames/profiles.png`)
Rules: `shared/06-design-system.md` → Owner visual targets. Both frames use the Hello's unit (1 em = 1.42 % of a
16:10 screen, `--u`), IBM Plex Sans, on flat `#141414`; values are the frame's (`.nflx`, `.mark`, `.skip`, `.who-t`,
`.prof`, `.av`, `.nfoot`).

| Element | Exactly as the frame |
|---|---|
| Wordmark | The whole `.mark` box: Bebas Neue at `13em`, letter-spacing `.015em`, line-height `.9`, padding `0 .1em .12em`, `#e50914`, centred on the screen; an ellipse (`left/right -6%`, `bottom -.34em`, `height .62em`) trims the letters' feet. Generated as SVG by `scripts/build-wordmark.mjs` (view box = that box, the ellipse as a mask) |
| Skip intro | `right 2.4em; bottom 2em`, `padding .45em 1em`, 1 px `#555` border, radius `.3em`, text `#cfcfcf`, no fill |
| Heading | `3.3em`, weight 400, white, `1.1em` (of its size) above the row |
| Row | Flex, gap `2em`; card font `1.1em`, column gap `.8em`, name `#808080` |
| Avatar | `8.2em` square with a `.22em` transparent border, radius `.5em` |
| Chosen (hover / focus) | Name white; avatar border white and the avatar alone lifted `.4em` — no scale, no glow |
| Footer | Centred, `bottom 1.8em` at `.95em`, gap `2em`, `#9a9a9a`: "Résumé" · "Skip the OS" |
| First visit | No top chrome at all (no replay mark, no Sound toggle) |

| Profile | `PersonaId` | Avatar colour |
|---|---|---|
| Recruiter | `recruiter` | blue |
| Developer | `developer` | grey |
| Adventurer | `adventurer` | yellow |
| Designer | `designer` | red |
| Guest | `guest` | green |

## Behaviour & states

### Intro timeline (first visit; reference timings kept, made skippable)
| t | Event |
|---|---|
| 0 ms | (triggered by Hello's tap — a user gesture) audio engine resumes; sound starts if enabled |
| 0–400 ms | Wordmark fades in, scale 0.8 → 1 (spring-like ease) |
| 900 ms | Wordmark begins scale 1 → 3 + fade to 0 over 2600 ms, ease `0.16, 1, 0.3, 1` |
| ≤ 3500 ms | → `profiles` |
**Any click, tap or key — or "Skip intro" — jumps straight to `profiles`** and fades audio out over 150 ms.
With sound muted the intro shortens to 1200 ms. Reduced motion: wordmark fades in and out (no zoom), 800 ms.
Returning visitors (`prefs.introSeen`) never see the intro again unless they click the small wordmark on the
profiles screen (replay).

### Sound
`official` mode: the ta-dum mp3 (~66 KB), fetched on idle after Hello's first paint, decoded on the tap.
`original` mode / file missing: an original short chime synthesized with Web Audio (not a sound-alike).
Blocked, missing or failed audio never delays or breaks the intro. The mute toggle from Hello persists here.

### Profiles
- Entrance: heading fades up 16 px / 500 ms; cards stagger in (delay 200 ms, 120 ms apart, fade + 24 px rise).
- Hover / focus: the frame's chosen state — name white, avatar border white, the avatar lifted `.4em` (320 ms ease,
  no scale, no glow); press scales the avatar 0.98.
- **Select (identical for all five):** `SELECT_PERSONA{id}` (stores `prefs.persona`, sets `introSeen`) → the
  chosen avatar scales up toward screen centre while the others fade (420 ms) → `ONBOARDING_ADVANCE` → `chooser`
  (`04-os-chooser.md`). **One handler, one transition, one destination.**
- Returning visitor: last profile shows a subtle "Last time" caption and `aria-pressed="true"`; still must be
  clicked (no auto-advance).

## Navigation & routes
Still `/`; **no history writes**. Browser Back from an OS lands on the chooser (not here). Refresh during
`intro`/`profiles` restarts at `profiles` if `introSeen`, otherwise at Hello.

## Motion
GSAP timeline in the `welcome-motion` chunk; transform + opacity only; timeline `progress(1)` on skip. The
avatar hand-off to the chooser uses `flight()` so the two screens read as one sequence.

## Responsive
Phone portrait: 2-column grid as above, heading 30 px, everything within `100svh` without scroll. Phone landscape:
single row of five 84 px cards. Tablet/laptop/desktop: single centred row. Tap targets ≥ 48 px including the name.

## Accessibility
Profiles are a `group[aria-labelledby=heading]` of five real `<button>`s (names = profile names); arrows and Tab
both move between them; Enter/Space selects. No radio auto-advance (WCAG 3.2.2). The wordmark is `aria-hidden`
with visually hidden text "PORTFOLIO". "Skip intro" is the first focusable element during the intro. When the
intro ends, focus moves to the heading. Audio is ≤ 3.5 s and user-initiated (WCAG 1.4.2 satisfied); the Sound
toggle is on Hello (where the sound is armed) and on the returning visitor's profiles screen (where replay arms it),
and "Skip intro" — the intro's first focusable element — stops the sound.

## Edge cases
Autoplay blocked / `AudioContext` unavailable → silent intro. Tab hidden during intro → completes instantly on
return. Rapid double click on a card → first wins (guard on onboarding state). Click during entrance stagger →
works immediately (input wins). 320 px width → 2-column grid still fits with 84 px avatars. JS disabled → this
layer does not exist; Hello links go straight to OS URLs.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test |
|---|---|---|
| `NFLX-INTRO-01` | Intro timeline (timings above) | `e2e: W1 intro reaches profiles within 3.5 s` |
| `NFLX-SKIP-01` | Any input or "Skip intro" jumps to profiles | `e2e: W1 keypress at t=200 ms shows profiles immediately` |
| `NFLX-AUDIO-01` | Tap-unlocked sound; official mp3 / original chime | `e2e: W3 blocked, missing, muted and both asset modes complete` |
| `NFLX-AUDIO-02` | Audio fetched on idle, never before first paint | `perf: no audio request before first paint` |
| `NFLX-MARK-01` | PORTFOLIO wordmark; no Netflix logo/word anywhere | `unit: generated label is PORTFOLIO; UI strings + metadata contain no "Netflix"` |
| `NFLX-PROF-01` | Five profiles, data-driven | `unit: profiles config has exactly the five PersonaIds` |
| `NFLX-PROF-02` | **All profiles navigate identically to the chooser** | `e2e: W1 each of 5 profiles → identical transition → chooser; unit: KRN-PERSONA-01` |
| `NFLX-CARD-01` | Card layout, hover/focus/press, breakpoints | `e2e: visual + layout assertions at 390 and 1440 px` |
| `NFLX-RETURN-01` | Returning visitor lands on profiles, last one marked, no auto-advance | `e2e: W1 second visit` |
| `NFLX-RM-01` | Reduced-motion variant | `e2e: R1 no zoom; fades ≤ 200 ms segments` |
| `NFLX-A11Y-01` | Group of buttons, focus management, visible mute | `e2e: X1 axe clean; keyboard-only W1` |
| `NFLX-HAND-01` | Avatar hand-off flight into the chooser | `e2e: W1 no blank frame between profiles and chooser` |

## Not like the others
The only surface that borrows a *streaming-service* idiom, and only for ten seconds. It shares nothing with any OS:
no Dock, no windows, no glass (the stage is flat black). Its profiles must never grow behaviours — if a future idea
needs per-visitor tailoring, it belongs somewhere else and needs the owner's sign-off.
