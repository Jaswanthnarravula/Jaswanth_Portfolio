# shared/20 — Guided tour

## Purpose
A first-time visitor who feels lost can ask to be shown around: about twenty seconds, three real app openings,
then control is handed back. It is offered, never imposed. Requirement: N14.

## Decisions

| Decision | Rationale | Rejected |
|---|---|---|
| **Offered once** as a small non-modal chip; **never starts by itself** | Agency (north-star B14); no onboarding gate | Auto-playing tutorial |
| The tour drives the **real kernel actions** | It demonstrates true behaviour and can't drift from the product | Scripted fake UI / video |
| **Any input cancels instantly** and leaves whatever is open in a valid, focused state | Input always wins (`MOTION-RULE-01`) | Locked walkthrough |
| The Linux tour **never presses Enter** — it suggests each command and waits | Consistent with the hint rules (R31, R32) | Auto-typing and executing |
| Identical for every profile | Owner decision: no per-profile behaviour | Profile-tailored tours |

## Specification

### Offer rules
Shown on the first OS home a visitor reaches via the chooser, ≥ 1.2 s after the home settles, if
`prefs.tourOffered === false`. Placement follows the OS idiom (each OS's `07-cross-os-features.md`): macOS
notification banner · Windows toast · iOS banner · Android heads-up · Linux hint chip. Copy: "New here? Take a
20-second tour." Actions: **Start** · **Not now** (both set `tourOffered = true`). Always restartable from Settings,
search ("Start tour"), the `?` help dialog, and `tour` in Linux. Never offered on deep links, in compact mode
while an app is open, or while another transient surface is showing.

### Tour director (`lib/tour`, lazy chunk ≤ 8 KB)
```ts
interface TourStep { id: string; say: string; action?: KernelAction; pointAt?: string /* element id */; waitFor: 'settled' | 'user-enter' | number }
interface TourScript { os: OsId; steps: readonly TourStep[] }
```
A step = caption (coach-mark card anchored to `pointAt`) + optional kernel action + wait. Standard graphical
script: **(1)** "Everything here is an app" → open the overview app · **(2)** "Projects live in GitHub" → open it ·
**(3)** "The résumé is always one click away" → point at the fast path · **(4)** "Search finds anything" → point at
search · **Done** → focus returns to the home surface. Apps opened by the tour stay open.

Linux script: suggests `ls` → waits for Enter → suggests `cd projects` → waits → suggests `open <first project>` →
waits → points at `resume` and `help`. Each suggestion is inserted with *Paste into Terminal*; the visitor presses
Enter. Typing anything else ends the tour gracefully ("You've got it.").

### Presentation
Coach-mark card: OS-skinned surface, step counter "2 / 4", **Next** · **End tour**. A soft highlight ring around
`pointAt` (no dimming overlay that blocks the UI). On touch, a pulse ring instead of a ghost cursor. Timing: each
step ≤ 5 s auto-advance **only after** the app settles; total ≈ 20 s; Next advances immediately.

### Accessibility
Captions are announced through the polite status region; the card is a labelled `group` reachable by Tab, with
Next/End as real buttons; focus follows the kernel's normal rules for each opened app (the tour never forces
focus elsewhere). Reduced motion → no ring animation, no auto-advance (manual Next only). Esc ends the tour.

### Analytics
`tour_started`, `tour_completed`, `tour_cancelled` with `{os}`.

## Edge cases
OS switch or Back during the tour → tour ends silently. An app fails to load → step is skipped with the caption
"Skipping ahead". Window already open → the step focuses it instead. Compact mode → steps run with single-window
behaviour. Visitor starts the tour twice → restarts from step 1.

## Feature IDs + acceptance tests

| ID | Feature | Acceptance test |
|---|---|---|
| `TOUR-OFFER-01` | Offered once, idiomatically, never on deep links | `e2e: T1 chip appears once via chooser; absent on deep link` |
| `TOUR-NEVER-01` | Never starts automatically | `e2e: T1 no kernel action fires without Start` |
| `TOUR-REAL-01` | Drives real kernel actions | `unit: script steps are valid KernelActions for the OS registry` |
| `TOUR-CANCEL-01` | Any input cancels; state valid and focused | `e2e: T1 click/Esc mid-step leaves focus on a sensible element` |
| `TOUR-LNX-01` | Linux tour never presses Enter | `e2e: T1 suggested command remains unsubmitted until user Enter` |
| `TOUR-A11Y-01` | Polite captions, keyboard operable, reduced-motion manual mode | `cmp: captions in status region; no auto-advance under reduced motion` |
| `TOUR-LAZY-01` | Lazy chunk ≤ 8 KB, zero initial cost | `perf: tour chunk absent from every first load` |
| `TOUR-RESTART-01` | Restartable from Settings, search, help, `tour` | `e2e: each entry point starts the tour` |

## Open questions
None.
