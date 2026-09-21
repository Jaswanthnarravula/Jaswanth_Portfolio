# macOS / surfaces — Lock screen (login window)

## Role + requirement refs
A one-time welcome that works as an **accelerator, not a gate**: it shows live "notifications" that are shortcuts
straight into apps. N7, R38. Appears on the **first chooser entry per session only** — never on deep links,
refresh, `/go` or re-entry; identical for every visitor (no per-profile content).

## Portfolio mapping
`person.name`, `person.headline`, `person.openTo`; notification targets resolve through `sectionOwner`.

## Anatomy
Blurred wallpaper (pre-blurred image variant, not a live filter) · large clock + date (top centre, `<time>`, not
live) · avatar circle with initials + "Jaswanth" + headline (centre) · hint "Click or press any key to enter" ·
**notification stack** (bottom-right, max 3 cards).

| # | Notification (app badge · title · body) | Opens |
|---|---|---|
| 1 | Preview · "Résumé ready to view" · "Updated {resume.updated}" | `/macos/preview` |
| 2 | GitHub · "{n} projects" · "{featured project name} and more" | `/macos/github` |
| 3 | Mail · "{person.openTo}" · "Say hello" | `/macos/mail` |
If a continuity offer exists it replaces card 3 (`shared/16`).

## Behaviour & states
- Any click on the background, any key, or Enter on the avatar → **unlock** → desktop.
- Click a notification → unlock **and** open that app in one motion (window opens from the card's rect).
- No password field (it would imply a gate). No timers — it never auto-dismisses.
- Sets `session.lockSeen = true` (`MARK_LOCK_SEEN`).

## Navigation & routes
No history write for the lock screen itself. Notification click → `OPEN_APP` + `go()`.

## Motion
Unlock: content fades + rises 12 px (220 ms), wallpaper blur variant crossfades to the sharp wallpaper (260 ms),
then Dock rises in and menu bar fades in (staggered 60 ms). Reduced motion: single 150 ms crossfade.

## Responsive
`compact`: clock smaller, notifications full-width stack at the bottom above the safe area, tap anywhere to enter.

## Accessibility
`<main>` with `<h1>` "Jaswanth — {headline}"; an explicit **"Enter macOS" button** (not just "press any key");
notifications are a `ul` of links with full text names; focus starts on "Enter macOS". Esc also enters.

## Edge cases
Deep link → lock screen never shown. Notification for an unreleased/missing section → omitted. Reduced motion →
still shown (it is content, not animation) but without motion.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `MAC-LOCK-01` | Lock screen layout with data-driven notifications | `cmp: three notifications from portfolio data` | P3 |
| `MAC-LOCK-02` | Appearance rules (first chooser entry per session only) | `e2e: D1 + reload + OS re-entry show no lock screen` | P3 |
| `MAC-LOCK-03` | Any input unlocks; explicit Enter button | `e2e: key, click and button all unlock` | P3 |
| `MAC-LOCK-04` | Notification = shortcut that unlocks and opens the app | `e2e: click card → app window open, URL correct` | P3 |
| `MAC-LOCK-05` | Identical for every profile | `unit: lock content independent of PersonaId` | P3 |

## Not like the others
Centred avatar + name with notifications bottom-right (Windows: clock bottom-left, swipe/any key up to a sign-in
card; iOS/Android: notification list under a large clock with swipe-up to unlock).
