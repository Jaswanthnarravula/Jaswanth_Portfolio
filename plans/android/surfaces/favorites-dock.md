# Android / surfaces — Favorites row and search bar

## Role + requirement refs
The bottom of the launcher: the **favorites (hotseat) row** and the **search bar** beneath it. R20, R25, N5.

## Portfolio mapping
Favorites (fixed four): **Files** (opens `/android/files/resume` — the Android résumé fast path together with the
At-a-glance chip) · **Chrome** · **GitHub** · **Gmail**. Gmail carries a **notification dot** (not a number) while
the "Let's talk" message is unread (session).

## Anatomy
- **Favorites row:** four 48 dp icons on the wallpaper (no plate, no blur), evenly spaced, **no labels** (names via
  accessible name); notification dot = 10 dp circle in `primary` at the icon's top-right.
- **Search bar:** 56 dp pill, `surface-container-high` at 92 % (tonal, no blur), leading "G"-style/search glyph
  (asset-manifest icon; original = magnifier), placeholder "Search", trailing mic + lens glyphs (decorative, hidden
  from AT). 16 dp side margins; sits above the navigation bar inset.

## Behaviour & states
- Tap favorite → ripple → container transform from the icon; return transform targets the same icon.
- Long-press → app shortcuts; for Files: "Open résumé" · "Download résumé" · "Experience" · "Education".
- Tap the search bar → the **drawer opens with search focused** (the bar morphs into the drawer's field — shared
  element, 300 ms emphasized).
- The row and bar persist while paging home screens and hide when the drawer is fully open (the drawer has its own field).

## Navigation & routes
Links: `/android/files/resume`, `/android/chrome`, `/android/github`, `/android/gmail`.

## Motion
Bar → drawer field morph via `flight()`; favorites fade out as the drawer rises (finger-linked).

## Responsive
Phone landscape: favorites become a vertical column on the trailing side; the search bar stays bottom-centred
(shorter). **Pad:** becomes a **taskbar-style dock** — a rounded `surface-container` bar holding the four favorites,
a divider, up to 2 recent apps, and an "All apps" grid button; the search bar moves to the top of the home.
Laptops/desktops: the same **full-width taskbar** along the bottom of the full page, with Back / Home / Recents at its
right end (3-button is the pointer default).

## Accessibility
`nav[aria-label="Favorites"] > ul > li > a`; names "Files, Résumé", "Chrome", "GitHub", "Gmail, new message" (dot
state in the name); roving Left/Right; the search bar is a `button` "Search apps and more" (it opens the dialog);
decorative mic/lens are `aria-hidden`.

## Edge cases
Rotation mid-transform → retarget. Dot clears once Gmail's message is opened. Pad recent-apps area empty → divider hidden.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `AND-FAV-01` | Favorites row: four links, no plate/labels, notification dot state | `e2e: W2 links without JS; dot clears after opening Gmail` | P6 |
| `AND-FAV-02` | Files favorite = résumé fast path | `e2e: Q1 on Android from favorites` | P6 |
| `AND-FAV-03` | Search bar opens the drawer focused, with bar → field morph | `e2e: A1 tap the bar; focus in the field` | P6 |
| `AND-FAV-04` | Landscape column + pad taskbar dock with recents | `e2e: pixel-landscape + tablet` | P6 |
| `AND-FAV-05` | Roving keyboard model + names with state | `cmp: roving + names` | P6 |

## Not like the others
Icons sit **directly on the wallpaper with a tonal search bar beneath** and show a **dot**, not a number (iOS Dock: a
blurred plate, numeric badges, no search bar; desktops: Dock/taskbar with running state).
