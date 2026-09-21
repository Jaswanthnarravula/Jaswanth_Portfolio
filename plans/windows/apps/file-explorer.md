# Windows 11 / apps — File Explorer

## Role + requirement refs
**Experience** and **education** as folders and files. R18, R23, R24. `AppRole: files` · slug `explorer` · owns
`experience`, `education`.

## Portfolio mapping
Same virtual tree as every OS (selector shared with Finder and the Linux VFS):
`Home › Experience › {Company} - {Role}.docx` · `Home › Education › {School}.docx` · shortcuts: `Projects.lnk`
(→ GitHub) · `Résumé.pdf` (→ Edge PDF tab) · `About Jaswanth.url` (→ Edge). Views: `ExperienceList`,
`ExperienceDetail`, `EducationList`.

## Anatomy
Window 960 × 600 (min 560 × 360), Mica title bar **with tabs** (one tab; "+" is decorative-disabled with tooltip).
Row 2: back / forward / up · **breadcrumb address bar** (`Home › Experience`; each crumb clickable; chevrons open
sibling menus) · search box ("Search Experience"). Row 3: **command bar** (New — disabled · Cut/Copy/Paste —
disabled · **Copy link** · **Share** · Sort ▾ · View ▾ · ⋯ · **Details pane** toggle). Left: **navigation pane**
(Home · Gallery hidden · — · Experience · Education · Projects · Résumé · — · This PC). Centre: **Details list**
(default; columns Name · Role · Dates · Location; sortable headers) or Tiles/Large icons. Right: **details pane**
(toggle) showing `ExperienceDetail` for the selection. Status bar: "N items · 1 item selected".

**Home** page: "Quick access" tiles (Experience, Education, Projects, Résumé) + "Recent" (current role, latest project).

## Behaviour & states
| State | Behaviour |
|---|---|
| Select (single click) | Row gets the rounded selection fill; details pane updates; URL → `/windows/explorer/experience/{slug}` |
| Open (double-click / Enter) | Folder → navigate; role/school file → **document view in the same tab** (full-width detail with a "Back to folder" crumb); shortcut → target app |
| Back / Forward / Up | NavStack; Alt+Left/Right hints are labels only; mirrors browser Back by `go()` collapse |
| Sort / View | Session state; header click toggles `aria-sort` |
| Address bar click | Turns into a text field showing the path `C:\Users\Jaswanth\Experience`; Enter on a valid path navigates; invalid → inline "Windows can't find…" message |
| Search box | Filters the current folder; Enter opens the Search flyout scoped with the query |
| Loading / empty | Skeleton rows / "This folder is empty." |

## Navigation & routes
`/windows/explorer` (Home) · `/windows/explorer/experience[/{slug}]` · `/windows/explorer/education[/{slug}]`.

## Motion
Folder change: list fades 83 ms out / 167 ms in with 8 px rise (Fluent "drill"). Details pane slide 250 ms. No column
push (that is Finder).

## Responsive
`medium`: nav pane collapses to icons; details pane overlays. `compact`: nav pane becomes the first screen (list of
places), drill-down lists with a back arrow in the title row, details = document view; command bar collapses to ⋯.

## Accessibility
Nav pane = `nav` `tree`-less list (flat, so a simple `ul` of links). Details list is a real `<table>` with header
buttons (`aria-sort`), rows selectable with arrows, Enter opens. Breadcrumb = `nav[aria-label="Address"]` `ol`.
Document view headings from `h3`.

## Edge cases
Removed slug → parent folder + info bar "That item is no longer available". Narrow window → columns hide in priority
order (Location, Dates, Role). Typed path with forward slashes or different case → normalized.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `WIN-EXP-01` | Window: tabbed Mica title bar, breadcrumb, command bar, nav pane, details list | `e2e: N2 Experience lists roles from data` | P4 |
| `WIN-EXP-02` | Select → details pane + URL; open → document view in tab | `e2e: D1 /windows/explorer/experience/{slug}` | P4 |
| `WIN-EXP-03` | Back/Forward/Up + breadcrumb crumbs and sibling menus | `e2e: H1 in-app back = browser Back` | P4 |
| `WIN-EXP-04` | Editable address bar with path parsing + error message | `unit: path parser; e2e: invalid path message` | P4 |
| `WIN-EXP-05` | Sortable table + Tiles/Large icons views | `cmp: aria-sort` | P4 |
| `WIN-EXP-06` | Home page (Quick access + Recent from data) | `cmp: derives from fixture` | P4 |
| `WIN-EXP-07` | Shortcuts open the right apps | `e2e: Résumé.pdf opens Edge PDF tab` | P4 |
| `WIN-EXP-08` | Compact drill-down layout | `e2e: N3` | P4 |

## Not like the others
**Breadcrumb address bar you can type a path into, command bar, details list + details pane, tabs in the title bar**
(Finder: column view with a preview column, sidebar vibrancy, Quick Look; mobile Files apps: touch lists with bottom
sheets).
