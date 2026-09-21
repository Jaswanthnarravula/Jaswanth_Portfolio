# Android / apps — Settings

## Role + requirement refs
Preferences, accessibility & motion, privacy and legal notices, Switch OS, wallpaper & style (dynamic colour).
`A11Y-PREF-01`, `ASSET-LEGAL-01`, `ANL-NOTICE-01`. `AppRole: settings` · slug `settings`.

## Portfolio mapping
"About phone" shows portfolio facts (`person`, `resume.updated`, `contentRev`) as device information; tapping "Build
number" seven times triggers a friendly toast (egg-adjacent, counts as part of `EGG-COUNT-01`? **No** — it is a plain
authentic detail, not a catalogued egg): "No need — you already have full access."

## Anatomy
**Large collapsing top app bar** "Settings" (Display-S → Title-L on scroll) with a **search bar** beneath it
("Search settings"). Top-level list of 72 dp items: leading icon in a **tonal circle** (40 dp), title Title-M,
supporting text Body-M.

| Item | Screen contents |
|---|---|
| **Wallpaper & style** | 4 wallpapers (tap → the whole UI re-themes via the precomputed scheme, `AND-ID-02`) · Dark theme switch · **Themed icons** switch |
| **Accessibility** | Remove animations (= reduce motion) · Solid surfaces (= reduce transparency) · High contrast text · Font size slider (preview text) · Single-key shortcuts · "Open plain portfolio" |
| **Sound & vibration** | UI sounds switch · Volume slider · "Play intro sound" |
| **System → Gestures → Navigation mode** | Radio cards with illustrations: **Gesture navigation** / **3-button navigation** |
| **Notifications** | Heads-up on/off (when off, items go straight to the shade) |
| **Privacy** | What analytics count; DNT/GPC status; "No cookies" |
| **Apps** | The six apps → **App info** pages (version, Open, legal line) |
| **About phone** | Device name "Jaswanth's Portfolio", facts, "Easter eggs found n / N", **Legal information** → `LegalNotice` |
| **Switch operating system** | Released OS list + Back to chooser |
| **Tour** | Start the guided tour |

## Behaviour & states
Switches/sliders/radios apply instantly (`SET_PREF`), persist, and update `<html>` attributes / Android-only prefs
(wallpaper scheme, themed icons, navigation mode). Forward navigation = shared-axis X; **Back** returns. Search
filters across all screens; results show breadcrumbs ("Accessibility › Font size"); tapping navigates and pulses the row.

## Navigation & routes
`/android/settings` only; the sub-screen path is session state (Back-unwound).

## Motion
Shared-axis X 300 ms; switch thumb 150 ms standard with a state-layer halo; re-theme crossfade 300 ms (colours
transition via CSS custom properties — no layout). Reduced motion respected the moment it is toggled.

## Responsive
**Pad: two-pane** (list left, detail right, 24 dp gutters). Phone landscape: single pane, wider margins.

## Accessibility
Lists of links; M3 switches = `button[role="switch"]` with visible labels and state text; radio cards = `radiogroup`;
sliders native with `aria-valuetext`; search = combobox with a results list; legal = readable document. All rows ≥ 48 dp.

## Edge cases
System prefers reduced motion but the visitor enables animations → visitor wins, supporting text explains. Wallpaper
scheme change with an app in Recents → its card re-themes (CSS variables) without remount. Storage unavailable →
supporting text "Changes last for this visit".

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `AND-SET-01` | Settings with collapsing large app bar, search with breadcrumbs, tonal-circle list | `e2e: A1 navigation; search navigates + pulses the row` | P6 |
| `AND-SET-02` | **Wallpaper & style** re-themes the whole UI live (Material You) + themed icons | `e2e: choose wallpaper → computed --md-primary changes everywhere` | P6 |
| `AND-SET-03` | Accessibility / Sound controls apply instantly + persist | `e2e: A11Y-PREF-01 on Android` | P6 |
| `AND-SET-04` | Navigation mode radio cards switch the nav bar live | `e2e: mode changes without reload` | P6 |
| `AND-SET-05` | Apps → App info; About phone; Legal; Privacy | `e2e: ASSET-LEGAL-01 + ANL-NOTICE-01 reachable` | P6 |
| `AND-SET-06` | Switch operating system + Tour | `e2e: switch parks the session` | P6 |
| `AND-SET-07` | Pad two-pane; semantics | `e2e: tablet; X1 axe clean` | P6 |

## Not like the others
**Wallpaper-driven re-theming, navigation-mode choice, tonal-circle list under a collapsing large title** (iOS:
inset-grouped lists with tinted glyph tiles; Windows: NavigationView + expander cards; macOS: sidebar panes).
