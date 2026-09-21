# iOS / surfaces — Control Center

## Role + requirement refs
The quick-controls panel pulled from the top-right: the fastest way to change sound, motion, transparency, theme —
and to switch operating systems. R14, R43 (`A11Y-PREF-01`), `CHOOSE-EXIT-01`.

## Portfolio mapping
A "Now" module shows `person.openTo` and links to Mail.

## Anatomy
Backdrop: current screen blurred + dimmed (one blur surface; solid scrim on T0). Modules (material `thick`, radius
22–34 pt) in a 4-column grid:

| Module | Size | Control |
|---|---|---|
| **Sound** | 1 × 1 toggle + long-press → volume slider sheet | `prefs.sound.enabled`, `volume` |
| **Reduce Motion** | 1 × 1 toggle | `prefs.motion` |
| **Reduce Transparency** | 1 × 1 toggle | `prefs.glass` |
| **Dark Mode** | 1 × 1 toggle | `prefs.theme` |
| **Brightness** | 1 × 2 vertical slider (cosmetic dim overlay 0–30 %) | session only |
| **Volume** | 1 × 2 vertical slider | `prefs.sound.volume` |
| **Now** | 2 × 1 | `person.openTo` → Mail |
| **Switch OS** | 2 × 1 | opens the OS list sheet (released OSes + Back to chooser) |
| **Résumé** | 1 × 1 | opens `/ios/files/resume` |
| **Tour** | 1 × 1 | starts the guided tour |

## Behaviour & states
- **Invoke:** pull down from the top-right zone (interactive) · click the status bar's right third · keyboard via the
  status-bar button. Close: tap the backdrop, swipe up, Esc, Home indicator.
- Toggles apply instantly (`SET_PREF`), update `<html>` attributes, persist; active = filled accent circle.
- Sliders: drag vertically **or** use arrow keys (native range semantics underneath).
- Long-press a module → expands (spring) for extra controls (Sound → slider + "Play intro sound").

## Navigation & routes
No history. Switch OS → `SWITCH_OS`.

## Motion
Finger-driven reveal; modules scale 0.9 → 1 with a 20 ms stagger, spring r 0.38 ζ 0.85. Toggle fill 160 ms. Reduced
motion (when toggled here, it applies to its own closing animation immediately): fades.

## Responsive
Phone landscape: two rows of modules. Pad: a 360 pt panel at the top-right (no full-screen backdrop blur — just a
scrim), rest of the screen interactive-dismiss. Laptops/desktops: same as pad, top-right of the full page; it also
carries an **App Switcher** module (the visible alternative to the swipe-and-pause gesture).

## Accessibility
Modal `dialog` "Control Center"; toggles are `button[aria-pressed]` with text names; sliders are native
`<input type="range" orient="vertical">` styled (with `aria-valuetext` like "Volume 60 %"); expansion also via a
"More" button on each expandable module. Focus → first toggle; close returns to the status-bar button.

## Edge cases
Opened while Notification Center is opening → the later gesture wins after the first settles (overlay arbiter).
Brightness overlay never reduces contrast below AA (cap 30 %) and is skipped under `prefers-contrast: more`.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `IOS-CC-01` | Module grid with toggles, sliders, Now, Switch OS, Résumé, Tour | `cmp: modules render; Now derives from data` | P5 |
| `IOS-CC-02` | Toggles/sliders wired to prefs, instant apply + persist | `e2e: A11Y-PREF-01 on iOS` | P5 |
| `IOS-CC-03` | Interactive pull-down + button/keyboard alternatives; close paths | `e2e: open by drag, click and keyboard` | P5 |
| `IOS-CC-04` | Long-press expansion with "More" button alternative | `e2e: Sound expands both ways` | P5 |
| `IOS-CC-05` | Switch OS sheet | `e2e: switch parks the iOS session` | P5 |
| `IOS-CC-06` | Dialog semantics, native range sliders | `e2e: X1 with Control Center open` | P5 |

## Not like the others
A **separate** top-right panel of rounded modules with long-press expansion (Android merges Quick Settings into the
notification shade; Windows has a Quick Settings flyout; macOS a menu-bar Control Center popover).
