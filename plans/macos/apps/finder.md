# macOS / apps — Finder

## Role + requirement refs
The file manager: **experience** and **education** exist as folders and files; it also reaches the résumé and
projects by alias. R16, R23, R24. `AppRole: files` · slug `finder` · owns `experience`, `education`.

## Portfolio mapping
Virtual file tree built by selector (same source as the Linux VFS, `linux/03-filesystem.md`):
```
Jaswanth (home)
├─ Experience/        {company} — {role}.rtfd   ← ExperienceDetail
├─ Education/         {school}.rtfd             ← EducationList item
├─ Projects  (alias → GitHub app)
├─ Résumé.pdf (alias → Preview)
└─ About Jaswanth.webloc (alias → Safari)
```
Content views: `ExperienceList`, `ExperienceDetail`, `EducationList` (`shared/03`).

## Anatomy
Window 920 × 560 default (min 560 × 360). Toolbar 52 px: back/forward chevrons · folder title · view switcher
(Icons / List / **Columns** default / Gallery off) · search field (scopes Spotlight to files). Sidebar 180 px
(vibrancy): Favourites — Jaswanth, Experience, Education, Projects, Résumé; Locations — Macintosh HD. Path bar at the
bottom. Status bar "N items".
**Column view:** columns 220 px; the last column is a **preview column** showing the selected role as
`ExperienceDetail` (company, role, dates, highlights, stack tags) with an "Open" button.

## Behaviour & states
| State | Behaviour |
|---|---|
| Select (single click) | Row highlights (accent when window active, grey when inactive); preview column updates; location → `/macos/finder/experience/{slug}` |
| Open (double-click / Enter) | Folder: navigates in. Role file: opens a **document view** inside the same window (full-width `ExperienceDetail`). Alias: opens the target app |
| Space | Quick Look panel (centred sheet with the same detail view); Space/Esc closes |
| Back / Forward | In-window nav stack (`NavStack`); mirrors browser Back via `go()` collapse |
| List view | Sortable columns: Name · Role · Dates · Location (sort is session state) |
| Loading | Skeleton rows (no spinner) while the app chunk resolves |
| Empty folder | "No items" centred (e.g. no education entries yet) |
| Search in toolbar | Filters current folder live; Enter opens Spotlight with the query |

## Navigation & routes
`/macos/finder` (home) · `/macos/finder/experience` · `/macos/finder/experience/{slug}` · `/macos/finder/education`
· `/macos/finder/education/{slug}`. Selection changes the URL with `go()`; view mode/sort don't.

## Menu-bar menus (data for `menu-bar.md`)
File: New Finder Window (focuses) · Get Info · Quick Look · Close Window. View: as Icons/List/Columns · Show Path
Bar · Show Status Bar. Go: Back · Forward · Experience · Education · Projects · Résumé · Home.

## Motion
Column push 200 ms `0.2,0.9,0.3,1` (new column slides from the right; `transform` only). Quick Look scales from
the row rect (220 ms). Document view crossfades 160 ms.

## Responsive
`medium`: sidebar collapsible, two columns. `compact`: single-column drill-down list (sidebar becomes the first
level), back chevron in the toolbar, preview becomes the document view; 44 px rows.

## Accessibility
Sidebar = `nav` "Favourites" list. Columns = a `tree`-free pattern: each column is a `listbox`-less `ul` of links
with roving tabindex; Right/Enter drills in, Left goes back (documented in the shortcuts dialog). List view is a
real `<table>` with sortable header buttons (`aria-sort`). Quick Look is a modal `dialog`. Content headings start
at `h3` (window title is `h2`).

## Edge cases
Deep link to a removed slug → opens the parent folder. Window narrower than two columns → horizontal scroll inside
the columns area only. Very long highlights → preview column scrolls independently.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `MAC-FIND-01` | Window with sidebar, toolbar, column view fed by selectors | `e2e: M2 Experience lists roles from data` | P2 |
| `MAC-FIND-02` | Select → preview column + URL; open → document view | `e2e: D1 /macos/finder/experience/{slug} restores selection` | P2 |
| `MAC-FIND-03` | Back/Forward nav stack tied to history collapse | `e2e: H1 in-app back equals browser Back` | P2 |
| `MAC-FIND-04` | Icons / List (sortable table) / Columns views | `cmp: aria-sort toggles; view persists in session` | P3 |
| `MAC-FIND-05` | Quick Look (Space) | `e2e: M1 Space opens, Esc closes, focus returns to the row` | P3 |
| `MAC-FIND-06` | Aliases open the right apps | `e2e: Projects alias opens GitHub; Résumé opens Preview` | P3 |
| `MAC-FIND-07` | Compact drill-down layout | `e2e: M3 at 390 px` | P2 |
| `MAC-FIND-08` | Empty/loading states | `cmp: empty folder + skeleton` | P3 |
| `MAC-FIND-09` | Menu-bar menus wired | `e2e: Go → Education navigates` | P3 |

## Not like the others
**Column view with a preview column**, sidebar vibrancy, Quick Look on Space (Windows Explorer: ribbon-less command
bar, details pane, breadcrumb address bar, no columns; iOS/Android Files: touch list with Browse tabs and bottom
sheets).
