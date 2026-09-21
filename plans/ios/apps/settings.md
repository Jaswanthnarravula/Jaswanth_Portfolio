# iOS / apps — Settings

## Role + requirement refs
Preferences, accessibility & motion, privacy and legal notices, Switch OS. `A11Y-PREF-01`, `ASSET-LEGAL-01`,
`ANL-NOTICE-01`. `AppRole: settings` · slug `settings`.

## Portfolio mapping
The top "Apple ID"-style cell shows `person.name` + headline → **About** screen with portfolio facts
(`person`, `resume.updated`), easter eggs found, legal notices.

## Anatomy
Full-screen, **inset-grouped lists** (sections with 10 pt radius on a grouped background), large title "Settings",
search field on pull. Rows 44 pt+: tinted rounded-square glyph (29 pt) · label · value/chevron/switch.

| Section | Rows |
|---|---|
| Profile cell | Jaswanth · headline → About |
| — | **Switch Operating System** (chevron → list of released OSes + Back to chooser) · **Take the Tour** |
| Display | Appearance: Light / Dark / Automatic (pushed radio list with preview tiles) · Text Size (slider, 100–130 %) |
| **Accessibility** | Reduce Motion (switch) · Reduce Transparency (switch) · Increase Contrast (switch) · Single-key Shortcuts (switch) · Open Plain Portfolio (link) |
| Sounds | UI Sounds (switch) · Volume (slider) · Play Intro Sound (button) |
| Privacy | Analytics — what is counted; DNT/GPC status; "No cookies" |
| General → About | Name, Role, Location, Résumé updated, Version (`contentRev`), **Easter eggs found n / N**, **Legal Notices** (pushed `LegalNotice`) |

## Behaviour & states
Switches apply instantly (`SET_PREF`), persist, and update `<html>` attributes. Pushed screens use the standard nav
stack with the back chevron labelled "Settings". Search filters rows across all screens and pushes to the match with
a brief row highlight. The same prefs are mirrored in Control Center.

## Navigation & routes
`/ios/settings` only; the pushed path is session state.

## Motion
Push/pop per lifecycle; switch thumb spring r 0.25 ζ 0.9; row highlight fades 600 ms (instant under reduced motion).

## Responsive
Pad: split view (settings list · detail). Landscape phone: single column, wider margins. Sliders are native range
inputs; text-size changes scale `rem`.

## Accessibility
Sections are headed lists; switches are `button[role="switch"]` with visible labels; radio lists for Appearance;
sliders are native with `aria-valuetext`; legal text is a readable document; every row ≥ 44 pt.

## Edge cases
System prefers reduced motion but the visitor enables motion here → visitor wins, footnote explains. Storage
unavailable → footnote "Changes last for this visit".

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `IOS-SET-01` | Inset-grouped Settings with profile cell, search-on-pull, pushed screens | `e2e: I1 navigation; search pushes to a match` | P5 |
| `IOS-SET-02` | Accessibility/Display/Sounds controls apply instantly + persist; mirrored in Control Center | `e2e: A11Y-PREF-01; toggle in one reflects in the other` | P5 |
| `IOS-SET-03` | Switch Operating System + Tour rows | `e2e: switch parks the session; tour starts` | P5 |
| `IOS-SET-04` | About: facts, eggs counter, Legal Notices; Privacy screen | `e2e: ASSET-LEGAL-01 + ANL-NOTICE-01 reachable` | P5 |
| `IOS-SET-05` | Pad split view; semantics | `e2e: ipad; X1 axe clean` | P5 |

## Not like the others
**Inset-grouped lists with tinted glyph tiles and a profile cell on top** (Android Settings: Material list with a
search bar at the top and large category rows; Windows: NavigationView + expander cards; macOS: sidebar panes).
