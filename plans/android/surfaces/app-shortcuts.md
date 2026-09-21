# Android / surfaces — App shortcuts and long-press menus

## Role + requirement refs
Long-pressing an app icon shows its **app shortcuts**; long-pressing content shows an M3 menu. Every action is
reachable another way. R20, R25, B10.

## Portfolio mapping

| Target | Shortcuts |
|---|---|
| Files | Open résumé · Download résumé · Experience · Education |
| GitHub | one per featured project (max 4) |
| Gmail | Compose · Copy address |
| Chrome | About Jaswanth · Plain version |
| Keep | Skills · each pinned note |
| Settings | Accessibility · Switch OS |
| Content rows (project, role) | M3 menu: Open · Copy link · Share (copy canonical `/go/*`) |

## Anatomy
**Shortcuts popup:** `surface-container`, 28 dp radius (first/last item), 4 dp gaps between item "pills"; each
shortcut row 56 dp: small tonal-circle glyph + label; below them a compact system row: **App info** (ⓘ → Settings →
Apps → that app: version, "Open", legal line) · **Pause app** (hidden) . Appears above/below the icon, aligned to it,
clamped to the safe area. **No blur, no world-dimming** — only a level-3 shadow.
**Content menu:** standard M3 menu (4 dp radius, 48 dp rows, leading icons optional).

## Behaviour & states
- **Invoke:** long-press 500 ms (`LongPress`; movement > 10 dp cancels) · right-click (`contextmenu`) · Shift+F10 /
  Menu key · visible **"⋮" button** on the focused icon/row.
- On fire: the icon scales 1 → 1.1 (150 ms) and the popup grows from the icon (container-style, 200 ms emphasized).
- Tap a shortcut → ripple → popup closes → the app opens at that destination (transform from the **icon**).
- **Back** / Esc / outside tap closes; focus returns to the icon.
- Native context menu preserved in text, inputs and links inside content.

## Navigation & routes
No history for the popup; chosen shortcut follows normal rules (push).

## Motion
Open 200 ms emphasized-decelerate; close 100 ms accelerate; item ripples. Reduced motion: fades.

## Responsive
Flips/clamps near edges; on pad 280 dp wide; in landscape may open sideways.

## Accessibility
`role="menu"` via `Menu` (arrows, Home/End, type-ahead); the system row is a second group in the same menu; "⋮" is
named "{App} shortcuts". Background stays readable (no dimming) but is `inert` while the menu is open.

## Edge cases
Long-press while swiping the drawer → cancelled. Clipboard blocked → dialog with the link selected. App info for an
app whose chunk failed → still opens (Settings page is independent).

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `AND-SHORT-01` | Shortcuts popup (pill rows + App info), data-driven, clamped | `cmp: items derive from fixture; positioning` | P6 |
| `AND-SHORT-02` | Four invocations (long-press, right-click, keyboard, visible ⋮); Back closes | `e2e: all four; goBack() closes` | P6 |
| `AND-SHORT-03` | M3 content menus on rows; native menu preserved in text | `e2e: row menu works; text shows browser menu` | P6 |
| `AND-SHORT-04` | App info page per app in Settings | `e2e: App info opens the right Settings page` | P6 |
| `AND-SHORT-05` | Menu semantics + focus return | `cmp: Menu APG suite with Android skin` | P6 |

## Not like the others
**Pill-row shortcuts with "App info", no blur and no dimmed world** (iOS: the icon lifts, everything blurs, a
spring-scaled menu appears, rows get preview cards; desktops: right-click context menus).
