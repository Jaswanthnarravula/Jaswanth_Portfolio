# iOS / apps — GitHub

## Role + requirement refs
**Projects**, as the GitHub mobile app. R22, R23, R24, N8. `AppRole: github` · slug `github` · owns `projects`.

## Portfolio mapping
`ProjectList`, `ProjectDetail`, `getProjectsWithGithub()` — same data and rules as every OS (`shared/17`).

## Anatomy
Full-screen app with a **bottom tab bar** (49 pt + inset): **Home** · **Projects** · **Profile**.
- **Home tab:** large title "Home" · "My Work" grouped list (Projects → tab · Résumé → Files · Contact → Mail) ·
  "Favorites" = featured projects as inset rows (icon, name, tagline, chevron) · "Recent" = latest 3.
- **Projects tab:** large title "Repositories" with a search field that appears on pull/scroll-up; filter chips
  (stack); rows: name (17 pt semibold), tagline (15 pt secondary), meta line (language dot · ★ · year).
- **Project detail (pushed):** nav bar with back chevron labelled "Repositories" + share button; header (name,
  tagline, link buttons Repo ↗ · Live ↗); **segmented control** README | Stack | About; content as grouped sections;
  media in a horizontally scroll-snapping strip.
- **Profile tab:** avatar initials, name, headline, stats (if available), **contribution heatmap** (horizontally
  scrollable, newest at the right), "Pinned" grid 2-up.

## Behaviour & states
| State | Behaviour |
|---|---|
| Open project | Row tap → push (350 ms) → URL `/ios/github/{slug}`; edge-swipe / chevron / browser Back pops |
| Tabs | Switch roots; each tab keeps its own stack (session state); tapping the active tab pops to root / scrolls to top |
| Long-press row | Context preview + Open · Copy link (`quick-actions.md`) |
| External links | New browser tab; "opens in new tab" announced |
| No GitHub data | Stats and heatmap absent |
| Loading / empty filter | Skeleton rows / "No repositories" + Clear |

## Navigation & routes
`/ios/github` · `/ios/github/{slug}`. Tab, segment and filters are session state.

## Motion
Push/pop per `IOS-FLIGHT-06` (incl. interactive edge swipe). Large title collapses with scroll (transform-only).
Segmented control thumb spring r 0.3 ζ 1.

## Responsive
Phone landscape: tab bar stays; lists use two columns for "Pinned". **Pad: list-detail split view** (sidebar 320 pt
with Projects, detail on the right; tab bar becomes a sidebar). Laptops/desktops: same split view across the full
page (sidebar 360 px).

## Accessibility
Tab bar = `tablist`-free **`nav` with links + `aria-current`** (tabs here are navigation roots, not an APG tab panel).
Rows are links with full names. Segmented control = `radiogroup`. Heatmap: `role="img"` + summary + hidden table;
horizontal scroll region is keyboard focusable with a label.

## Edge cases
Removed slug → Projects root + inline notice. Deep link to a project → stack is synthesized as [Projects, project] so
the back chevron works. Very long README → collapses with "Show more".

## Case study and deep dives (`shared/23-content-depth.md`)
- A project with a `caseStudy` gets a fourth segment, **Case Study** (README | Case Study | Stack | About). Its body
  is **grouped inset lists**: "The Problem" and "My Role" as text cells, "Key Decisions" as one cell per decision
  (bold title, detail, secondary "Rejected: …"), "Results" as value/label rows (value in the trailing position).
- Deep dives follow as a "Deep Dives" group of **disclosure rows** (title + summary, chevron). A row **pushes** a
  document page onto the Projects tab's stack — large title = deep-dive title, the shared `DeepDiveArticle` below,
  back chevron "‹ {project}" and edge-swipe back. The pushed page is session stack state (like `IOS-GH-02`'s stack),
  not a new URL.
- Motion: the standard push/pop (`ios/03-motion.md`); reduced motion cross-fades.
- A11y: the segmented control stays a radiogroup; disclosure rows are links with "button" hint text; focus moves to
  the pushed page's title and returns to the row on pop.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `IOS-GH-07` | Case Study segment (grouped inset lists) + pushed deep-dive documents | `cmp: segment only when caseStudy exists; a deep-dive row pushes its document; pop returns focus` | P8 |
| `IOS-GH-01` | Tab-bar app: Home, Projects, Profile with large titles | `e2e: I1 tabs keep independent stacks` | P5 |
| `IOS-GH-02` | Pushed project detail with segmented README / Stack / About | `e2e: D1 /ios/github/{slug} synthesizes the stack` | P5 |
| `IOS-GH-03` | Enrichment + scrollable heatmap with accessible alternative | `cmp: absent when snapshot empty; axe clean` | P5 |
| `IOS-GH-04` | Search-on-pull field + stack filter chips | `cmp: filter + clear` | P5 |
| `IOS-GH-05` | Pad split view | `e2e: ipad-landscape list-detail` | P5 |
| `IOS-GH-06` | Navigation semantics (nav + aria-current, radiogroup segments) | `e2e: X1 axe clean` | P5 |

## Not like the others
**Bottom tab bar, large collapsing titles, push navigation with edge-swipe back, segmented control** (Android GitHub:
Material top app bar, chips, bottom navigation with M3 indicators and **system Back**; desktops: sidebar/rail in a window).
The case study is **grouped inset lists** and deep dives are **pushed pages with large titles** (macOS: in-place
file view; Windows: expanders + drill-in; Android: full-screen reader).
