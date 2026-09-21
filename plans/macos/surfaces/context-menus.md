# macOS / surfaces — Context menus

## Role + requirement refs
Right-click (secondary click) menus on the desktop, desktop items, Dock icons, Finder rows and window title bars.
R16, R25, B10 (never hover/right-click only).

## Portfolio mapping
Menus expose the same actions that exist elsewhere (open, get info, copy link, download) — a context menu is never
the only way to do something.

## Menus

| Target | Items |
|---|---|
| Desktop (empty) | New Finder Window · — · Change Wallpaper… (opens Settings → Appearance) · Show View Options (disabled) · — · Switch Operating System… |
| Desktop item / Finder row | Open · Open in New Window (disabled; singleton apps) · — · **Get Info** (small info panel: kind, dates, stack, links) · Quick Look (Space) · — · **Copy Link** (canonical `/go/*` URL) · Download (résumé only) |
| Dock icon | see `dock.md` (`MAC-DOCK-06`) |
| Window title bar | Minimize · Zoom · Move · Size · Center · — · Close |
| Text / inputs / Terminal | **native browser menu** (never overridden — copy/paste must work) |

## Anatomy
`--material-thick` vibrancy, radius 8 px, 5 px padding, rows 22 px (44 px on coarse), 13 px text, accent fill on
highlight, separators 1 px with 5 px vertical margin, submenu chevron right, disabled rows at 35 % opacity.

## Behaviour & states
- **Invoke:** `contextmenu` event (right-click, Ctrl+click, Shift+F10, Menu key, VoiceOver shortcut) · 500 ms
  long-press on touch (`LongPress` primitive) · a visible **"⋯" button** on the selected/focused item.
- Positioned at the pointer, flipped/clamped to stay inside the workspace (never under the menu bar or Dock).
- Opens instantly; item activation blinks once (60 ms) then fades (130 ms).
- Closes on outside press, Esc, Tab, scroll, window blur, or OS switch. Focus returns to the invoker.
- Right-clicking an unselected item selects it first (as on a Mac).

## Navigation & routes
Actions are ordinary kernel actions. Copy Link writes the canonical `/go/*` URL to the clipboard and shows a banner.

## Motion
Appear 0 ms; submenu 0 ms after a 120 ms hover intent; close 130 ms fade. Reduced motion: no blink.

## Responsive
Coarse pointers: 44 px rows, menu anchored above the finger with a 12 px offset, max width 280 px; on `compact`
it becomes a bottom-anchored sheet if it would not fit.

## Accessibility
`role="menu"` via the `Menu` primitive: first item focused on open, arrows, Home/End, type-ahead, Enter/Space,
Right opens submenu, Left/Esc closes it. Disabled items are focusable-skipped but announced as unavailable. Never
a global `contextmenu` override — only on surfaces that own a menu.

## Edge cases
Menu open during rotation/resize → closes. Long-press while scrolling → cancelled (move > 10 px). Clipboard
blocked → Get Info panel shows the link selected for manual copy.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `MAC-CTX-01` | Menu component + positioning/clamping | `cmp: menu stays inside workspace at all four corners` | P3 |
| `MAC-CTX-02` | Menus per target (table above) | `e2e: M2 each target shows its items and they act` | P3 |
| `MAC-CTX-03` | Three invocations: contextmenu event, long-press, visible ⋯ | `e2e: M1 Shift+F10; iPad long-press; ⋯ button` | P3 |
| `MAC-CTX-04` | Native menu preserved on text, inputs, Terminal | `e2e: right-click in Terminal shows the browser menu` | P3 |
| `MAC-CTX-05` | Get Info panel + Copy Link (canonical URL) | `e2e: clipboard contains /go/... URL` | P3 |
| `MAC-CTX-06` | APG menu keyboard model, focus return | `cmp: Menu APG suite` | P3 |

## Not like the others
Dense 22 px rows, instant appearance, vibrancy, selection-first right-click (Windows 11: larger rounded menu with an
icon command row — cut/copy/rename glyphs — and "Show more options"; iOS: long-press quick actions with a blurred
backdrop and haptic-style scale; Android: long-press app shortcuts popup).
