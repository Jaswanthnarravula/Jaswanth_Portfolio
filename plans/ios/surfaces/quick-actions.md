# iOS / surfaces — Quick actions (long-press menus and context previews)

## Role + requirement refs
The iOS contextual surface: long-pressing an app icon shows quick actions; long-pressing a content row shows a
preview with actions. Every action is also reachable another way. R14, R25, B10.

## Portfolio mapping

| Target | Quick actions |
|---|---|
| Files icon | Open Résumé · Download Résumé · Experience · Education |
| GitHub icon | one row per featured project (max 4) · All Projects |
| Mail icon | New Message · Copy Address |
| Messages icon | Say hello |
| Safari icon | About Jaswanth · Open plain version |
| Notes icon | Skills · each pinned note |
| Settings icon | Accessibility · Switch OS |
| Widgets | Open · Download PDF · Copy link |
| Content rows (project, role) | **Preview card** (title, summary, stack) + Open · Copy link · Share (copy canonical `/go/*`) |

## Anatomy
- **Icon quick actions:** the pressed icon lifts (scale 1.08, shadow) while everything else blurs + dims; a menu
  (material `thick`, radius 14 pt, rows 44 pt, label left + glyph right, hairline separators) appears **above or below
  the icon**, aligned to its nearest edge.
- **Context preview:** the row's content lifts into a rounded preview card (radius 20 pt) centred above the menu.

## Behaviour & states
- **Invoke:** long-press 500 ms (`LongPress`, cancelled by > 10 pt movement) · right-click on pointer devices
  (`contextmenu`) · Shift+F10 / Menu key · a visible **"⋯" button** that appears on the focused icon/row.
- The visual "haptic": a quick scale dip 1 → 0.96 → 1.08 over 180 ms when the long-press fires.
- Tap an action → menu closes → action runs (apps open with a flight from the **icon**, not the menu).
- Tap outside / Esc / swipe down → closes; focus returns to the icon/row.
- Native context menu is preserved in text, inputs and links inside content (copy/paste must work).

## Navigation & routes
Menus write no history; chosen actions follow normal rules.

## Motion
Menu: scale 0.2 → 1 from the icon-side corner, spring r 0.35 ζ 0.75; items fade in 80 ms. Backdrop blur/dim 200 ms.
Close: 200 ms ease-out. Reduced motion: fade only, no scale dip.

## Responsive
Menus flip above/below and clamp within the safe area; on pad they are 250 pt wide; in landscape they may open to the
side of the icon.

## Accessibility
`role="menu"` via the `Menu` primitive (arrows, Home/End, type-ahead, Enter); background `inert`; the preview card is
`aria-hidden` decoration — its information is in the row already. The "⋯" button has the name "{App} actions".

## Edge cases
Long-press while paging the Home Screen → cancelled by movement. Long-press on the Dock in landscape → menu opens
toward the screen centre. Clipboard blocked → "Copy link" opens a small sheet with the URL selected.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `IOS-QA-01` | Icon quick-action menus (lift, blur/dim, anchored menu) with data-driven items | `cmp: items derive from fixture; clamped positioning` | P5 |
| `IOS-QA-02` | Context preview cards on content rows | `e2e: long-press a project row → preview + actions` | P5 |
| `IOS-QA-03` | Four invocations (long-press, right-click, keyboard, visible ⋯) | `e2e: all four open the same menu` | P5 |
| `IOS-QA-04` | Native menu preserved in text/inputs | `e2e: right-click in Notes text shows browser menu` | P5 |
| `IOS-QA-05` | Menu semantics + focus return | `cmp: Menu APG suite with iOS skin` | P5 |

## Not like the others
**Icon lifts, the world blurs, a spring-scaled menu grows from the icon; rows get preview cards** (Android:
app-shortcuts popup with no blur + "App info"; Windows: command-row menus; macOS: dense instant menus).
