# iOS / surfaces — Lock Screen

## Role + requirement refs
A one-time welcome whose notifications are shortcuts straight into apps. N7, R38. **First chooser entry per session
only**; never on deep links, refresh, `/go` or re-entry; identical for every visitor.

## Portfolio mapping
`person.name`, `person.headline`, `person.openTo`; notification targets via `sectionOwner`.

## Anatomy
Wallpaper (sharp) · date line (20 pt, semibold) above a **large clock** (≈ 96 pt, light rounded weight; `<time>`, not
live) · a small inline widget row under the clock ("Open to work" pill) · **notification stack anchored to the bottom**
(above two round quick buttons: **Résumé** left, **Contact** right — standing in for flashlight/camera) · home
indicator with "Swipe up to open".

| # | Notification (material `thin`, 22 pt radius, app icon 38 pt) | Opens |
|---|---|---|
| 1 | Files · "Résumé ready to view" · "Updated {resume.updated}" | `/ios/files/resume` |
| 2 | GitHub · "{n} projects" · "{featured project} and more" | `/ios/github` |
| 3 | Mail · "{person.openTo}" · "Say hello" | `/ios/mail` |
A continuity offer replaces #3 when present. More than 3 → collapses into a stack with "+N".

## Behaviour & states
- **Unlock:** swipe up from the bottom (interactive, 1:1, velocity-projected) · tap the home indicator · any key ·
  the explicit "Open" button. The lock content slides up and fades; Home Screen icons fly in (`IOS-BOOT-01`).
- **Tap a notification** → unlocks and opens that app, flying out **from the notification's rect**.
- **Swipe a notification left** → reveals "Clear"; it remains in Notification Center.
- Quick buttons: long-press feel (press-and-hold 300 ms with a scale-up), or a normal click/Enter.
- No passcode/Face ID pane (would imply a gate). Never auto-dismisses. Sets `session.lockSeen = true`.

## Navigation & routes
No history for the lock itself. Notification → `OPEN_APP` + push.

## Motion
Unlock slide: spring r 0.45 ζ 0.9 inheriting drag velocity. Notification press: scale 0.97. Reduced motion: crossfade.

## Responsive
Phone portrait: as above. Phone landscape: clock left, notifications right. Pad: clock top-left, notifications in a
420 pt column at the left-centre. Laptops/desktops: same as pad, over the full-page wallpaper.

## Accessibility
`<main>` + `<h1>` "Jaswanth — {headline}"; explicit **"Open iOS"** button (focus starts here); notifications = `ul` of
links with full names; "Clear" is a button revealed on focus as well as swipe; quick buttons are links named
"Résumé" and "Contact". Esc/Enter open.

## Edge cases
Deep link → never shown. Drag up then back down → stays locked (projection). Missing section → notification omitted.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `IOS-LOCK-01` | Lock layout: large clock, bottom notification stack, quick buttons | `cmp: notifications derive from fixture` | P5 |
| `IOS-LOCK-02` | Appearance rules | `e2e: D1 + reload + re-entry show no lock screen` | P5 |
| `IOS-LOCK-03` | Unlock by interactive swipe, tap, key or explicit button | `e2e: all four unlock; cancelled drag stays locked` | P5 |
| `IOS-LOCK-04` | Notification = shortcut; app flies out from its rect | `e2e: tap → app open, URL correct` | P5 |
| `IOS-LOCK-05` | Identical for every profile | `unit: content independent of PersonaId` | P5 |

## Not like the others
**Large top clock, notifications stacked from the bottom, swipe-up to open, round quick buttons** (Android: similar
idea but Material cards, clock style differs and At-a-glance line; desktops: click-through lock/sign-in screens).
