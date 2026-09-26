# 04 — OS chooser and the enter / exit transition

## Role + requirement refs
Presents the five operating systems with recognizable identities, and makes selecting one feel like **entering
that environment** rather than navigating to a page. Requirements: R12, R13, R36. Kernel onboarding state:
`chooser`; transition machine: `shared/04-os-kernel.md` (`KRN-SWITCH-*`).

## Portfolio mapping
None directly. Each card previews that OS's **full-page home** with the visitor's real app set. Every preview uses a
square crop. There is **no device outline** around the preview (north-star B17), and the preview remains the shared
element for entry.

## Anatomy
```
        Choose how you want to explore
  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
  │ iOS home  │ │ macOS     │ │ Windows 11│ │ Android   │ │ Linux     │   five link cards, each a
  │ (page)    │ │ desktop   │ │ desktop   │ │ launcher  │ │ terminal  │   viewport-shaped snapshot,
  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘   no device outlines
   name · one-line character
  [Continue in macOS →]   (returning visitors only)        Résumé · Plain view
```
- Cards are real links: `nav > ul > li > a[href="/{os}"]` (work without JS).
- One-line character per OS: iOS "Tap through apps" · macOS "A desktop of windows" · Windows 11 "Start, taskbar,
  snap" · Android "Launcher and Material" · Linux "A real terminal".
- Cards are neutral: no device recommendation or "Suits your device" badge.
- Only **released** OSes are rendered (`ARCH-REL-01`); the grid reflows for fewer than five.

## Visual target (compact square-card owner refinement)
Rules: `shared/06-design-system.md` → Owner visual targets. Same unit as the welcome screens (1 em = 1.42 % of a
16:10 screen); desktop values are measured from the approved 1656 × 950 reference.

| Element | Exactly as the frame |
|---|---|
| Field | Inset rounded panel over `#e8ecf4`; `radial-gradient(60% 70% at 10% 10%, #c0cbfe 0, transparent 68%), radial-gradient(60% 70% at 95% 90%, #fad2e9 0, transparent 68%), #f0f4fd` |
| Column | Heading and cards centred as one column, `1.3em` apart, `2.3%` side padding; card grid capped at `1200px` |
| Heading | Bricolage Grotesque 700, `2em`, `#1b2347` |
| Cards | Five equal columns, gap `.8em`; each `rgb(255 255 255 / .55)` with a 1 px `rgb(255 255 255 / .9)` rim, radius `.9em`, padding `.65em .6em .7em`, IBM Plex Sans; name `1.05em` weight 600, character `.78em` `#4a5576` |
| Snapshot | Square `1 / 1` crop at every posture, radius `.6em`, shadow `0 .3em .8em rgb(20 30 70 / .25)` |
| Footer | Visible at every size with "Start at Hello" · "Résumé" · "Plain view" under the foyer |

## Behaviour & states
| State | Behaviour |
|---|---|
| Entrance | The foyer fades in over the profiles screen once the avatar hand-off lands (the avatar dissolves beneath it — the frame has no avatar); cards stagger in (60 ms apart, 320 ms, rise 16 px) |
| Hover / focus | Card tilts ≤ 4° toward the pointer (fine pointer only), preview brightens; **prefetch that OS chunk** |
| Idle | Prefetch `prefs.lastOs` when present; first-time visitors prefetch on hover/focus |
| Press | Card scales 0.98; release starts the enter transition |
| Returning visitor | "Continue in {lastOs}" primary button above the grid |
| Chunk failure | Card shows "Couldn't load — Retry" inline; link to `/plain` |

## The enter transition (`CHOOSE-ENTER-*`)
A persistent **`TransitionStage`** in the root layout runs it, so nothing remounts:
1. Click → `SWITCH_OS{to}` (epoch bump) → siblings dismiss (200 ms, 30 ms stagger).
2. The chosen card's **snapshot is the shared element**: `flight()` expands it to full screen (spring r 0.55 ζ 0.9).
   Esc or Back during the flight **reverses** it.
3. History: push `/{os}` (deferred one frame per the Next caveat).
4. While the chunk loads the overlay shows that OS's **boot screen** (`{os}/surfaces/boot.md`): appears only if
   loading exceeds 150 ms, lasts ≤ 1.5 s, any input skips; adds ≤ 300 ms when the chunk is already cached.
5. First entry this session → lock screen (`{os}/surfaces/lock-screen.md`), dismissible by any input.
6. 180 ms crossfade from the snapshot to the live shell; focus → the shell's hidden `h1`.
Reduced motion: steps 1–2 become a 150 ms crossfade; no boot animation.

## The exit transition (switching OS or returning to the chooser)
`SWITCH_OS` from inside an OS (menu-bar / Start / Control Center / Settings / `exit` — each OS owns its entry
point): a short shutdown beat in the OS's idiom (≤ 300 ms) → the same snapshot shown full screen → shrinks into its
re-measured card (420 ms) → chooser. Switching directly OS→OS skips the chooser visually: exit beat → target
snapshot expands. The session is parked, not destroyed (`KRN-SES-01`).

## Navigation & routes
Chooser is part of `/` (no history entry of its own). Picking an OS **pushes** `/{os}`. Browser Back from an OS
home returns to `/` showing the chooser (never Hello/intro again). Deep links and `/go/*` never pass through the
chooser, boot or lock screens.

## Motion
`flight()` + spring for the shared element; GSAP for stagger and shutdown beats; epoch director guarantees a
second click / Back mid-flight retargets or reverses cleanly (`MOTION-DIR-01`).

## Responsive
Phone portrait: 2-column cards with the fifth centred at the same width, each with a square snapshot. Phone landscape:
five compact tiles in one row. Tablet: 3 + 2 grid with descriptions. Laptop/desktop: five smaller cards across;
preview on hover **and** focus. No tilt on coarse pointers.

## Accessibility
`<h1>` "Choose how you want to explore". Link name = "{OS} — {character}". Snapshots are decorative (`alt=""`).
The transition overlay is `aria-hidden`; a polite status
announces "Entering macOS" once. Boot/lock screens are skippable by keyboard.

## Edge cases
Rapid clicks on two cards → the last click wins (epoch). Click during entrance stagger works. Offline → Retry +
`/plain`. Resize/rotate mid-flight → retarget to the new full-screen rect. Back during `loading` → reverses to the
chooser and cancels the push via back-collapse. Single released OS → the chooser still renders (one card + Continue).

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test |
|---|---|---|
| `CHOOSE-CARD-01` | Five compact OS link cards plus an always-visible Plain view option | `e2e: W1 cards are links to /{os}; /plain is visible; snapshot aspect = 1; no frame element; W2 works without JS` |
| `CHOOSE-BADGE-01` | No device recommendation badge; every OS card stays neutral | `component/e2e: "Suits your device" is absent and accessible names contain only OS + character` |
| `CHOOSE-REL-01` | Only released OSes shown | `unit: chooser renders the released set` |
| `CHOOSE-PREF-01` | Prefetch on hover/focus and idle | `perf: chunk requested on card focus, not before` |
| `CHOOSE-ENTER-01` | Shared-element enter transition, reversible | `e2e: Esc mid-flight returns to the chooser with focus on the card` |
| `CHOOSE-ENTER-02` | Boot only when loading > 150 ms, ≤ 1.5 s, skippable | `e2e: cached chunk shows no boot frame; any key skips` |
| `CHOOSE-EXIT-01` | Exit beat + shrink back into the card | `e2e: switch OS returns through the snapshot; session parked` |
| `CHOOSE-HIST-01` | Push on pick; Back returns to the chooser | `e2e: H1 back from OS home shows chooser, not Hello` |
| `CHOOSE-CONT-01` | "Continue in {lastOs}" for returning visitors | `e2e: W1 second visit shows the button and it works` |
| `CHOOSE-FAIL-01` | Chunk failure inline Retry + /plain | `e2e: offline click shows Retry; recovers online` |
| `CHOOSE-RM-01` | Reduced-motion crossfade | `e2e: R1 no flight; end state identical` |
| `CHOOSE-A11Y-01` | Semantics, names, status announcement | `e2e: X1 axe clean; keyboard-only entry into each OS` |

## Not like the others
The chooser is a neutral foyer in Jaswanth's own glass brand. It must not look like any one OS's launcher, and
it is the only place where all five identities appear side by side.
