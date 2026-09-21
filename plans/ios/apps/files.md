# iOS / apps — Files

## Role + requirement refs
**Experience, education and the résumé** in the Files app; the résumé opens in **Quick Look**. This app is the iOS
résumé fast path (Dock). R23, R24, N5. `AppRole: files` · slug `files` · owns `experience`, `education`, `resume`.

## Portfolio mapping
Same virtual tree as every OS: `On My iPhone › Jaswanth › Experience/{Company} — {Role}` ·
`Education/{School}` · `Résumé.pdf` · shortcuts `Projects` (→ GitHub), `About` (→ Safari). Views: `ExperienceList`,
`ExperienceDetail`, `EducationList`, `ResumeView`.

## Anatomy
Bottom tab bar: **Recents** · **Browse**.
- **Browse root:** large title "Browse", search field, "Locations" (On My iPhone), "Favorites" (Experience,
  Education, Résumé), "Tags" (stack tags from data → filter results).
- **Folder view (pushed):** large title = folder name; toolbar ⋯ menu (Icons / **List** default · Sort by Name /
  Date). List rows: document/folder icon, name, secondary line (role · dates), chevron. Icons view: 3-column grid.
- **Document view (pushed) for a role/school:** full-screen "document" — title, meta, highlights as a readable page
  (`ExperienceDetail`), bottom toolbar: Share · Copy link.
- **Quick Look (résumé):** full-screen viewer, nav bar "Résumé.pdf" with **Done** (left) and **Share** (right);
  page content (PDF inline or page images); bottom toolbar: page thumbnails strip · **Download** · "Text version".
- **Recents:** the résumé, last viewed role, last viewed project shortcut (session-derived).

## Behaviour & states
| State | Behaviour |
|---|---|
| Open from the Dock | Deep-opens `/ios/files/resume`: stack synthesized as [Browse, Jaswanth, Quick Look] so Done/back work |
| Tap folder / file | Push; URL updates (`/ios/files/experience/{slug}`) |
| Quick Look Done | Pops to the folder; **swipe-down** on the page also dismisses (interactive) |
| Download | `<a download>`; banner "Résumé.pdf saved"; emits `resume_downloaded` |
| Text version | Semantic résumé from data (first in DOM) |
| Tags | Tapping a tag lists matching roles/projects (projects open GitHub) |
| Long-press row | Preview + Open · Copy link · Share |
| Empty folder | "Folder is Empty" centred |

## Navigation & routes
`/ios/files` (Browse) · `/ios/files/experience[/{slug}]` · `/ios/files/education[/{slug}]` · `/ios/files/resume`.

## Motion
Push/pop per lifecycle. Quick Look opens as a **zoom from the file row** (flight, spring r 0.42 ζ 0.86) and returns
to it. Page strip scroll-snap.

## Responsive
Phone landscape: Quick Look hides bars on tap. **Pad:** sidebar (Locations/Favorites/Tags) + content grid; Quick
Look floats as a large centred sheet. Laptops/desktops: same as pad, filling the whole page.

## Accessibility
Browse sections are headed lists of links. List rows are links ("Acme — Senior Engineer, 2022 to present").
Quick Look = modal `dialog` with Done first in order; **text version precedes the PDF object in DOM**; Download
states type + size. Sort/View menu = `Menu`.

## Edge cases
PDF can't render inline on mobile Safari → page images + text version (expected path on real iPhones). Missing PDF →
text version only, Download hidden. Removed slug → parent folder + banner.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `IOS-FILES-01` | Browse/Recents tabs, locations, favorites, tags from data | `cmp: derives from fixture` | P5 |
| `IOS-FILES-02` | Folder list/icons views with sort menu; pushed navigation + URLs | `e2e: D1 /ios/files/experience/{slug}` | P5 |
| `IOS-FILES-03` | Document view for roles/schools | `cmp: ExperienceDetail inside document chrome` | P5 |
| `IOS-FILES-04` | **Quick Look résumé**: zoom from row, Done, swipe-down, thumbnails, Download, Text version | `e2e: I2 résumé via Dock; VIEW-RESUME-01 on iphone` | P5 |
| `IOS-FILES-05` | Synthesized stack on deep open from the Dock | `e2e: Done returns to the folder, Back again returns Home` | P5 |
| `IOS-FILES-06` | Pad sidebar layout + sheet Quick Look | `e2e: ipad` | P5 |
| `IOS-FILES-07` | Semantics (dialog Quick Look, text-first résumé) | `e2e: X1 axe clean` | P5 |

## Not like the others
**Browse/Recents tabs, Tags, and Quick Look** for the résumé (macOS: Finder columns + separate Preview app; Windows:
Explorer + Edge PDF tab; Android Files: Material chips for categories, bottom sheets, PDF viewer activity with system Back).
