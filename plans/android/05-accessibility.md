# Android / 05 — Accessibility

## Role + requirement refs
Android-specific semantics, keyboard model and focus behaviour. Policy, primitives, shortcuts and focus rules:
`shared/09-accessibility.md`. R43.

## Landmark structure (DOM order = reading order)
1. "Skip the OS: plain portfolio" link
2. `<button>` "Notifications and quick settings" (status bar)
3. `<main>`: hidden `<h1>` "Android — Jaswanth's portfolio" → **Launcher** (At-a-glance group, grid `ul`, "All apps"
   button) → **foreground app** `<section aria-labelledby>` with an `h2` (top app bar title)
4. `<nav aria-label="Favorites">` + search `button`
5. `<nav aria-label="System navigation">` — **Back, Home, Recent apps** as real buttons in both nav modes
6. `role="status"` region (heads-up + snackbars), present from mount
With an app open: launcher + favorites are `inert`; status button, system navigation and the app stay operable.

## Semantics map (Android rows)

| Surface | Element / role | Name | Keyboard |
|---|---|---|---|
| Launcher grid | roving `ul` of links | label | 2-D arrows, Home/End, type-ahead |
| App drawer | modal `dialog`; combobox (with query) / roving grid (empty query) | "All apps" | Back/Esc: clear then close |
| Shade | modal `dialog`; `aria-pressed` tiles, native range, `ul` of cards with Dismiss/Expand | "Notifications and quick settings" | Back/Esc steps 2 → 1 → closed |
| Recents | modal `dialog` + `ul` of buttons | "{App} — {title}" | arrows, Enter, Delete closes |
| Top app bar | `header`: **Back button named "Navigate up"**, title `h2`, action buttons | — | Tab |
| Bottom nav / rail | `nav` with links, `aria-current` | destination names | arrows/Tab |
| M3 tabs | APG `tablist` | tab names | arrows |
| Filter chips | labelled `group` of `button[aria-pressed]` | chip text | Tab/Space |
| FAB | `button` with a persistent text name (extended or not) | "Compose" / "Download" / "New note" | Enter |
| Bottom sheet / dialog | modal `dialog` | title | Back/Esc closes |
| Snackbar | in `status`; action button reachable while visible | text | never essential-only |
| Shortcuts popup / menus | `Menu` | "{App} shortcuts" | APG |
| Switches / radios / sliders | `role="switch"` / `radiogroup` / native range | labels + state text | Space/arrows |

## The Back contract (accessibility view)
Back always does the **smallest** thing: close IME → close menu/sheet/dialog → clear a search query → pop one screen →
leave the app → (on the launcher) nothing. It is available as: a visible button (3-button mode — the default on laptops and
desktops, where it sits in the taskbar / top app bar "Navigate up"), a keyboard key (Esc), the browser's Back, and gestures. Focus after Back returns to the element
that opened the closed layer.

## Keyboard journey that must pass without a pointer (A-keyboard)
Launcher arrows → All apps → type "exp" → open Files at Experience → Navigate up → Back to launcher → favorites:
Files/Résumé → Download via FAB → Esc → status button → toggle "3-button navigation" → Back closes the shade → Recents
button → Delete closes an app → Clear all → Settings → Wallpaper & style → change wallpaper (scheme changes) →
Switch operating system.

## Contrast and preferences
All `on-*`/container pairs are validated ≥ 4.5:1 for each of the 4 schemes × light/dark at build. Launcher labels use
the shadow scrim token. "High contrast text" adds outlines to label text and raises `outline` to `on-surface`.
State is never colour-only: chips get a check icon, tiles show "On/Off", nav items get the indicator **pill shape**.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `AND-A11Y-01` | Landmark structure; inert rules; system navigation always operable | `e2e: X2 ARIA snapshot (launcher and app-open states)` | P6 |
| `AND-A11Y-02` | Android semantics map rows | `e2e: X1 axe clean: launcher, drawer, shade, Recents, app, sheet, dialog` | P6 |
| `AND-A11Y-03` | **Back contract** (smallest step; focus returns to the opener) | `unit: Back resolution order; e2e: focus assertions after each Back` | P6 |
| `AND-A11Y-04` | Keyboard-only journey | `e2e: A-keyboard passes; focus never on body` | P6 |
| `AND-A11Y-05` | Contrast validated for all schemes; non-colour state cues | `unit: palette contrast matrix; cmp: state cues present` | P6 |
| `AND-A11Y-06` | Screen-reader script recorded for release (TalkBack + NVDA) | `release: notes in evidence` | P8 |

## Not like the others
A **system navigation landmark with a real Back button** and a formal *Back contract* (iOS: per-screen back buttons
named after the previous title; desktops: window controls). State cues rely on **shape** (pills, checks), matching M3.
