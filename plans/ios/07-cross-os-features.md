# iOS / 07 — Cross-OS features (iOS presentation)

## Role + requirement refs
How iOS presents the shared features. Contracts: `shared/14`, `shared/16`, `shared/20`, `shared/21`,
`04-os-chooser.md`. N5, N9, N10, N14.

## Résumé fast path (`shared/14`)
| Where | Element |
|---|---|
| Dock | **Files** (first Dock icon) opens straight to `/ios/files/resume` (Quick Look) |
| Home Screen | **Résumé widget** (medium) with Open + Download |
| Career folder | "Résumé" shortcut |
| Lock Screen | First notification + the left round quick button |
| Control Center | Résumé module |
| Spotlight zero state | First suggestion |
| Inside any app | Home indicator → Home → Dock (2 actions) — plus the status-bar → Control Center → Résumé path (2 actions); 1 action from Home, Lock, Spotlight and Control Center |

## Continuity offer (`shared/16`)
A **Handoff banner** at the top: "Handoff · {title} — from {OS}". Tap → opens the owning app with a flight from the
banner. Also appears as a card at the left of the **App Switcher** and, when the Lock Screen is showing, as its third
notification. Expires after 10 min or on dismiss.

## Guided tour (`shared/20`)
- **Offer:** banner with Start · Not now.
- **Script:** ① "Every icon is an app — tap one." → open **Safari** · ② "Swipe up (or tap the bar) to go Home." →
  point at the Home indicator → goes Home (app returns into its icon — demonstrates the signature) · ③ "Projects live
  in GitHub." → open **GitHub** → Home · ④ "Your résumé is in the Dock." → point at Files · ⑤ "Pull down to search."
  → point at the Search pill.
- Coach-mark: material `thick` rounded card with a small pointer; highlight ring accent; on touch a pulse ring.
- Restart: Settings → Take the Tour · Control Center Tour module · Spotlight "Start tour" · `?` dialog.

## Easter eggs (`shared/21`)
`EGG-SHAKE-01` (long-press empty Home area 2 s → "No jiggle mode here…" banner) · `EGG-KONAMI-01` with a hardware
keyboard → wallpaper shimmer + banner. Terminal eggs are not available (no terminal on iOS) — Spotlight results for
them point to Linux. Settings → General → About shows the found counter.

## Switch OS
Control Center → **Switch OS** module · Settings row · Spotlight action · Alt+Shift+S. Exit beat: foreground app closes into its icon (fast, 200 ms), icons scale away 1 → 1.15 + fade (the reverse
of the arrival fly-in, ≤ 300 ms total) → `CHOOSE-EXIT-01`.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `IOS-X-01` | Résumé fast path in all listed places | `e2e: Q1 on iOS` | P5 |
| `IOS-X-02` | Handoff banner + switcher card + lock variant | `e2e: C1 with iOS as target` | P5 |
| `IOS-X-03` | Tour offer + iOS script (demonstrates return-to-icon) + restart points | `e2e: T1 on iOS` | P5 |
| `IOS-X-04` | Eggs wired + found counter | `e2e: EGG-SHAKE-01 + Konami increment once each` | P5 |
| `IOS-X-05` | Switch OS entry points + reverse fly-in exit beat | `e2e: each entry point switches; session parked` | P5 |

## Not like the others
Résumé = **Dock app + widget**; continuity = **Handoff banner**; tour teaches **go Home by swiping up**; leaving =
Control Center module (Android: favorites + At-a-glance chip, shade notification, system Back lesson, Quick Settings tile).
