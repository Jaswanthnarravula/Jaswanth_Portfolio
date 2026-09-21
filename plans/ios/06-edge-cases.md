# iOS / 06 — Edge cases

## Role + requirement refs
iOS manifestations of the engineered edge cases. Generic mechanisms: `shared/04-os-kernel.md`. R46, smell test 6.

| # | Scenario | Expected result | Mechanism |
|---|---|---|---|
| E1 | Tap an icon 10× rapidly | One app opens once; extra taps ignored while `opening`/`normal` | singleton instance + guard table |
| E2 | Tap icon A, then icon B mid-flight | A retargets closed into its icon; B opens; no visual jump | spring `retarget()` with velocity |
| E3 | Tap Home during the open flight | Flight reverses from current progress back into the icon | same spring, new target |
| E4 | Rotate the phone during a flight | Both rects re-measured; flight retargets | `MOTION-FLIGHT-01` |
| E5 | Open from page 2, go Home after the grid reflowed (rotation) | Pager jumps to the page now holding that icon; flight lands on its **current** rect | re-measure at close; page memory by icon |
| E6 | Open from inside the Career folder, then Home | Return flight targets the **folder icon** | `IOS-FLIGHT-02` fallback order |
| E7 | Start the Home gesture, then drag back down and release | App springs back open (projection < threshold) | velocity projection |
| E8 | Edge-swipe back halfway, release slowly vs flick | Slow → cancels; flick → pops (by projected position) | projection |
| E9 | Pull down Notification Center while Control Center is animating | Later gesture waits for rest; no overlap | overlay arbiter |
| E10 | Banner arrives mid-flight | Queued until rest | banner queue |
| E11 | Refresh on `/ios/github/{slug}` | Fallback → Home revives underneath → GitHub restored with stack [Projects, project]; no boot/lock | URL wins; synthesized stack |
| E12 | Cold deep link | App shown directly (no open flight on first paint — it is simply there); Home exists behind it | `ROUTE-DEEP-01` |
| E13 | Browser Back inside a pushed screen → root → Home → chooser | Pop → pop → app closes into icon → chooser; never traps | mobile push rule |
| E14 | Browser Back with a sheet open | Sheet dismisses first (transient arbitration), history unchanged | Esc/Back arbiter |
| E15 | 5 apps opened in sequence | 3 stay warm; the oldest 2 restore from NavStack + scrollTop when reopened | LRU(3) |
| E16 | Switch OS during a flight | Epoch bump; session parks with the app `normal` and focused | `KRN-SWITCH-01` |
| E17 | Return to iOS later | Foreground app restored (no flight), Home page remembered, no boot/lock; Handoff banner if applicable | `KRN-SES-01`, `CONT-*` |
| E18 | App chunk fails (offline) | Placeholder shows "Couldn't open GitHub" + Retry + Home; flight still completes | per-app `failed` path |
| E19 | Keyboard up, then rotate | `--vvh` re-measured; Send/Cancel remain visible | `RESP-KB-01` |
| E20 | Desktop browser resized from 1920 × 1080 down to 1366 × 650 (or window dragged to half-screen) | Full-page Home re-derives icon size, columns and rows live; overflow moves to page 2; below phone width it swaps to the phone layout; foreground app + stack preserved | `IOS-RESP-06`, `IOS-HOME-07` |
| E21 | Long-press while paging | Cancelled by > 10 pt movement | `LongPress` |
| E22 | Storage disabled / stale session / hidden tab mid-animation | Session-only / truncated refs / snaps to kernel truth | shared mechanisms |

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `IOS-CASE-01` | E1–E8 (tap spam, retarget, rotation, folder/page returns, gesture projection) | `e2e: iOS impatience script part A` | P5 |
| `IOS-CASE-02` | E9–E10, E14 (overlay/banner/sheet arbitration) | `unit: arbiter table; e2e: part B` | P5 |
| `IOS-CASE-03` | E11–E13, E16–E17 (refresh, deep link, Back, switch/return) | `e2e: H1 + D1 + P1 on iOS` | P5 |
| `IOS-CASE-04` | E15, E18–E22 (LRU, failure, keyboard+rotate, layout swap, storage) | `e2e: part C` | P5 |

## Not like the others
Browser Back **does** leave an app on iOS (it is "go back one level" all the way Home) — on the desktops Back never
closes a window. Return-to-icon fallbacks (E5, E6) exist only in the mobile OSes.
