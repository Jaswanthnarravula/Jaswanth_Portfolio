# Android / surfaces — Lock screen

## Role + requirement refs
A one-time welcome whose notifications are shortcuts into apps. N7, R38. **First chooser entry per session only**;
never on deep links, refresh, `/go` or re-entry; identical for every visitor.

## Portfolio mapping
`person.name`, `person.headline`, `person.openTo`; notification targets via `sectionOwner`.

## Anatomy
Wallpaper with a 20 % scrim · **large two-line clock** at the top-left (hours over minutes, Display size ≈ 140 dp,
`primary` tint from the dynamic palette; `<time>`, not live) · date + **At-a-glance line** under it ("{weekday}, {date}
· Open to work") · **notification cards** (M3: `surface-container-high`, 28 dp radius for the group's outer corners,
4 dp between grouped cards; 40 dp app icon in a tonal circle, title Title-M, body Body-M) · bottom: lock glyph +
"Swipe up to unlock", and two corner shortcuts (left **Résumé**, right **Contact**).

| # | Notification | Opens |
|---|---|---|
| 1 | Files · "Résumé ready to view" · "Updated {resume.updated}" | `/android/files/resume` |
| 2 | GitHub · "{n} projects" · "{featured project} and more" | `/android/github` |
| 3 | Gmail · "{person.openTo}" · "Say hello" | `/android/gmail` |
Continuity offer replaces #3 when present.

## Behaviour & states
- **Unlock:** swipe up anywhere (interactive; content translates and fades with the finger) · tap the lock glyph ·
  any key · explicit "Unlock" button. → launcher arrives with fade-through.
- **Tap a notification** (ripple) → unlocks and opens that app with a container transform **from the card**.
- **Swipe a card sideways** → dismisses it (it remains in the shade's history); ✕ button appears on focus/hover.
- When the clock shares space with many cards, the clock shrinks to a single line (authentic) — CSS only.
- No PIN/pattern pane. Never auto-dismisses. Sets `session.lockSeen = true`.

## Navigation & routes
No history for the lock; notification → `OPEN_APP` + push.

## Motion
Unlock commit: 300 ms emphasized-decelerate (finger velocity shortens the remaining duration, min 150 ms). Card
dismiss: translate + fade 200 ms. Reduced motion: crossfade.

## Responsive
Phone landscape: clock left column, cards right. Pad and laptops/desktops (full page): clock top-left large, cards
in a 420 dp centre column over the full-page wallpaper.

## Accessibility
`<main>` + `<h1>` "Jaswanth — {headline}"; "Unlock" button first; cards = `ul` of links with full names; dismiss
button per card; corner shortcuts are links "Résumé", "Contact". Esc/Enter unlock.

## Edge cases
Deep link → never shown. Partial swipe released below threshold → returns. Missing section → card omitted.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `AND-LOCK-01` | Lock layout: two-line dynamic-colour clock, At-a-glance, grouped M3 cards, corner shortcuts | `cmp: cards derive from fixture; clock collapses with many cards` | P6 |
| `AND-LOCK-02` | Appearance rules | `e2e: D1 + reload + re-entry show no lock screen` | P6 |
| `AND-LOCK-03` | Unlock by interactive swipe, tap, key or button | `e2e: all four; cancelled swipe stays locked` | P6 |
| `AND-LOCK-04` | Card = shortcut with container transform from the card | `e2e: tap → app open, URL correct` | P6 |
| `AND-LOCK-05` | Identical for every profile | `unit: content independent of PersonaId` | P6 |

## Not like the others
**Two-line tinted clock at the top-left, tonal grouped cards, corner shortcuts** (iOS: centred single-line clock,
blurred-material notifications stacked from the bottom, round quick buttons).
