# Windows 11 / surfaces — Context menus

## Role + requirement refs
Windows 11-style right-click menus: rounded Acrylic, an **icon command row** at the top, and "Show more options".
R18, R25, B10.

## Portfolio mapping
Same actions available elsewhere (open, properties, copy link, download) — never the only path.

## Menus

| Target | Command row (icon buttons) | Items |
|---|---|---|
| Desktop (empty) | — | View ▸ (Large/Medium/Small icons — resizes desktop icons) · Sort by ▸ (Name / Type; cosmetic reorder) · Refresh (replays a 1-frame icon blink — authentic) · — · Display settings · Personalize · — · **Switch operating system** |
| Desktop icon / Explorer row | Copy link · Share (copy canonical `/go/*`) · Download (résumé only) | Open · Open in new window (disabled) · — · **Properties** (dialog: type, location, dates, stack) · — · Show more options ▸ (legacy menu: Open · Copy as path · Properties) |
| Taskbar app button | — | Jump list (`WIN-TASK-04`) |
| Taskbar (empty) | — | Taskbar settings · Show desktop |
| Title-bar icon | — | System menu (`WIN-WM-11`) |
| Text / inputs / Terminal | — | **native browser menu** |

## Anatomy
Acrylic, 8 px radius, 1 px stroke, flyout shadow; command row 40 px tall with 32 px icon buttons + tooltips; items
32 px (40 px coarse) with a 16 px Fluent glyph left, label, right-aligned shortcut hint or submenu chevron; hover =
subtle fill with 4 px radius inset; separators 1 px.

## Behaviour & states
- Invoke: `contextmenu` event (right-click, Shift+F10, Menu key) · long-press 500 ms · visible "⋯" on the selected item.
- Positioned at the pointer, flipped/clamped inside the workspace above the taskbar.
- Animates in (167 ms scale-Y from the pointer edge + fade); closes 83 ms; outside press/Esc/Tab/scroll closes →
  focus returns to the invoker.
- "Show more options" replaces the menu content in place with the legacy-style list (smaller rows, no command row).
- Right-click on an unselected icon selects it first.

## Navigation & routes
Ordinary kernel actions; Copy link writes the canonical URL and raises a toast.

## Motion
Per above; submenus 167 ms after a 150 ms hover intent. Reduced motion: instant.

## Responsive
Coarse: 40 px rows, command row 48 px; `compact`: bottom sheet if it cannot fit.

## Accessibility
`role="menu"` (`Menu` primitive); the command row is a `group` of `menuitem` icon buttons with text names
(tooltips mirror the names); APG keys; submenu Right/Left. No global override.

## Edge cases
Menu open during Snap preview → closed. Clipboard blocked → Properties dialog shows the link selected. Desktop icon
size change persists in the session only.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `WIN-CTX-01` | Menu component with command row, glyph items, clamped positioning | `cmp: clamps at corners; command row names` | P4 |
| `WIN-CTX-02` | Menus per target incl. View/Sort/Refresh and Properties dialog | `e2e: N2 each target's items act` | P4 |
| `WIN-CTX-03` | "Show more options" legacy swap | `e2e: swap in place, Esc returns` | P4 |
| `WIN-CTX-04` | Three invocations + native menu preserved on text/Terminal | `e2e: Shift+F10, long-press, ⋯; Terminal shows browser menu` | P4 |
| `WIN-CTX-05` | APG menu semantics incl. command-row group | `cmp: Menu APG suite` | P4 |

## Not like the others
A **command row of icon buttons**, glyphs on every item, animated open, and a nested **"Show more options"** legacy
menu (macOS: dense text-only rows that appear instantly; iOS: blurred quick-action sheet; Android: shortcuts popup).
