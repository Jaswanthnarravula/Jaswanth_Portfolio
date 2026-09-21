# Windows 11 / surfaces — Boot

## Role + requirement refs
The Windows startup beat doubling as the chunk-loading screen. R13, N6. Appearance rules are fixed by
`04-os-chooser.md` (`CHOOSE-ENTER-02`): **first chooser entry per session only; never on deep links, refresh,
`/go` or re-entry; ≤ 1.5 s; any input skips; removed under reduced motion.**

## Portfolio mapping
None.

## Anatomy
Black stage · centred logo (asset `win.boot.logo`: official four-pane logo in `official` mode, an original
four-tile abstract mark in `original` mode; 96 px) · below it the **ring of orbiting dots** (5 dots on a 32 px
circle, the classic indeterminate spinner) · no text.

## Behaviour & states
| State | Behaviour |
|---|---|
| Shown | Only if the Windows chunk is still loading 150 ms after the click |
| Spinner | Indeterminate by design (Windows never shows a boot percentage); dots orbit with staggered easing, 2 s loop, `transform` only |
| Complete | Shell mounted → spinner fades (120 ms) → crossfade 180 ms to the lock screen (first entry) or desktop |
| Skip | Any input → crossfade as soon as the shell is mounted |
| Slow (> 4 s) | Text fades in under the spinner: "Just a moment…" + link "Open the plain portfolio" |
| Failure | "Your PC ran into a problem" is **not** used (would read as a real crash). Calm card: "Couldn't start Windows" · Retry · Plain portfolio |

Sets `session.bootSeen = true`.

## Navigation & routes
URL already `/windows`. Back during boot reverses to the chooser.

## Motion
Dot orbit: each dot follows the circle with `cubic-bezier(0.4, 0, 0.2, 1)` keyframes offset by 120 ms; pure CSS
`transform` animation (runs off the main thread). Reduced motion: no boot overlay at all.

## Responsive
Same on all sizes; logo 72 px on `compact`.

## Accessibility
Overlay `aria-hidden`; status region announces "Starting Windows" → "Windows ready". No focus inside. Any key skips.

## Edge cases
Cached chunk → no boot frame. Hidden tab → completes silently. No fake BSOD anywhere in the product.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `WIN-BOOT-01` | Logo + orbiting-dots spinner (CSS transform only) | `e2e: throttled load shows spinner; perf: no main-thread animation work` | P4 |
| `WIN-BOOT-02` | Appearance rules (first chooser entry only) | `e2e: D1 deep link + reload show no boot frame` | P4 |
| `WIN-BOOT-03` | Any input skips; ≤ 1.5 s added | `e2e: keypress skips` | P4 |
| `WIN-BOOT-04` | Slow/failure states (no fake crash screen) | `e2e: offline → calm card with Retry + plain link` | P4 |
| `WIN-BOOT-05` | Reduced motion removes boot | `e2e: R1` | P4 |

## Not like the others
An **indeterminate ring of dots** with no progress value (macOS: a determinate thin bar under the logo; Android:
an animated brand mark; Linux: text log).
