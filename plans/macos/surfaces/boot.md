# macOS / surfaces — Boot

## Role + requirement refs
The authentic startup beat that doubles as the loading screen for the macOS chunk. R13, N6. Rules of appearance
are fixed by `04-os-chooser.md` (`CHOOSE-ENTER-02`) and the risk-11 guard: **first chooser entry per session
only; never on deep links, refresh, `/go`, or re-entry; ≤ 1.5 s; any input skips; removed under reduced motion.**

## Portfolio mapping
None.

## Anatomy
Black full-screen stage · centred logo (asset `mac.boot.logo`: official Apple logo in `official` mode, an original
abstract monogram in `original` mode; 88 px) · thin progress bar below (200 × 4 px, radius 2 px, track
`rgb(255 255 255 / .25)`, fill white).

## Behaviour & states
| State | Behaviour |
|---|---|
| Shown | Only if the chunk is still loading 150 ms after the click; otherwise skipped entirely |
| Progress | Tied to real milestones, not a fake timer: 0 → 0.6 on chunk resolved, → 0.9 on shell mounted, → 1 on first frame settled; eased so it never jumps backwards |
| Complete | Bar fills → 120 ms hold → crossfade (180 ms) to the lock screen (first entry) or desktop |
| Skip | Any click/key/touch → immediate crossfade as soon as the shell is mounted (if not yet mounted, the bar stays but the hold/extra beats are dropped) |
| Slow network (> 4 s) | A quiet line appears: "Still starting up…" + link "Open the plain portfolio" |
| Failure | Kernel `failed` → "Couldn't start macOS" · Retry · Plain portfolio |

Sets `session.bootSeen = true` (`MARK_BOOT_SEEN`).

## Navigation & routes
URL is already `/macos` (pushed by the chooser). Back during boot reverses to the chooser (`CHOOSE-ENTER-01`).

## Motion
Logo fades in 200 ms; bar width via `transform: scaleX`; exit crossfade 180 ms. No startup chime unless sound is
enabled (then an original soft chord, −18 dB — not Apple's chime, in either asset mode).

## Responsive
Identical on all sizes; logo 64 px on `compact`. Respects safe areas.

## Accessibility
Overlay is `aria-hidden`; the polite status says "Starting macOS" once and "macOS ready" on completion. Skippable
by any key. No focus is placed inside the boot screen.

## Edge cases
Chunk cached → no boot frame at all. Tab hidden during boot → completes on return without animation. Reduced
motion → no boot; a plain 150 ms crossfade.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `MAC-BOOT-01` | Boot visuals with real-milestone progress | `e2e: throttled load shows logo + bar reaching 100 %` | P3 |
| `MAC-BOOT-02` | Appearance rules (first chooser entry only; never deep link/refresh/re-entry) | `e2e: D1 deep link and reload show no boot frame` | P3 |
| `MAC-BOOT-03` | Any input skips; ≤ 1.5 s added | `e2e: keypress during boot lands on next surface immediately` | P3 |
| `MAC-BOOT-04` | Slow/failure states with /plain link | `e2e: offline → Retry + plain link` | P3 |
| `MAC-BOOT-05` | Reduced motion removes boot | `e2e: R1 no boot overlay` | P3 |

## Not like the others
Logo + slim linear bar on black (Windows: spinning ring of dots under a logo; Android: animated mark; Linux:
scrolling kernel log text).
