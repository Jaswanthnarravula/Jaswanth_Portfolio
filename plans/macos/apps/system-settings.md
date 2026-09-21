# macOS / apps — System Settings (and About This Mac)

## Role + requirement refs
Preferences, accessibility & motion controls, privacy and legal notices, and the way to switch operating systems.
R43 (`A11Y-PREF-01`), `ASSET-LEGAL-01`, `ANL-NOTICE-01`, `EGG-ABOUT-01`. `AppRole: settings` · slug `settings`.

## Portfolio mapping
"About This Mac" presents Jaswanth as the hardware (egg). General → About lists real portfolio facts
(name, headline, location, résumé updated date) from `person`/`resume`.

## Anatomy
Window 780 × 620 (min 560 × 420, not resizable horizontally below 560). Sidebar 220 px with a search field and
panes; content pane with grouped rounded lists (inset-grouped style), 13 px labels, switches right-aligned.

| Pane | Controls |
|---|---|
| **Appearance** | Theme: System / Light / Dark · Accent colour (6 swatches) · Wallpaper variant |
| **Accessibility** | Reduce motion · Reduce transparency · Increase contrast (forces solid + glyphs) · Larger text (100/115/130 %) · Single-key shortcuts on/off · "Open plain portfolio" |
| **Sound** | UI sounds on/off · volume · "Play intro sound again" |
| **Desktop & Dock** | Magnification on/off · Dock size (S/M/L) · Minimize using: Scale (Genie shown disabled with "not available") |
| **Keyboard** | Read-only list of shortcuts from the keymap registry |
| **Privacy** | What analytics are counted; DNT/GPC status; "No cookies" statement |
| **General → About** | Portfolio facts · Easter eggs found n / N · build/version · **Legal notices** (`LegalNotice`) |
| **General → Switch Operating System** | Five OS rows (released only) → `SWITCH_OS` · "Back to chooser" |
| **General → Tour** | Start the guided tour |

**About This Mac** (Apple menu): small non-resizable sheet — monogram, "Jaswanth", Chip: primary stack ·
Memory: {years} years experience · Startup disk: {current role} · Serial: {a date} · [More Info…] → General → About.

## Behaviour & states
Every control writes `SET_PREF` immediately (no Apply button); changes to motion/glass/theme update the `<html>`
data attributes at once and persist in `pf.prefs.v1`. Settings search filters panes and highlights the control.

## Navigation & routes
`/macos/settings` only; the selected pane is session state.

## Menu-bar menus
View: each pane. Window/Help standard.

## Motion
Pane switch crossfade 140 ms; switches animate thumb 160 ms. Reduced motion respected instantly when toggled here.

## Responsive
`compact`: sidebar list → pushed pane (iOS-like drill-down is acceptable here because real macOS Settings does the
same in narrow windows); rows 44 px.

## Accessibility
Sidebar = `nav` list; panes are regions with headings; switches are `role="switch"` buttons with visible labels;
swatches are a radio group with colour names. Legal notice is plain readable text.

## Edge cases
System preference conflicts (e.g. OS says reduce motion, user picks Full) → user choice wins, with a note "Your
system prefers reduced motion". Storage unavailable → settings work for the session with a quiet note.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `MAC-SET-01` | Settings window with panes + search | `e2e: M2 panes render; search highlights a control` | P3 |
| `MAC-SET-02` | Accessibility & motion controls apply instantly and persist | `e2e: A11Y-PREF-01 on macOS` | P3 |
| `MAC-SET-03` | Appearance, Sound, Desktop & Dock prefs wired | `e2e: magnification toggle affects the Dock` | P3 |
| `MAC-SET-04` | Privacy + Legal notices surfaces | `e2e: ASSET-LEGAL-01 + ANL-NOTICE-01 reachable` | P3 |
| `MAC-SET-05` | Switch Operating System + Back to chooser | `e2e: switch parks the session and enters the target` | P3 |
| `MAC-SET-06` | About This Mac egg | `e2e: EGG-ABOUT-01` | P3 |
| `MAC-SET-07` | Semantics: switches, radio swatches, headings | `e2e: X1 axe clean` | P3 |

## Not like the others
Sidebar + inset-grouped panes with instant-apply switches (Windows Settings: NavigationView with breadcrumb headers
and expander cards; iOS: full-screen grouped lists with large titles; Android: Material list with a search bar and
top-level cards; Linux: `settings` command and flags).
