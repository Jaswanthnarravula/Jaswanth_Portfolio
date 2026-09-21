# macOS / surfaces — Menu bar

## Role + requirement refs
The global bar at the top: Apple menu, the **focused app's** name and menus, and status items. It is the
clearest single tell that this is macOS. R16, R25.

## Portfolio mapping
App menus expose real navigation: e.g. Finder → Go → Experience / Education / Résumé; GitHub → View → each
project. Status area exposes the résumé fast path (`RES-IDIOM-01`).

## Anatomy (24 px tall; 28 px on coarse pointers)
`[]  [AppName]  File  Edit  View  Go  Window  Help ……… [Résumé] [🔍 Spotlight] [Control Center] [Tue 9:41 AM]`
- **Apple menu:** About This Mac (`EGG-ABOUT-01`) · System Settings… · — · **Switch Operating System…** ·
  Take the Tour · — · Lock Screen (returns to lock) · Restart… (replays boot, for fun, confirm sheet).
- **App menu (bold):** About {App} · Settings… · — · Hide {App} · Hide Others · Show All · — · Quit {App}.
- **Per-app menus** are declared by each app file (`apps/*.md`) as data: `{ label, items: [{label, action,
  shortcutHint?, disabled?}] }`. `Window` always has Minimize, Zoom, Move, Size, Center, — , list of open windows.
  `Help` has Keyboard Shortcuts (`?`) and "Skip to plain portfolio".
- **Status items:** Résumé (document glyph → Open / Download) · Spotlight · Control Center (sound, reduce motion,
  reduce transparency, theme, **Switch OS**) · clock (`<time>`, click opens Notification Center).
- Material: `--material-chrome` vibrancy; text 13 px, weight 600 for the app name.

## Behaviour & states
- Menus open **instantly** (0 ms) on press; while one is open, hovering another title switches menus.
- Item highlight = accent fill; selection blinks once (60 ms) then the menu fades (130 ms).
- Disabled items are shown dimmed (e.g. Zoom when no window). Shortcut hints are **labels only**, showing our real
  bindings (Alt+Shift+…), never fake ⌘ combos that the browser would swallow.
- No window focused → app name shows "Finder" (as on a real Mac) with Finder's menus.
- Clicking outside / Esc closes; focus returns to the invoking title.

## Navigation & routes
Menu actions dispatch kernel actions; only those that change the focused location touch history (per `shared/05`).

## Motion
Open 0 ms; close fade 130 ms; blink 60 ms. Reduced motion: no blink.

## Responsive
`compact`: collapses to ` · AppName ▾ (single menu containing the app's menus as submenus) ……… Résumé · 🔍 ·
Control Center`. Clock hides below 360 px. Menus become full-width sheets from the top with 44 px rows.

## Accessibility
`role="menubar"` with APG behaviour via the `Menubar` primitive: Left/Right between titles, Down/Enter opens,
Esc closes to the title, type-ahead, Home/End. One tab stop. In compact mode it is a single menu button. Status
items are a separate `group` "Status menus". Clock is never a live region.

## Edge cases
Menu open while its app closes → menu closes, focus to the Apple menu title. Very long project lists in a menu →
submenu with max height + scroll. Menu open during OS switch → closed by the epoch bump.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `MAC-MENU-01` | Static bar with Apple menu, app name, status items | `e2e: M3/M2 bar renders; app name = Finder with no window` | P2 |
| `MAC-MENU-02` | Menus follow the focused app (data-driven per app) | `e2e: M2 focusing GitHub swaps menus` | P3 |
| `MAC-MENU-03` | Instant open, hover-switch, blink + fade close | `e2e: M2 hover switches menus while open` | P3 |
| `MAC-MENU-04` | APG menubar keyboard model | `cmp: MenuBar APG keys, Esc restores focus` | P3 |
| `MAC-MENU-05` | Apple menu items (About, Settings, Switch OS, Tour, Lock, Restart) | `e2e: each item performs its action` | P3 |
| `MAC-MENU-06` | Status items: Résumé, Spotlight, Control Center, clock | `e2e: Q1 résumé from menu bar; control center toggles persist` | P3 |
| `MAC-MENU-07` | Compact collapse to a single menu | `e2e: M3 at 390 px` | P3 |
| `MAC-MENU-08` | Shortcut hints show real bindings only | `unit: hints come from keymap registry` | P3 |

## Not like the others
A **global** bar whose menus belong to the focused app (Windows: no global menu; commands live in each window).
Menus appear with zero animation (Windows flyouts animate 167 ms; Android menus grow with emphasized easing).
