# Android / 07 — Cross-OS features (Android presentation)

## Role + requirement refs
How Android presents the shared features. Contracts: `shared/14`, `shared/16`, `shared/20`, `shared/21`,
`04-os-chooser.md`. N5, N9, N10, N14.

## Résumé fast path (`shared/14`)
| Where | Element |
|---|---|
| Favorites row | **Files** (first favorite) opens `/android/files/resume` (PDF viewer) |
| At-a-glance | Smart chip "Résumé ready · Open" |
| Lock screen | First notification + left corner shortcut |
| Quick Settings | **Résumé** tile |
| Drawer suggestions / search zero state | First suggestion |
| Inside any app | Home → favorite (2 actions), or status button → Résumé tile (2 actions); 1 action from launcher, lock, shade, drawer |

## Continuity offer (`shared/16`)
**Silent by design:** the **At-a-glance second line** becomes "Continue: {title}" (chip with the source-OS glyph) and a
card sits in the shade's **Silent** section ("Continue from {OS}" · Open). No heads-up. Lock screen → third card.
Expires after 10 min or on dismiss.

## Guided tour (`shared/20`)
- **Offer:** heads-up notification with Start · Not now.
- **Script:** ① "Apps live in the drawer — swipe up." → opens the **drawer** · ② "Tap any app." → open **Chrome**
  (container transform) · ③ "**Back always takes you back.**" → point at Back (button or edge) → performs Back → app
  returns into the launcher (teaches the core idea) · ④ "Projects live in GitHub." → open **GitHub** → Home · ⑤ "Your
  résumé is in your favorites and At-a-glance." → point at both · ⑥ "Pull down for settings." → point at the status bar.
- Coach-mark: M3 rich-tooltip style (`surface-container`, 12 dp radius, title + body + text buttons Next / End),
  highlight = `primary` outline ring; pulse ring on touch.
- Restart: Settings → Tour · drawer search "Start tour" · `?` dialog · Quick Settings has no tour tile (kept lean).

## Easter eggs (`shared/21`)
`EGG-SHAKE-01` (long-press empty launcher area 2 s → snackbar "No jiggle mode — this is Android. Try long-pressing an
app instead.") · `EGG-KONAMI-01` with a hardware keyboard → the dynamic palette cycles once through the four schemes
(300 ms each) and settles back + heads-up. Terminal eggs are not available (no terminal on Android) — drawer search
points them to Linux. Settings → About phone shows the found counter.

## Switch OS
Quick Settings **Switch OS** tile · shade State-2 power button · Settings item · drawer search action · Alt+Shift+S.
Exit beat: foreground app leaves (fast Back-style 200 ms), launcher content fades through out,
a reverse **circular conceal** (250 ms, ≤ 300 ms total) → `CHOOSE-EXIT-01`. Note: **Back on the launcher never
switches OS**; browser Back from `/android` returns to the chooser because that is what the URL history says.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `AND-X-01` | Résumé fast path in all listed places | `e2e: Q1 on Android` | P6 |
| `AND-X-02` | Silent continuity: At-a-glance line + Silent shade card (+ lock variant) | `e2e: C1 with Android as target; no heads-up fired` | P6 |
| `AND-X-03` | Tour offer + Android script (teaches drawer + **Back**) + restart points | `e2e: T1 on Android` | P6 |
| `AND-X-04` | Eggs wired + found counter | `e2e: EGG-SHAKE-01 + Konami palette cycle increment once each` | P6 |
| `AND-X-05` | Switch OS entry points + circular-conceal exit beat | `e2e: each entry point switches; session parked` | P6 |

## Not like the others
Résumé = **favorite + At-a-glance chip**; continuity is **silent** (At-a-glance + shade); the tour teaches **the
drawer and Back**; leaving is a **Quick Settings tile** (iOS: Dock app + widget, Handoff banner, swipe-up lesson,
Control Center module).
