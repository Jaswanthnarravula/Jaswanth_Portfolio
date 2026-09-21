# Android / 06 — Edge cases

## Role + requirement refs
Android manifestations of the engineered edge cases. Generic mechanisms: `shared/04-os-kernel.md`. R46, smell test 6.

| # | Scenario | Expected result | Mechanism |
|---|---|---|---|
| E1 | Tap an icon 10× rapidly | One app opens once; ripples may stack visually but only one transform runs | singleton instance + guard table |
| E2 | Tap icon A, then B mid-transform | A's tween killed and re-created in reverse (distance-scaled), B opens | `AND-MOTION-04` |
| E3 | **Back spam** (10× quickly) from a deep screen with a sheet open | Each Back resolves exactly one level in order: sheet → screens → app root → launcher; extra Backs on the launcher are no-ops (pill bounce) | Back contract; idempotent at root |
| E4 | Browser Back vs nav-bar Back vs Esc interleaved | Identical outcomes; history and UI never diverge | single Back resolver feeding `go()`/collapse |
| E5 | Predictive Back swipe started, then finger returns and releases | Cancels; surface springs back; no history change | commit only past threshold |
| E6 | Edge swipe from x < 24 px on a real phone | Ignored by us (the browser may navigate — our history invariants keep that safe: it equals Back) | edge rule + `shared/05` |
| E7 | App launched from the **drawer**, then Back to leave | Shrinks to centre-bottom + fade (no icon on Home) | `AND-LIFE-04` fallback |
| E8 | Rotate during a container transform | Rects re-measured; tween re-created toward the new rect | `MOTION-FLIGHT-01` |
| E9 | Pull the shade while the drawer is open | Drawer closes first, then the shade opens | overlay arbiter (Back-style) |
| E10 | Toggle navigation mode while an app is open | Bar swaps in place; insets update via tokens; no remount | `AND-BARS-02` |
| E11 | Change wallpaper scheme with apps in Recents | Every surface re-themes through CSS variables; no remount, no flash | `AND-SET-02` |
| E12 | Refresh on `/android/github/{slug}` | Fallback → launcher revives → GitHub restored with stack [Projects, project]; Back → list → launcher | URL wins; synthesized stack |
| E13 | Cold deep link | App shown directly (no transform on first paint); no boot/lock/tour | `ROUTE-DEEP-01` |
| E14 | Clear all in Recents with a Gmail draft | Instances removed; draft survives in the session archive | `AND-RECENTS-05` |
| E15 | Switch OS mid-transform | Epoch bump; session parks with the app `normal` | `KRN-SWITCH-01` |
| E16 | Return to Android later | Foreground app + Recents restored, scheme + nav mode kept; At-a-glance shows the continuity line if applicable | `KRN-SES-01`, `CONT-*` |
| E17 | App chunk fails (offline) | Splash shows "Couldn't open GitHub" + Retry + Home; transform still completes | per-app `failed` path |
| E18 | Snackbar + heads-up + dialog at once | Arbiter: dialog › sheet › menu › drawer/shade › Recents › heads-up › snackbar (snackbar waits) | overlay arbiter |
| E19 | Keyboard up, then rotate, then Back | IME closes first (platform), `--vvh` re-measured, layout stable | `AND-RESP-07` |
| E20 | Desktop browser resized from 1920 × 1080 down to 1366 × 650 (or window dragged to half-screen) | Full-page launcher re-derives icon size, columns and rows live; below phone width it swaps to the phone layout; app, stack, Recents preserved | `AND-RESP-06` |
| E21 | Long-press while swiping the drawer / list | Cancelled by > 10 dp movement | `LongPress` |
| E22 | Storage disabled / stale session / hidden tab mid-animation | Session-only / truncated refs / snaps to kernel truth | shared mechanisms |

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `AND-CASE-01` | E1–E2, E7–E8 (tap spam, re-created tweens, drawer return, rotation) | `e2e: Android impatience script part A` | P6 |
| `AND-CASE-02` | E3–E6 (**Back** spam, equivalence of Back sources, predictive cancel, edge rule) | `unit: Back resolver; e2e: part B` | P6 |
| `AND-CASE-03` | E9–E11, E18 (overlay arbitration, live nav-mode and scheme changes) | `unit: arbiter table; e2e: part C` | P6 |
| `AND-CASE-04` | E12–E17, E19–E22 (refresh, deep link, Recents draft, switch/return, failure, keyboard, layout swap, storage) | `e2e: H1 + D1 + P1 on Android + part D` | P6 |

## Not like the others
**Back-related cases (E3–E6)** are unique to Android: every Back source must be indistinguishable. Live re-theming
(E11) and navigation-mode switching (E10) exist only here.
