# Windows 11 / 06 — Edge cases

## Role + requirement refs
Windows manifestations of the engineered edge cases. Generic mechanisms: `shared/04-os-kernel.md`. R46, smell test 6.

| # | Scenario | Expected result | Mechanism |
|---|---|---|---|
| E1 | Click a taskbar button 10× rapidly | Deterministic: open → (active) minimize → restore … never two windows; final state matches click parity; one history entry per distinct URL | `KRN-WIN-01`, taskbar decision table, `go()` dedupe |
| E2 | Close then immediately click the taskbar button | Close cancelled → `normal` | `closing` + OPEN guard |
| E3 | Drag toward an edge, preview shows, press Esc | Preview disappears; window stays under the pointer; drag continues | Snap preview is visual only until release |
| E4 | Release on the top edge | Maximizes (radius 0); dragging the title bar down restores proportionally under the pointer | `WIN-WM-03/04` |
| E5 | Two windows snapped ½+½; close one | The other keeps its half (does not auto-expand); paired resize ends | snap tags are independent |
| E6 | Snapped windows, then browser resize/rotation | Rects re-derive from snap tags; floats re-clamp; title bars reachable | `WIN-WM-06` |
| E7 | Viewport crosses into `compact` with snapped + floating windows | All maximize (one visible); tags and floats kept for later | size-class buckets |
| E8 | Start open, then click a desktop icon | Start closes first, then the icon action runs (single click = select) | overlay arbiter |
| E9 | Type in Start while it is still animating in | Keystrokes are not lost (input focused at frame 0); morph to Search | input wins |
| E10 | Hover preview flyout showing; its window closes | Card removed; flyout closes when empty | taskbar preview lifecycle |
| E11 | Show desktop, then open a new app, then Show desktop again | Second click minimizes the new set (does not restore the stale set) | restore set invalidated on any open |
| E12 | Refresh on `/windows/edge/resume` | Fallback → desktop revives → Edge focused on the PDF tab; session windows restored if < 24 h | URL wins |
| E13 | Cold deep link | Only that app opens; no boot/lock/tour | `ROUTE-DEEP-01` |
| E14 | Browser Back on a busy desktop | Steps through previous focused locations → `/windows` → chooser; never closes windows; in compact, closes sheets first | `shared/05` + `WIN-RESP-04` |
| E15 | OS switch during a Snap commit flight | Epoch bump; session parks with the committed target rect | `KRN-SWITCH-01` |
| E16 | Return to Windows later | Same windows, snaps, focused app; taskbar alignment pref kept; continuity toast if applicable | `KRN-SES-01`, `CONT-*` |
| E17 | App chunk fails (offline) | Shimmer stops after 2 retries; toast "Couldn't open GitHub" + Retry | per-app `failed` path |
| E18 | Storage disabled | Session-only operation; Settings note | safe storage |
| E19 | Address bar: invalid path / mixed separators / wrong case | Inline error / normalized navigation | path parser |
| E20 | Two transient surfaces requested together | Arbiter priority: modal dialog › menu › Start/Search › Task View › flyout › toast | overlay arbiter |
| E21 | Tab hidden mid-animation | State snaps to kernel truth on return | derive-from-state |
| E22 | Taskbar alignment switched to Left while Start is open | Start re-anchors to the Start button without closing | anchor re-measure |

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `WIN-CASE-01` | E1–E7 (taskbar spam, Snap, resize, compact boundary) | `e2e: Windows impatience script part A` | P4 |
| `WIN-CASE-02` | E8–E11 (Start/preview/Show-desktop lifecycles) | `e2e: part B` | P4 |
| `WIN-CASE-03` | E12–E16 (refresh, deep link, Back, switch/return) | `e2e: H1 + D1 + P1 on Windows` | P4 |
| `WIN-CASE-04` | E17–E22 (failure, storage, parser, arbiter, re-anchor) | `unit: arbiter + parser; e2e: part C` | P4 |

## Not like the others
Taskbar-click parity (E1), Snap lifecycles (E3–E6, E15) and Show desktop (E11) exist only here.
