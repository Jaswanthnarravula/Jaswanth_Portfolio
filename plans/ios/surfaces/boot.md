# iOS / surfaces — Boot

## Role + requirement refs
The iPhone power-on beat doubling as the chunk-loading screen. R13, N6. Appearance rules fixed by
`04-os-chooser.md` (`CHOOSE-ENTER-02`): **first chooser entry per session only; never on deep links, refresh, `/go`
or re-entry; ≤ 1.5 s; any input skips; removed under reduced motion.**

## Portfolio mapping
None.

## Anatomy
Pure black stage filling the whole page at every size · centred logo (asset
`ios.boot.logo`: official Apple logo in `official` mode; an original abstract monogram in `original` mode; 72 pt,
white). **No progress bar** (a normal iPhone boot shows only the logo).

## Behaviour & states
| State | Behaviour |
|---|---|
| Shown | Only if the iOS chunk is still loading 150 ms after the click |
| Holding | Logo only; stays until the shell is mounted |
| Complete | Logo fades 160 ms → lock screen fades/zooms in (first entry) or Home Screen |
| Skip | Any input → immediate transition once mounted |
| Slow (> 4 s) | Small grey text under the logo: "Still starting…" + "Open the plain portfolio" |
| Failure | "Couldn't start iOS" · Retry · Plain portfolio |

Sets `session.bootSeen = true`.

## Navigation & routes
URL already `/ios`. Back during boot → chooser.

## Motion
Logo fade-in 200 ms, fade-out 160 ms; Home Screen arrival: icons scale 1.15 → 1 + fade with a 12 ms column stagger
(the iOS unlock "fly-in"), spring r 0.5 ζ 0.9.

## Responsive
Full page at every size (phone, tablet, laptop, desktop); logo 72 pt on phones, 96 pt on larger screens.

## Accessibility
`aria-hidden`; status region "Starting iOS" → "iOS ready"; no focus inside; any key skips.

## Edge cases
Cached chunk → no boot frame. Reduced motion → no boot, no fly-in (150 ms crossfade).

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `IOS-BOOT-01` | Logo-only boot + icon fly-in arrival | `e2e: throttled load shows logo; arrival fly-in plays once` | P5 |
| `IOS-BOOT-02` | Appearance rules | `e2e: D1 deep link + reload show no boot frame` | P5 |
| `IOS-BOOT-03` | Any input skips; slow/failure states | `e2e: keypress skips; offline → Retry + plain link` | P5 |
| `IOS-BOOT-04` | Reduced motion removes boot + fly-in | `e2e: R1` | P5 |

## Not like the others
**Logo only, no indicator**, followed by the icon fly-in (macOS: logo + thin bar; Windows: ring of dots; Android:
animated mark; Linux: text log).
