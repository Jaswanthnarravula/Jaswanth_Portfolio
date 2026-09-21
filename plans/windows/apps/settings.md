# Windows 11 / apps — Settings (and winver)

## Role + requirement refs
Preferences, accessibility & motion, privacy and legal notices, Switch OS, and the `winver` egg. `A11Y-PREF-01`,
`ASSET-LEGAL-01`, `ANL-NOTICE-01`, `EGG-WINVER-01`. `AppRole: settings` · slug `settings`.

## Portfolio mapping
System → About shows portfolio facts (`person`, `resume.updated`) as "Device specifications"; winver shows the same
as an About dialog.

## Anatomy
Window 900 × 640 (min 560 × 420), Mica background. Left **NavigationView**: user tile (initials, name, "Local
account") · search box ("Find a setting") · pages. Right: **page header with breadcrumb** (`System › About`, 28 px
Title) + **cards** (1 px stroke, 8 px radius, 68 px rows: glyph · title + description · control on the right;
**expander cards** reveal nested options).

| Page | Cards |
|---|---|
| **System** | About (device specs = portfolio facts; "Easter eggs found n / N"; **Legal notices** expander → `LegalNotice`) · Sound (UI sounds, volume, "Play intro sound") · Notifications (toasts on/off) |
| **Personalization** | Theme: Light / Dark / System · Accent colour (palette grid) · Transparency effects toggle (= `glass`) · Taskbar alignment: **Center** / Left (really moves the taskbar group — authentic) |
| **Accessibility** | Animation effects toggle (= reduce motion) · Transparency effects · Contrast themes (= increase contrast) · Text size slider (100–130 %) with live preview · Single-key shortcuts · "Open plain portfolio" |
| **Privacy & security** | Diagnostics = what analytics count; DNT/GPC status; "No cookies" |
| **Apps** | Installed apps list (the seven apps, with "Open") |
| **Switch operating system** | Released OS cards → `SWITCH_OS` · "Back to chooser" |
| **Tour** | Start the guided tour |

**winver** (`winver` in Search/Terminal): small fixed dialog — original mark (no Windows logo in `original` mode),
"Jaswanth's Portfolio", "Version {resume.updated} (OS Build {contentRev})", licence line "This product is licensed to:
you, the visitor", OK button.

## Behaviour & states
Instant apply (`SET_PREF`), persisted in `pf.prefs.v1`; attributes on `<html>` update at once. Settings search
filters pages and scrolls to + flashes the matching card. Taskbar alignment is stored as a Windows-only pref.

## Navigation & routes
`/windows/settings`; page is session state.

## Motion
Page drill-in 250 ms / out 167 ms; expander 167 ms height via `clip-path` reveal (no height animation); toggle thumb
83 ms. Reduced motion applies immediately when toggled.

## Responsive
`medium`: NavigationView collapses to the hamburger. `compact`: nav list → pushed page; cards full width; rows 48 px+.

## Accessibility
Nav = `nav` list with `aria-current`; cards contain real controls (`role="switch"` buttons, native range, radio
groups); expander = button with `aria-expanded`; breadcrumb `nav`; winver = modal `dialog` with OK focused.

## Edge cases
System prefers reduced motion but user enables animations → user wins, note shown. Text-size slider respects the
browser zoom (multiplies `rem`). Storage unavailable → session-only note.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `WIN-SET-01` | Settings window: NavigationView, breadcrumb headers, cards + expanders, search | `e2e: N2 pages render; search flashes a card` | P4 |
| `WIN-SET-02` | Accessibility page controls apply instantly + persist | `e2e: A11Y-PREF-01 on Windows` | P4 |
| `WIN-SET-03` | Personalization incl. **taskbar alignment Center/Left** | `e2e: toggle moves the taskbar group; persists` | P4 |
| `WIN-SET-04` | Privacy + Legal notices surfaces | `e2e: reachable; content from manifest` | P4 |
| `WIN-SET-05` | Switch operating system page + Back to chooser | `e2e: switch parks the session` | P4 |
| `WIN-SET-06` | winver dialog egg | `e2e: EGG-WINVER-01` | P4 |
| `WIN-SET-07` | Semantics: switches, sliders, expanders, breadcrumb | `e2e: X1 axe clean` | P4 |

## Not like the others
**NavigationView + breadcrumb page titles + stroked expander cards**, and a real **taskbar alignment** option (macOS:
sidebar with inset-grouped panes; iOS: full-screen grouped lists; Android: Material list with a search bar).
