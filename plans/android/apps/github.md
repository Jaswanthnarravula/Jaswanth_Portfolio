# Android / apps — GitHub

## Role + requirement refs
**Projects**, as the GitHub Android app in Material 3. R22, R23, R24, N8. `AppRole: github` · slug `github` · owns
`projects`.

## Portfolio mapping
`ProjectList`, `ProjectDetail`, `getProjectsWithGithub()` — identical data and rules to every OS (`shared/17`).

## Anatomy
- **Bottom navigation bar** (80 dp, 3 destinations with M3 **active-indicator pills**): **Home** · **Projects** ·
  **Profile**.
- **Home:** small top app bar "Home" + search action; "My work" list (Projects · Résumé → Files · Contact → Gmail,
  56 dp items with leading tonal icons); "Favorites" = featured projects as **outlined cards** in a horizontal
  carousel (snap).
- **Projects:** **medium top app bar** "Repositories" that collapses on scroll; a row of **filter chips** (stack);
  list of **elevated/filled cards** (12 dp radius): name Title-M, tagline Body-M, meta row (language dot · ★ · year),
  trailing ⋮.
- **Project detail:** opened by **container transform from the card** → top app bar with ◀ (Back), title, Share;
  header block; **primary tabs** README · Stack · About (M3 tabs with an underline indicator, swipeable); link
  buttons: **filled tonal** "Repository ↗", **outlined** "Live ↗".
- **Profile:** header (avatar initials, name, headline), stats row if available, contribution heatmap (horizontally
  scrollable), "Pinned" 2-up cards.

## Behaviour & states
| State | Behaviour |
|---|---|
| Open project | Card → container transform (300 ms emphasized) → URL `/android/github/{slug}`; **Back** reverses it into the card |
| Bottom nav | Fade-through between destinations; each keeps its scroll; re-tap → scroll to top |
| Tabs | Tap or horizontal swipe (swipe starts inside the 24 px edge rule; tab buttons are the alternative) |
| Chips | Multi-select filters; "Clear" assist chip appears when any is active |
| ⋮ on a card / long-press | Menu: Open · Copy link · Share |
| External links | New tab, "opens in new tab" |
| No GitHub data | Stats/heatmap absent |
| Loading / empty | Skeleton cards / "No repositories match" + Clear |

## Navigation & routes
`/android/github` · `/android/github/{slug}`. Bottom-nav destination, tabs, chips = session state.

## Motion
Container transform (card ↔ detail) 300 ms; predictive Back previews the card list behind. Top app bar collapse is
scroll-linked (transform + opacity). Chip selection: state-layer + check icon fade 100 ms.

## Responsive
Phone landscape: bottom nav stays. **Pad:** bottom nav becomes a **navigation rail** (80 dp, left); Projects uses a
**list-detail** canonical layout (list 360 dp + detail pane); transforms become fade-through inside the detail pane.

## Accessibility
Bottom nav / rail = `nav` with links + `aria-current`. Cards are links with full names; ⋮ is a separate button.
Tabs = APG `tablist` (arrow keys; swipe is optional). Chips = toggle buttons (`aria-pressed`) in a labelled group.
Heatmap `role="img"` + summary + hidden table; its scroller is focusable and labelled.

## Edge cases
Removed slug → Projects + snackbar "That project isn't available". Deep link → stack synthesized [Projects, project]
so Back lands on the list, then the launcher. Long README → "Show more".

## Case study and deep dives (`shared/23-content-depth.md`)
- A project with a `caseStudy` gets a **Case study** M3 tab (README · Case study · Stack · About). The problem and my
  role are body text; each key decision is an **outlined M3 card** (title-medium title, body, "Rejected: …" in
  `on-surface-variant`); results are **filled tonal cards** in a 2-column grid (display-small value, label below).
  The README tab keeps the shared project text **without** the case study (no duplication).
- Deep dives follow as a "Deep dives" list of M3 two-line list items (leading `description` symbol, title, summary).
  A list item opens a **full-screen reader** (M3 full-screen dialog pattern: close ✕ in the top app bar, title,
  shared `DeepDiveArticle`) with the container transform from the list item; **system Back** and ✕ close it back
  into the item — the same mechanism as the Keep note (`AND-KEEP-03`). The reader is session state, not a URL.
- Reduced motion: fade-through instead of the container transform.
- A11y: tabs keep the `AND-GH-03` keyboard model; the reader is a labelled region with focus on its title; closing
  returns focus to the list item.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `AND-GH-07` | Case study tab (M3 cards + tonal result cards) + full-screen deep-dive reader closed by system Back | `cmp: tab only when caseStudy exists; README has no case study; e2e: system Back (navigation bar) closes the reader into its list item` | P8 |
| `AND-GH-01` | M3 app: bottom nav with indicator pills, Home/Projects/Profile | `e2e: destinations keep scroll; fade-through` | P6 |
| `AND-GH-02` | Card → detail container transform; Back reverses into the card (predictive) | `e2e: D1 /android/github/{slug}; goBack() lands on the list` | P6 |
| `AND-GH-03` | Filter chips, card menus, swipeable M3 tabs | `cmp: chips aria-pressed; tabs keyboard model` | P6 |
| `AND-GH-04` | Enrichment + heatmap with accessible alternative | `cmp: absent when snapshot empty; axe clean` | P6 |
| `AND-GH-05` | Pad navigation rail + list-detail layout | `e2e: tablet` | P6 |
| `AND-GH-06` | Semantics | `e2e: X1 axe clean` | P6 |

## Not like the others
**Bottom nav with indicator pills, collapsing medium app bar, filter chips, card → detail container transform,
system Back** (iOS: tab bar, large titles, push with edge-swipe, segmented control; desktops: sidebar/rail windows).
The case study is **M3 outlined + tonal cards**; deep dives open in a **full-screen reader** that system Back closes
(iOS: pushed pages; macOS: in-place file view; Windows: expanders + drill-in).
