# Android / surfaces — Status bar and navigation bar

## Role + requirement refs
The persistent system bars. The navigation bar is where **Back, Home and Recents** live — the defining Android
controls — in either gesture or 3-button mode. R20, R42, B10.

## Portfolio mapping
None.

## Anatomy
**Status bar** (24 dp, or `--sa-t` on real phones): left = time (`<time>`, Label-L) + small notification glyphs of
apps with shade items (max 3, decorative) · right = Wi-Fi, signal, battery glyphs (decorative). Transparent over the
launcher; takes the app's `surface` colour inside apps (edge-to-edge). **No punch-hole, camera dot or bezel is drawn
at any size** (north-star B17); on larger screens the status bar spans the full page width.
**Navigation bar — two modes (pref, toggle in Quick Settings / Settings):**
- **Gesture navigation** (default on coarse pointers): a 108 × 4 dp **pill** centred, 8 dp above `--sa-b`; hit area
  48 dp tall.
- **3-button navigation** (default on fine pointers — visible, discoverable, keyboard-friendly): ◀ Back · ● Home ·
  ■ Recents, each 48 dp+ in an 48 dp-tall bar (80 dp wide targets), Material Symbols glyphs, ripple feedback.

## Behaviour & states
| Control | Interaction | Result |
|---|---|---|
| Back (button / edge-swipe from left or right / Esc / browser Back) | press / swipe | Hierarchical Back with predictive preview (`AND-LIFE-02/03`) |
| Home (button / swipe-up on pill / Alt+Shift+H) | press / swipe | Launcher; app keeps its stack |
| Recents (button / swipe-up-and-hold on pill / Alt+Shift+O) | press / hold | `recents.md` |
| Pill | horizontal swipe | Quick-switch to the previous app (slide transition); alternative: Recents |
| Status bar | click / swipe down | Notification shade |
| Back on the launcher | — | No-op with a subtle pill bounce (never exits the OS) |

**Edge-swipe zones** start ≥ 24 px inside the physical screen edge on touch screens (the browser owns the outer
strip); with a mouse they are a click-drag from the page edge. In 3-button mode edge swipes are off. On tablets,
laptops and desktops the 3-button controls sit at the right end of the **taskbar** (`04-responsive.md`).

## Navigation & routes
Back → history collapse/back; Home → `go('/android')`.

## Motion
Button ripple (bounded, 40 dp). Pill: stretches slightly with swipe velocity; bounce on no-op Back 200 ms.
Mode switch: bar crossfades 200 ms.

## Responsive
Phone landscape: the navigation bar stays at the bottom in gesture mode; moves to the **trailing side** in 3-button
mode (authentic). Pad: both bars persistent; the nav buttons sit at the taskbar's right end in 3-button mode.

## Accessibility
Navigation bar = `nav[aria-label="System navigation"]` with real buttons **in both modes** (in gesture mode the pill
is a button "Home" with description "Hold for recent apps", plus visually hidden "Back" and "Recent apps" buttons that
become visible on keyboard focus — so keyboard and switch users always have all three). Status bar = button
"Notifications and quick settings". These remain operable while an app is open (outside the app's `inert` scope).

## Edge cases
Mode changed while an app is open → bar swaps in place; content inset animates via padding token (no layout jump >
one frame; CLS-safe because it follows a user action). Keyboard up → nav bar hides with the browser chrome; tokens
keep layouts stable.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `AND-BARS-01` | Status bar: edge-to-edge colouring, full page width on larger screens, **no punch-hole/camera dot/bezel at any size**, shade button | `e2e: pixel and chromium-desktop projects have no cut-out element; status button opens the shade` | P6 |
| `AND-BARS-02` | **Two navigation modes** with defaults by pointer type and a live toggle | `e2e: toggle switches modes; default differs on pixel (gesture) vs chromium-desktop (3-button)` | P6 |
| `AND-BARS-03` | Back / Home / Recents behaviours incl. pill gestures and quick-switch | `e2e: A1 each control; scripted pill swipes` | P6 |
| `AND-BARS-04` | Edge-swipe zones respect the 24 px browser strip | `e2e: swipe from x=5 does nothing; from x=30 starts Back` | P6 |
| `AND-BARS-05` | All three controls keyboard-reachable in gesture mode | `e2e: Tab reveals Back/Recents buttons` | P6 |
| `AND-BARS-06` | Landscape/pad placements | `e2e: pixel-landscape (side bar in 3-button) + tablet` | P6 |

## Not like the others
A **navigation bar with Back, Home and Recents** (or their gesture equivalents) — the only OS here with a system-wide
**Back** control (iOS: a Home indicator only, Back is in-app; desktops: window controls + taskbar/Dock).
