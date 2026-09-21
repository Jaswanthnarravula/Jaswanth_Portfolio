# macOS / apps — GitHub

## Role + requirement refs
**Projects.** A desktop-app-style GitHub client showing the projects from the portfolio data, enriched with
build-time GitHub stats. R22, R23, R24, N8. `AppRole: github` · slug `github` · owns `projects`.

## Portfolio mapping
`ProjectList`, `ProjectDetail` + `getProjectsWithGithub()` (`shared/17`). Résumé data decides *which* projects
exist; GitHub only enriches them. "More on GitHub" lists up to 6 extra public repos.

## Anatomy
Window 1040 × 680 default (min 600 × 420), dark title bar variant with the GitHub mark.
- **Sidebar (240 px):** profile block (avatar initials, name, headline, followers/repos if available) · filter
  chips by stack · "Repositories" list (featured first).
- **Main — list state:** pinned grid (2 × 3 cards: name, tagline, language dot, ★, year) + contribution heatmap
  (53 × 7 CSS grid, 5 levels, accessible summary) + "More on GitHub".
- **Main — detail state:** breadcrumb `jaswanth / {project}` · tabs **README** (description paragraphs, highlights,
  media) · **Stack** (tags + what each was used for) · **Links** (Repo ↗, Live ↗) · right rail "About" (year,
  language bar, topics, last pushed, stars/forks).

## Behaviour & states
| State | Behaviour |
|---|---|
| Open project | Click a card/row → detail; URL → `/macos/github/{slug}`; back chevron returns to the list |
| Filter chips | Toggle stack filters (session state; "Clear" chip) |
| External links | Open in a new browser tab with `rel="noopener noreferrer"`; marked with ↗ and announced as external |
| No GitHub data | Stats/heatmap simply absent; cards still complete (`GH-OFF-01`) |
| Loading | Skeleton cards |
| Empty filter result | "No projects match these filters" + Clear |

## Navigation & routes
`/macos/github` (list) · `/macos/github/{slug}` (detail). Section segment elided (one owned section). Tabs and
filters are session state.

## Menu-bar menus
File: Close Window. View: Pinned · All Repositories · each project (submenu) · Reload. Repository: Open on
GitHub ↗ · Open Live Site ↗ · Copy Link.

## Motion
List → detail: shared-element `flight()` of the project title + card background into the header (240 ms), content
crossfade 160 ms; reverses on back. Heatmap cells fade in once (stagger capped 300 ms total).

## Responsive
`medium`: sidebar collapsible. `compact`: single column; sidebar content becomes the list header; detail is a
pushed page with a back chevron; tabs become a segmented control.

## Accessibility
Cards are links with full names ("portfolio-os — tagline, TypeScript, 12 stars"). Heatmap: `role="img"` with the
summary label + a visually hidden table alternative. Tabs follow APG. External links say "(opens in new tab)".

## Edge cases
Removed slug → list with a quiet "That project isn't here anymore". 20+ projects → list virtualizes via
`content-visibility`. Project without repo/live → Links tab hidden.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `MAC-GH-01` | App shell: sidebar profile, pinned grid, repository list | `e2e: M2 projects match data` | P3 |
| `MAC-GH-02` | Project detail with README / Stack / Links tabs + About rail | `e2e: D1 /macos/github/{slug}` | P3 |
| `MAC-GH-03` | GitHub enrichment + heatmap with accessible alternative | `cmp: GH-UI-01 axe clean; absent when snapshot empty` | P3 |
| `MAC-GH-04` | Stack filter chips | `cmp: filter + clear` | P3 |
| `MAC-GH-05` | List ↔ detail flight, reversible | `e2e: back mid-flight reverses cleanly` | P3 |
| `MAC-GH-06` | External link treatment | `cmp: rel + announced as new tab` | P3 |
| `MAC-GH-07` | Compact pushed-page layout | `e2e: M3` | P3 |

## Not like the others
A **desktop client with a sidebar and tabs in a window** (iOS GitHub: bottom tab bar, large-title lists, push
navigation; Android: Material top app bar, FAB-less list with chips; Windows: same data in a Fluent-styled window
with a NavigationView rail and Mica title bar).
