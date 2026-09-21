# Android / 02 — App lifecycle (container transform, system Back, Recents)

## Role + requirement refs
Apps behave like Android activities: they open with a **container transform**, they are left with **system Back**
(predictive where possible), and they live on in **Recents**. Requirements: R20, R37, R42. Primitives: `flight()`
(`shared/07`), kernel fullscreen policy + warm LRU(3) (`shared/04`, same plumbing as `ios/02-app-lifecycle.md`).

## Open — container transform (`AND-LIFE-01`)
1. `pointerdown` → ripple starts at the touch point. `pointerup` → the transform starts **synchronously** with a
   splash placeholder: the app's icon centred on its brand/`surface` colour (Android 12+ splash screen).
2. Geometry via `flight()`: the **icon's container** (its adaptive mask rect) grows to the **full page** (the whole
   viewport, at every size — no device frame) — `translate + scale` + `clip-path: inset(... round r)` from the mask
   radius to 0. Icon fades out over the first 35 %; splash/content **fades through** in from 35 % → 100 % (scale
   0.92 → 1).
3. **Duration-based**: 450 ms, **emphasized** easing (`03-motion.md`). Not a spring.
4. The real app mounts at progress > 0.9 or at rest; warm apps are instant. Launcher underneath does **not** scale
   (it fades to the scrim) — a visible difference from iOS.
5. Focus → app's top app bar title; launcher becomes `inert`; history **push** `/android/{slug}…`.

## Leave — system Back and Home
**Back** sources (all equivalent): nav-bar Back button (3-button mode) · edge-swipe Back gesture (gesture mode) ·
Esc · **browser Back** · hardware/keyboard Back. **Back is hierarchical**: close IME/menus/sheets → pop the in-app
stack → at the app root, leave the app.
- **Predictive Back** (`AND-LIFE-02`): during an edge-swipe the current surface scales to 0.9, rounds to 28 dp and
  shifts toward the swipe edge, **previewing what is behind** (previous screen or the launcher). Release past the
  threshold commits; otherwise it springs back (350 ms standard-decelerate). With buttons/Esc/browser Back the same
  animation plays non-interactively.
- Leaving an app at its root → **reverse container transform** into its launcher icon (350 ms emphasized-accelerate →
  decelerate). Icon re-measured at that moment; if it is in the **drawer** (not on Home) → the app shrinks to the
  centre-bottom and fades (Android's default when no icon is visible); if in a folder → folder icon.
- **Home** (nav-bar Home button / swipe-up on the gesture pill / Alt+Shift+H): same reverse transform, regardless of
  the in-app stack depth; the app keeps its stack in Recents.

## Recents (`surfaces/recents.md`)
Swipe-up-and-hold on the gesture pill / Recents button / Alt+Shift+O. Apps are cards; swiping a card up removes the
instance; "Clear all" removes all.

## In-app navigation
- Forward: **shared-axis X** (incoming slides in 30 dp from the right + fade; outgoing slides left + fade), 300 ms
  emphasized; or container transform from list item → detail where the item is a card.
- Back: reverse shared-axis (or predictive-back preview).
- Bottom navigation switches top-level destinations with **fade-through** (no history push).
- **Bottom sheets** (modal): rise with a 32 % scrim; drag handle; Back closes them first. **Menus/dialogs** follow M3.

## Routes
`/android` · `/android/{slug}[/…]`. App open and in-app forward navigation `go()` (always push on mobile); Back =
`history.back()`-equivalent collapse; bottom-nav, sheets, menus, Recents write nothing.

## Edge cases
Second icon tapped mid-transform → first reverses from current progress (tween re-created with distance-scaled
duration, min 150 ms), second opens. Rotation → rects re-measured. Back spam → each Back resolves one level,
idempotent at the launcher (Back on Home does nothing; it never leaves the OS — leaving is via Switch OS or browser
Back from `/android` to the chooser).

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `AND-LIFE-01` | Container transform open: ripple → sync splash → fade-through, 450 ms emphasized | `e2e: A1 first frame within one task; perf: no Layout in transform` | P6 |
| `AND-LIFE-02` | **Predictive Back** preview (interactive on swipe, animated otherwise) | `e2e: scripted edge-swipe cancel/commit; Esc plays the same animation` | P6 |
| `AND-LIFE-03` | Back is hierarchical: IME/menu/sheet → in-app stack → leave app; **browser Back = system Back** | `e2e: A1 drawer → app → goBack() at each level` | P6 |
| `AND-LIFE-04` | Leave → reverse transform into the icon; drawer/folder/absent fallbacks | `e2e: app launched from the drawer shrinks to centre-bottom` | P6 |
| `AND-LIFE-05` | Home keeps the app's stack in Recents; warm LRU(3) | `e2e: reopen from Recents restores the pushed screen + scroll` | P6 |
| `AND-LIFE-06` | In-app shared-axis / fade-through / bottom-sheet patterns | `cmp: pattern tokens; sheet closes on Back first` | P6 |
| `AND-LIFE-07` | History rules (push on open/forward; Back collapses) | `e2e: H1 on Android` | P6 |
| `AND-LIFE-08` | Focus choreography (title → inert launcher → animate; icon on return) | `e2e: focus lands on the launcher icon after Back` | P6 |

## Not like the others
**Duration + emphasized easing, fade-through content, launcher doesn't scale, and leaving is Back** — with a
*predictive* preview (iOS: velocity springs, Home Screen scales/dims, leaving is a swipe-up Home gesture and Back is
an in-app chevron). Desktops never transform windows back into launchers.
