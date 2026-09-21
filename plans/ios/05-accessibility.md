# iOS / 05 — Accessibility

## Role + requirement refs
iOS-specific semantics, keyboard model and focus behaviour. Policy, primitives, shortcuts and focus rules:
`shared/09-accessibility.md`. R43.

## Landmark structure (DOM order = reading order)
1. "Skip the OS: plain portfolio" link
2. `group` "Status bar" (buttons: Notification Center, Control Center)
3. `<main>`: hidden `<h1>` "iOS — Jaswanth's portfolio" → **Home Screen** (`ul` pages of links, widgets as articles,
   folder buttons) → **foreground app** as `<section aria-labelledby>` with an `h2` (its screens' titles are `h3`+)
4. `<nav aria-label="Dock">`
5. `<button>` "Home" (home indicator)
6. `role="status"` banner region (present from mount)
When an app is open, Home Screen and Dock are `inert`; status bar, Home button and the app remain operable.

## Semantics map (iOS rows)

| Surface | Element / role | Name | Keyboard |
|---|---|---|---|
| Home pages | `ul` of links in one roving group | label (+ badge text) | 2-D arrows across pages, Home/End, type-ahead |
| Page dots | buttons | "Page 1 of 2" | Enter |
| Folder | `button[aria-haspopup=dialog]` → modal `dialog` | "Career folder, 5 shortcuts" | Esc closes |
| Widget | `article` + primary link + sibling buttons | heading text | Tab |
| App nav bar | `header` with back **button** named by the previous title | "Back to Repositories" | Enter |
| Tab bar | `nav` with links, `aria-current` | tab names | arrows/Tab |
| Segmented control | `radiogroup` | segment names | arrows |
| Sheet | modal `dialog`; Cancel/Done first | title | Esc = Cancel |
| Action sheet | modal `dialog` with a button list | title | Esc |
| App Switcher | modal `dialog` + `ul` of buttons with ✕ | "{App}" | arrows, Enter, Delete closes |
| Spotlight | modal `dialog` + combobox/listbox | "Search" | per `shared/15` |
| Control Center | modal `dialog`; `aria-pressed` toggles, native ranges | control names | Tab/Space/arrows |
| Banner | in `status` region; actions are buttons; "More" expands | text | never takes focus |
| Quick actions | `Menu` | "{App} actions" | APG |
| Messages thread | `role="log"` | — | chips group of buttons |

## Keyboard journey that must pass without a pointer (I-keyboard)
Home: arrows across the grid and onto page 2 → open the Career folder → Résumé (Quick Look) → Done → Alt+Shift+H Home
→ Ctrl/Cmd+K Spotlight → open a project → segmented control → back button → Alt+Shift+O App Switcher → close an app
with Delete → Control Center via the status-bar button → toggle Reduce Motion → Switch OS.

## Gesture alternatives (all visible or keyboard-reachable)
Swipe pages → dot buttons/arrows · swipe-up Home → Home button/Esc/Alt+Shift+H · pause for switcher → long-press or
Alt+Shift+O (+ App Switcher module in Control Center) · pull-down Spotlight → Search pill/Ctrl+K · pull-down centers → status-bar
buttons · edge-swipe back → chevron button · drag sheet → Cancel/Done · swipe banner → close/"More" buttons · swipe
row actions → long-press/⋯ menu · long-press → `contextmenu` + visible ⋯.

## Focus specifics
Open: focus heading → `inert` Home → animate. Close: pager jump → un-`inert` → focus the originating icon (or folder
button) → animate. Pop: focus the row that pushed the screen. Sheet dismiss: focus the invoking control. Esc goes
**back one level** (sheet → pushed screen → Home), never closes the OS.

## Contrast and preferences
Icon labels on wallpaper use the shadow scrim token; materials collapse to solid under Reduce Transparency;
Increase Contrast darkens separators and adds borders to buttons/toggles; text scales with the Text Size pref + zoom.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `IOS-A11Y-01` | Landmark structure; inert rules with an app open | `e2e: X2 ARIA snapshot (Home and app-open states)` | P5 |
| `IOS-A11Y-02` | iOS semantics map rows | `e2e: X1 axe clean: Home, folder open, app, sheet, Spotlight, Control Center, switcher` | P5 |
| `IOS-A11Y-03` | Keyboard-only journey | `e2e: I-keyboard passes; focus never on body` | P5 |
| `IOS-A11Y-04` | Every gesture's alternative works | `e2e: alternatives checklist script` | P5 |
| `IOS-A11Y-05` | Focus specifics incl. Esc = back one level | `e2e: focus assertions per action` | P5 |
| `IOS-A11Y-06` | Screen-reader script recorded for release (VoiceOver iOS + macOS) | `release: notes in evidence` | P8 |

## Not like the others
Back is an **in-app button named after the previous screen** (Android exposes a system Back; desktops have window
controls). The Home button and status-bar zones are first-class keyboard targets because iOS has no taskbar or menu bar.
