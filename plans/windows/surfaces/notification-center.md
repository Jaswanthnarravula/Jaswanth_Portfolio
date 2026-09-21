# Windows 11 / surfaces — Toasts, Notification Center and Quick Settings

## Role + requirement refs
Bottom-right toast notifications, the Notification Center + calendar flyout (from the clock), and the Quick Settings
flyout (from network/volume). R18, R25. Every toast also lands in the Center (WCAG 2.2.1).

## Portfolio mapping
Deterministic, identical for every visitor:

| Trigger | Toast | Actions |
|---|---|---|
| First desktop after sign-in (once per session) | "Welcome — press Start or Ctrl/Cmd+K to find anything." | Open Start |
| Tour offer (`shared/20`) | "New here? Take a 20-second tour." | Start tour · Not now |
| **Continuity offer** (`shared/16`) | "Continue from {OS}" · {title} | Open · Dismiss |
| Résumé downloaded | "Résumé.pdf — Download complete" | Open file · Show in folder |
| Email copied (Outlook) | "Copied to clipboard" | — |
| Offline / online | "You're offline — content still works" | — |

## Anatomy
**Toast:** 364 px wide Acrylic card, 8 px radius, 16 px above the taskbar at the right edge; header row (app glyph ·
app name · "now" · ⋯ · ✕), title (14/600), body, up to two full-width buttons. One visible; queue ≤ 3.
**Notification Center** (clock click): right flyout 384 px — notifications grouped by app with "Clear all", and a
collapsible **calendar** below (month grid, today accented; decorative, keyboard navigable).
**Quick Settings** (network/volume click): 360 px flyout of toggle tiles (2 × 3): **Sound** · **Reduce motion** ·
**Reduce transparency** · **Dark mode** · **Night light** (warm tint overlay, cosmetic) · **Switch OS**; a volume
slider; footer: battery-less status + gear → Settings.

## Behaviour & states
- Toast dwell ≥ 6 s, pauses on hover/focus, ✕ or swipe-right dismisses, body click = primary action. Goes to the
  Center however it ends.
- Flyouts toggle from their tray button; outside click/Esc closes; only one tray flyout at a time.
- Quick Settings tiles write `SET_PREF` immediately; tiles show pressed (accent) state.
- Never steals focus when a toast arrives.

## Navigation & routes
No history writes.

## Motion
Toast in: 333 ms slide from the right + fade (entrance curve); out: 167 ms. Flyouts: 167 ms in (translateY 24 px) /
83 ms out. Tile toggle colour 83 ms. Reduced motion: fades.

## Responsive
`compact`: toasts full-width above the taskbar; the tray's single button opens **one combined sheet** (Quick Settings
on top, notifications below, calendar hidden).

## Accessibility
`role="status"` region present from mount. Toast actions are buttons; the Center is a labelled non-modal region with
headings per app; calendar is a `grid` with arrow navigation and is skippable; Quick Settings tiles are
`button[aria-pressed]`; slider is a native `<input type="range">` with a label.

## Edge cases
Toast during drag/Snap preview → queued. Center open when a toast arrives → it appears directly in the list (no
popup). Night light on + high contrast → tint disabled.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `WIN-NOTIF-01` | Toast component, queue, dwell ≥ 6 s, pause on hover/focus | `cmp: region pre-exists; hover pauses` | P4 |
| `WIN-NOTIF-02` | Trigger table incl. continuity toast | `unit: trigger → toast mapping; e2e: C1 with Windows as target` | P4 |
| `WIN-NOTIF-03` | Notification Center + calendar flyout keeps every toast | `e2e: N2 dismissed toast present in the Center` | P4 |
| `WIN-NOTIF-04` | Quick Settings tiles wired to prefs (sound, motion, transparency, theme, Switch OS) | `e2e: tile toggles persist and apply` | P4 |
| `WIN-NOTIF-05` | Motion (333/167, 167/83) + reduced-motion fades | `e2e: R1` | P4 |
| `WIN-NOTIF-06` | Never steals focus; semantics for tiles, slider, calendar | `e2e: X1 with each flyout open` | P4 |
| `WIN-NOTIF-07` | Compact combined sheet | `e2e: N3` | P4 |

## Not like the others
Toasts rise at the **bottom-right** with a header row and full-width buttons; **Quick Settings is separate** from the
Notification Center, which shares a flyout with the **calendar** (macOS: top-right banners, Center from the clock,
Control Center in the menu bar; Android: one shade holds both notifications and Quick Settings).
