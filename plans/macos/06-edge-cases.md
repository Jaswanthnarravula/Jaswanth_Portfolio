# macOS / 06 — Edge cases

## Role + requirement refs
Deliberately engineered failure and abuse cases for macOS. Generic mechanisms (idempotent open, epochs, safe
storage, restore rules) are owned by `shared/04-os-kernel.md`; this file lists macOS manifestations and the expected
visible result. R46, smell test 6 (impatience).

| # | Scenario | Expected result | Mechanism |
|---|---|---|---|
| E1 | Click a Dock icon 10× rapidly | One window; it is focused; one history entry | `KRN-WIN-01`, `go()` dedupe |
| E2 | Click red (close) then immediately the Dock icon | Close is cancelled; window returns to `normal` | `closing` + OPEN guard |
| E3 | Click yellow then the Dock tile mid-flight | Minimize timeline reverses smoothly | single progress timeline |
| E4 | Open 8 apps, focus-cycle quickly | Z-order always matches last click; no flicker; history stays bounded | `zOrder` array, back-collapse |
| E5 | Drag a window, then the browser window is resized/rotated | Drag commits last valid rect; window re-clamped; title bar reachable | pointer capture + `ResizeObserver` |
| E6 | Drag a window toward the top | Stops under the menu bar | clamp |
| E7 | Shrink the viewport into `compact` with 5 floating windows | All maximize (one visible); floating rects kept; growing back restores them | size-class buckets |
| E8 | Refresh on `/macos/finder/experience/acme` | Fallback paints → desktop revives → Finder focused on that role; other windows restored if session < 24 h | URL wins, snapshot for the rest |
| E9 | Cold deep link from another site | Only Finder opens; no boot/lock; no tour offer | `ROUTE-DEEP-01` |
| E10 | Browser Back repeatedly from a busy desktop | Steps through previous focused locations, then `/macos`, then the chooser; never traps; windows are not closed by Back (only focus/location changes) | `shared/05` invariants |
| E11 | Switch OS while a window is minimizing | Epoch bump kills the timeline; session parks with the window `minimized` | `KRN-SWITCH-01` |
| E12 | Return to macOS after visiting Windows | Same windows, same rects, same focused app; no boot/lock; continuity offer in the Dock if applicable | `KRN-SES-01`, `CONT-*` |
| E13 | App chunk fails to load (offline) | Dock icon stops bouncing after 2 retries; banner "Couldn't open GitHub — Retry"; content available in `/plain` | `failed` path per app |
| E14 | Menu open when its window closes | Menu closes; focus → Apple menu title | menu lifecycle |
| E15 | Spotlight opened during drag / Mission Control | Ignored until the gesture/overlay ends | overlay arbitration (one transient at a time) |
| E16 | Storage disabled (private mode) | Everything works for the session; Settings shows a quiet note | safe storage |
| E17 | Portfolio data changed since the saved session | Removed slugs fall back to the parent folder/list | `KRN-SES-02` |
| E18 | Tab hidden during any animation | On return, state snaps to kernel truth; no half-scaled windows | ticker pause + derive-from-state |
| E19 | Keyboard Move mode, then viewport resize | Move mode cancels, last valid rect committed | same as E5 |
| E20 | Double-click title bar during zoom animation | Timeline reverses | single progress timeline |
| E21 | Long-press context menu while scrolling a Finder list on touch | Long-press cancelled after 10 px movement | `LongPress` primitive |
| E22 | Two transient surfaces requested at once (banner action + menu) | Arbitration order: modal dialog › menu › Spotlight › Mission Control › banner; lower-priority request queues or is dropped | overlay arbiter |

## Overlay arbiter (macOS)
One transient surface at a time. Priority and behaviour as in E22; banners are the only surface allowed to coexist
with others (they never take focus).

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `MAC-EDGE-01` | Scenarios E1–E7 (window abuse + resize) | `e2e: macOS impatience script part A` | P2 |
| `MAC-EDGE-02` | Scenarios E8–E12 (refresh, deep link, Back, OS switch/return) | `e2e: H1 + D1 + P1 on macOS` | P3 |
| `MAC-EDGE-03` | Scenarios E13–E18 (failure, storage, stale data, hidden tab) | `e2e: offline + private-mode + stale-session fixtures` | P3 |
| `MAC-EDGE-04` | Scenarios E19–E22 + overlay arbiter | `unit: arbiter priority table; e2e: part B` | P3 |

## Not like the others
Browser Back never closes macOS windows — it only changes focus/location (on iOS/Android, Back **does** leave the
app, because that is what Back means there). No Snap-related cases exist here (they live in `windows/06`).
