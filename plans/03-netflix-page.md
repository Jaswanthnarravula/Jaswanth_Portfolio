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
- **Wordmark:** "JASWANTH" in the Netflix arc style, red `#E50914`, inline SVG paths (original in both asset
  modes; Netflix's logo / "N" / the word "Netflix" never appear in UI or metadata).
- "Skip intro" text button, bottom-right, visible from the first frame.

### B. Who's watching?
- Heading "Who's watching?" (`<h1>`), white, `clamp(30px, 3.5vw, 56px)`, weight 400.
- Five profile cards in a row: avatar square (radius 8 px) + name below.
  Desktop: card width `clamp(84px, 10vw, 200px)`, gap 20 px, names `clamp(14px, 1.3vw, 20px)`, colour `#808080` →
  white on hover/focus. **≤ 768 px:** 2-column grid, 100 px avatars, gap 30 × 20 px, fifth card centred on its own row.
- Avatars: `official` mode = Netflix smiley avatars (blue, grey, yellow, red, green); `original` mode = original
  geometric face tiles in the same colours. Identical boxes in both modes.
- Footer text button "Résumé" (`RES-PRE-01`) + "Skip the OS".

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
- Hover / focus: avatar gets a 3 px white border + soft glow; card lifts −6 px and scales 1.02 (spring r 0.3 ζ 1);
  press scales 0.98.
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
with visually hidden text "Jaswanth". "Skip intro" is the first focusable element during the intro. When the
intro ends, focus moves to the heading. Audio is ≤ 3.5 s and user-initiated (WCAG 1.4.2 satisfied); a mute
control is always visible.

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
| `NFLX-MARK-01` | Name wordmark; no Netflix logo/word anywhere | `unit: UI strings + metadata contain no "Netflix"` |
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
