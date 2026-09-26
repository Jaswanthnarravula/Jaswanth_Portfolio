# Windows 11 / apps — GitHub

## Role + requirement refs
**Projects**, as a Fluent-styled desktop app. R22, R23, R24, N8. `AppRole: github` · slug `github` · owns `projects`.

## Portfolio mapping
`ProjectList`, `ProjectDetail`, `getProjectsWithGithub()` — identical data and rules to every other OS's GitHub app
(`shared/17`): résumé data decides which projects exist; GitHub enriches.

## Anatomy
Window 1040 × 680 (min 600 × 420). Mica title bar with the GitHub mark and an in-title **search box** (filters
projects). Left: **NavigationView rail** (48 px collapsed / 240 px expanded via the hamburger): Overview ·
Repositories · Stars (decorative count) · — · each featured project. Selected item = 3 px accent bar.
- **Overview page:** profile card (initials, name, headline, stats if available) · "Pinned" as **cards in a 3-column
  grid** (1 px stroke, 8 px radius: name, tagline, language dot, ★, year) · contribution heatmap card.
- **Repositories page:** list with chips (stack filters) and a Sort ▾.
- **Project page:** breadcrumb header (`Repositories › {project}`), **Pivot** tabs: README · Stack · Links; right
  info card (year, language bar, topics, pushed, stars/forks); InfoBar at top if the project is archived.

## Behaviour & states
| State | Behaviour |
|---|---|
| Open project | Card/row → project page; URL → `/windows/github/{slug}`; Back arrow in the title bar returns |
| Rail | Hamburger toggles expanded/collapsed (session state); collapsed shows glyphs with tooltips |
| Filters / sort | Session state |
| External links | New browser tab, `rel="noopener noreferrer"`, ↗ glyph, "opens in new tab" |
| No GitHub data | Stats/heatmap cards absent |
| Loading / empty filter | Skeleton cards / "No repositories match" + Clear filters |

## Navigation & routes
`/windows/github` · `/windows/github/{slug}`. Rail page (Overview/Repositories), pivots and filters are session state.

## Motion
Page change: Fluent drill-in (content rises 16 px + fades, 250 ms entrance); Back: drill-out 167 ms. Card hover:
stroke brightens + 2 px lift (83 ms). Pivot underline slides 167 ms.

## Responsive
`medium`: rail collapsed by default. `compact`: rail becomes a bottom-less hamburger overlay; pages are single
column; pivots become a scrollable row.

## Accessibility
Rail = `nav` with a list of links/buttons, selected `aria-current="page"`. Cards are links with full names. Heatmap
`role="img"` + summary + hidden table. Pivots = APG tabs. Title-bar search is a labelled search input.

## Edge cases
Removed slug → Repositories page + InfoBar. Many projects → `content-visibility` on the list. No repo/live → Links
pivot hidden.

## Case study and deep dives (`shared/23-content-depth.md`)
- A project with a `caseStudy` gets a **Case study** pivot after README (README · Case study · Stack · Links). It
  shows the problem and my role as text, each key decision as a **Fluent Expander** (title visible; detail and
  "Rejected: …" inside), and the results as **stroked metric cards** in a wrapping row. Pivots stay session state.
- A project with `deepDives` adds a "Docs" group at the end of the pivot: a list of `{slug}.md` rows (document glyph,
  title, summary). Activating one drills into a document page with the breadcrumb `Repositories › {project} › docs ›
  {slug}.md` and the shared `DeepDiveArticle`; the title-bar back button and Alt+← return to the pivot (the document
  is session state, like the pivots). Drill-in/out reuses the `WIN-GH-05` page motion.
- A11y: expanders are buttons with `aria-expanded` + `aria-controls`; the docs list is a `ul` of links-as-buttons;
  focus lands on the document's heading and returns to the row.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `WIN-GH-07` | Case study pivot (expanders + metric cards) + docs drill-in for deep dives | `cmp: pivot only when caseStudy exists; expander aria-expanded toggles; docs drill-in and back restore focus` | P8 |
| `WIN-GH-01` | App shell with NavigationView rail, title-bar search, Overview cards | `e2e: N2 projects match data` | P4 |
| `WIN-GH-02` | Project page with breadcrumb, pivots, info card | `e2e: D1 /windows/github/{slug}` | P4 |
| `WIN-GH-03` | Enrichment + heatmap card with accessible alternative | `cmp: absent when snapshot empty; axe clean` | P4 |
| `WIN-GH-04` | Filters, sort, rail expand/collapse | `cmp: session state behaviours` | P4 |
| `WIN-GH-05` | Drill-in/out page motion, reversible | `e2e: back mid-transition lands cleanly` | P4 |
| `WIN-GH-06` | Compact layout | `e2e: N3` | P4 |

## Not like the others
**NavigationView rail with an accent selection bar, stroked cards, pivots, InfoBars, drill-in motion** (macOS: sidebar
+ tabs with a title flight; iOS: bottom tab bar and large titles; Android: Material top app bar with chips). The case
study uses **Fluent Expanders and stroked metric cards**; deep dives are a drill-in page (macOS: in-place file view;
iOS: pushed document; Android: full-screen reader).
