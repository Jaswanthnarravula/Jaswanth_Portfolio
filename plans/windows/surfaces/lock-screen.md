# Windows 11 / surfaces — Lock screen

## Role + requirement refs
One-time welcome that accelerates access through notification shortcuts. N7, R38. **First chooser entry per
session only**; never on deep links, refresh, `/go` or re-entry; identical for every visitor.

## Portfolio mapping
`person.name`, `person.headline`, `person.openTo`; notification targets via `sectionOwner`.

## Anatomy
Full-bleed wallpaper (sharp — Windows lock screens are not blurred) · **clock + date bottom-left** (72 px light
weight time, 20 px date; `<time>`, not live) · bottom-centre hint "Press any key or click to continue" ·
**detailed status cards** bottom-centre-right (max 3, Acrylic, 8 px radius, app glyph + title + body):

| # | Card | Opens |
|---|---|---|
| 1 | Edge · "Résumé ready to view" · "Updated {resume.updated}" | `/windows/edge/resume` |
| 2 | GitHub · "{n} projects" · "{featured project}" | `/windows/github` |
| 3 | Outlook · "{person.openTo}" · "Say hello" | `/windows/outlook` |
A continuity offer replaces card 3 when present.

## Behaviour & states
- Any key / click / upward swipe → the lock content **slides up** and the **sign-in card** appears: avatar circle,
  "Jaswanth", headline, a single **"Sign in"** button (no password/PIN field — it would imply a gate). Enter or
  click → desktop. The two steps take one action each and can be skipped with a second key press immediately.
- Clicking a status card → skips the sign-in card: straight to the desktop with that app opening from the card rect.
- Never auto-dismisses. Sets `session.lockSeen = true`.

## Navigation & routes
No history writes. Card click → `OPEN_APP` + `go()`.

## Motion
Lock slide-up 333 ms `cubic-bezier(0.1, 0.9, 0.2, 1)` with fade; sign-in card fades in 167 ms; desktop reveal: wallpaper
stays, taskbar slides up 250 ms, icons fade 167 ms. Reduced motion: crossfades only.

## Responsive
`compact`: clock centred near the top, cards stacked full-width above the safe area, swipe-up or tap to continue.

## Accessibility
`<main>` + `<h1>` "Jaswanth — {headline}"; explicit **"Continue"** button on the lock layer and **"Sign in"** button on
the card (focus moves to it); cards are a `ul` of links with full names; Esc/Enter both continue.

## Edge cases
Deep link → never shown. Second key press during the slide → completes instantly to the desktop. Missing section →
card omitted.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `WIN-LOCK-01` | Lock layout: bottom-left clock, status cards from data | `cmp: cards derive from fixture` | P4 |
| `WIN-LOCK-02` | Appearance rules | `e2e: D1 + reload + re-entry show no lock screen` | P4 |
| `WIN-LOCK-03` | Two-step continue → sign-in (no credential field), skippable instantly | `e2e: double key press lands on desktop` | P4 |
| `WIN-LOCK-04` | Status card = shortcut that skips sign-in and opens the app | `e2e: card click → window open, URL correct` | P4 |
| `WIN-LOCK-05` | Identical for every profile | `unit: content independent of PersonaId` | P4 |

## Not like the others
Sharp wallpaper, **bottom-left clock**, slide-up to a separate sign-in card (macOS: blurred wallpaper, centred avatar,
single step; iOS/Android: large top clock with a notification list and swipe-up).
