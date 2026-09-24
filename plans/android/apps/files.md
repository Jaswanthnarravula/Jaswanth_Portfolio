# Android / apps — Files

## Role + requirement refs
**Experience, education and the résumé** in a Files-by-Google-style app; the résumé opens in a **PDF viewer
activity**. This app is the Android résumé fast path. R23, R24, N5. `AppRole: files` · slug `files` · owns
`experience`, `education`, `resume`.

## Portfolio mapping
Same virtual tree as every OS: `Internal storage › Jaswanth › Experience/…` · `Education/…` · `Résumé.pdf` ·
shortcuts to GitHub (Projects) and Chrome (About). Views: `ExperienceList`, `ExperienceDetail`, `EducationList`,
`ResumeView`.

## Anatomy
- **Top search bar** (56 dp pill "Search in Files") with the app's menu ☰ (decorative drawer hidden) and avatar initials.
- **Bottom navigation:** **Browse** · **Starred**.
- **Browse:** "Recents" carousel (résumé, last role, last project) → "Categories" as a 2-column grid of **tonal
  cards** (Documents = Résumé · Experience · Education · Projects ↗) → "Storage devices": Internal storage (→ folder tree).
- **Folder view:** small top app bar with ◀, folder name, view toggle (list ⇄ grid), sort ⋮; list items 72 dp:
  leading file-type icon in a tonal square, two lines (name / role · dates), trailing ⋮ (Open · Star · Copy link · Info).
- **Document view (role/school):** reader-style page in `surface`, top app bar with ◀ + Share; `ExperienceDetail`.
- **PDF viewer (résumé):** dark top app bar "Résumé.pdf" with ◀ · search · **Download** · ⋮ (Print · Text version ·
  Copy link); pages on `surface-dim`; page indicator chip "1 / N" bottom-left; **FAB (extended): "Download"**
  bottom-right that shrinks to an icon on scroll.
- **Starred:** Résumé (pre-starred) + anything the visitor stars in the session.

## Behaviour & states
| State | Behaviour |
|---|---|
| Open from favorites/chip | Deep-opens `/android/files/resume`; stack synthesized [Browse, PDF viewer] so **Back** returns to Browse, then the launcher |
| Tap category / folder / file | Forward navigation (shared-axis X) or container transform (card → screen); URL updates |
| Download (FAB / action) | `<a download>`; heads-up "Download complete"; emits `resume_downloaded` |
| Text version | Semantic résumé from data (first in DOM) |
| Star | Session-only toggle with snackbar "Added to Starred" + Undo |
| Info | Bottom sheet: type, dates, stack, canonical link |
| Empty folder | Illustration-free state: "No files here" |

## Navigation & routes
`/android/files` · `/android/files/experience[/{slug}]` · `/android/files/education[/{slug}]` · `/android/files/resume`.

## Motion
Shared-axis X 300 ms for folder drill; container transform for category cards and PDF open (from the file row);
FAB extend/shrink 200 ms; predictive Back throughout.

## Responsive
Phone landscape: PDF fits height; bars auto-hide on tap. **Pad:** navigation rail + list-detail (folder list left,
document/PDF right). Laptops/desktops: same as pad, filling the whole page.

## Accessibility
Bottom nav = `nav` + `aria-current`; categories = `ul` of links; list items are links with full names, trailing ⋮ a
separate button; PDF viewer puts the **text version first in DOM**; Download states type + size; FAB has a text name
in both extended and collapsed states; Info sheet = modal `dialog`.

## Edge cases
The page is always the PDF's page images + text version (shared/03 `VIEW-RESUME-01`). Missing PDF → text version only; FAB hidden. Removed slug →
parent folder + snackbar.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `AND-FILES-01` | Browse (recents, category cards, storage) + Starred via bottom nav | `cmp: derives from fixture` | P6 |
| `AND-FILES-02` | Folder list/grid with sort + item menus; forward navigation + URLs | `e2e: D1 /android/files/experience/{slug}` | P6 |
| `AND-FILES-03` | Document reader view | `cmp: ExperienceDetail in reader chrome` | P6 |
| `AND-FILES-04` | **PDF viewer**: pages, indicator chip, extended FAB Download, Text version | `e2e: Q1 + RES-DL-01 on Android; VIEW-RESUME-01 on pixel` | P6 |
| `AND-FILES-05` | Synthesized stack on deep open; Back → Browse → launcher | `e2e: goBack() sequence` | P6 |
| `AND-FILES-06` | Star with Undo snackbar; Info bottom sheet | `cmp: undo restores; sheet closes on Back` | P6 |
| `AND-FILES-07` | Pad rail + list-detail; semantics | `e2e: tablet; X1 axe clean` | P6 |

## Not like the others
**Search bar on top, category cards, Starred, an extended Download FAB, and Back-driven stacks** (iOS Files:
Browse/Recents tabs, Tags, Quick Look with Done; desktops: Finder/Explorer windows).
