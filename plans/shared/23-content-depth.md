# shared/23 — Content depth (case studies, deep dives, recruiter card, Now)

## Purpose
Turn the portfolio from short summaries into evidence a recruiter or interviewer can act on: a recruiter card, a
"Now" note, a scope paragraph per role, a case study per major project and short technical deep dives, all from the
owner's own answers (owner request 2026-09-24: "everything is short summary … recruiter should obviously know more
about me"). Requirement: R51. Approved copy: the owner's review page (2026-09-25, "Portfolio Copy Review"), whose
text is entered verbatim into `data/portfolio.ts`.

## Decisions

| Decision | Rationale | Rejected |
|---|---|---|
| Every new field lives in `data/portfolio.ts` and reaches UI through `data/selectors` + `components/content/*` (shared/02, north-star B9) | One fact, one place | Copy typed into OS components |
| Facts come only from the owner's résumé and questionnaire answers; nothing inferred | shared/02 decision "do not infer dates, ratings or metrics" | Filling gaps with plausible numbers |
| **Hidden by owner decision:** work authorization, GPA, recommendations. The schema has no field for them, so no view can show them | A field that does not exist cannot leak | A `hidden: true` flag |
| Deep dives belong to their project and open **inside each OS's GitHub app** as a repository document (`docs/{slug}.md`); Linux lists them in `~/notes/`; `/go/projects/{slug}` prints them in full | No new `ContentRef` variant or route grammar (shared/05 stays untouched); a deep dive is part of the work it explains | Opening them in macOS Preview (owns only `resume`, prints only the résumé — `MAC-PREV-06`), Windows Explorer (`ExplorerSection` is experience/education only), iOS Notes / Android Keep (not deep-linkable; own only `skills`) |
| Case study and deep-dive state inside an app (active tab / pivot / segment, open document) is **session state, not routed** — same rule as the existing GitHub tabs | Matches `MAC-GH-02`, `WIN-GH-02`, `IOS-GH-02`, `AND-GH-02` | Routed tabs |
| The recruiter card is part of `AboutOverview`, so every browser app and `/go/about`, `/plain` get it with no OS change | `AboutOverview` is already the shared About view in all four browsers (`VIEW-CAT-01`) | Four hand-built cards |
| The scope paragraph is part of `ExperienceDetail` (all four Files/Finder/Explorer documents) and the `experience-detail` text renderer (Linux) | Same reason | Per-OS markup |
| "Now" appears on one native system surface per OS (see table below), plus About | Surfaces make the note discoverable without a new app | A sixth "Now" app |
| Deep-dive and case-study text never enters the search index beyond deep-dive titles as project keywords | The index stays within its 10 KB gzip budget (`SRCH-*`, `tests/unit/data/data.test.ts`) | Full-text indexing |

### Where each piece appears

| Piece | Shared view / renderer | macOS | Windows 11 | iOS | Android | Linux |
|---|---|---|---|---|---|---|
| Recruiter card | `AboutOverview` → `Glance` block; `about` text renderer | Safari About | Edge About | Safari About | Chrome About | `about` / `cat about.txt` |
| Now | `AboutOverview` "Now" line; `about` text | Notification Center "Now" widget (`MAC-NOTIF-07`) | Start → Recommended "Now" item (`WIN-START-09`) | Home Screen small "Now" widget (`IOS-WIDG-05`) | Keep pinned "Now" note (`AND-KEEP-07`) | `~/.plan` + MOTD line "what I'm working on → cat .plan" (`LNX-FS-08`, `LNX-BOOT-08`) |
| Scope | `ExperienceDetail`; `experience-detail` text | Finder document | Explorer document + details pane | Files document | Files reader | `~/experience/{slug}.md` |
| Case study | `ProjectCaseStudy` (new); `project-detail` text | GitHub "Case study" tab (`MAC-GH-08`) | GitHub "Case study" pivot (`WIN-GH-07`) | GitHub "Case Study" segment (`IOS-GH-07`) | GitHub "Case study" tab (`AND-GH-07`) | `~/projects/{slug}.md` sections (`LNX-FS-08`) |
| Deep dives | `DeepDiveArticle` (new); `deep-dive` text | GitHub `docs/` file view | GitHub `docs/` file view | GitHub pushed document | GitHub full-screen reader | `~/notes/{slug}.md` via `less` (`LNX-FS-08`) |

## Specification

### Types (added to `data/schema.ts`)

```ts
interface Glance {                       // CONTENT-GLANCE-01
  targetRoles: readonly string[];        // "Backend Software Engineer", "Software Engineer II"
  experience: string;                    // "3+ years · IBM (DBS Bank), Xclusive Trading Inc."
  coreStack: readonly string[];
  strengths: readonly string[];
  workModes: readonly string[];          // "Houston on-site or hybrid", "Remote (US)", "Open to relocate"
  availability: string;                  // "Two weeks' notice"
}
interface NowNote { text: string; updated: PartialDate }            // CONTENT-NOW-01
Person      += { glance?: Glance; now?: NowNote }   // optional in the type (a missing one hides its surface); present in the real data
Experience  += { scope?: string }                                   // CONTENT-SCOPE-01
interface Decision { title: string; detail: string; rejected?: string }
interface ResultMetric { value: string; label: string }
interface CaseStudy {                                               // CONTENT-CASE-01
  problem: readonly string[]; role: string;
  decisions: readonly Decision[]; results: readonly ResultMetric[];
}
type ArticleBlock = { kind: 'p'; text: string } | { kind: 'steps'; items: readonly string[] };
interface DeepDive { slug: string; title: string; summary: string; blocks: readonly ArticleBlock[] } // CONTENT-DIVE-01
Project     += { caseStudy?: CaseStudy; deepDives?: readonly DeepDive[] }
Credential  += { kind: 'course' | 'certification'; status: 'earned' | 'in-progress';
                 date?: PartialDate; verifyUrl?: string }           // CONTENT-CRED-01
Skill       += { approx?: true }         // "~1 yr" instead of "1+ yr"  // CONTENT-SKILL-01
```

### Rendering rules
- **Case study order:** The problem → My role → Key decisions (title, detail, "Rejected: …" when present) → Results
  (value + label). Headings start at the caller's `headingLevel` (`VIEW-HEAD-01`).
- **Where the views compose:** `ProjectDetail` appends `ProjectCaseStudy` and the deep dives only when called with
  `depth` (used by `/go/projects/{slug}` and the Linux viewer tile, which mirrors `cat projects/{slug}.md`); OS GitHub apps place `ProjectCaseStudy` / `DeepDiveArticle` in their own
  tab, pivot, segment or reader, so the README tab never repeats the case study.
- **Deep dive:** title, then blocks in order; `steps` render as an ordered list. A deep-dive list shows title +
  summary. Text renderers wrap at the terminal width like every other view (`VIEW-TEXT-01`).
- **Credentials:** a course reads "course credential"; a certification reads "certification"; `in-progress` reads
  "in progress · target {date}". A course is never labelled a certification.
- **Skill years:** "{n}+ yr(s)", or "~{n} yr(s)" when `approx`. Skills without `years` show no figure.
- **Glance:** a labelled description list (`dl`), never a table; it has no work-authorization row.
- Data invariants (unit-tested): every `rejected`, metric and deep dive is non-empty text; deep-dive slugs are unique
  across all projects and kebab-case; each metric quoted in a role bullet also appears in that project's case study
  results or text.

## Edge cases
- A project without `caseStudy` / `deepDives` → no tab, pivot, segment or `notes` entries for it (same rule as the
  hidden Links tab).
- A deep dive whose project is removed → its `~/notes` file and GitHub document disappear with it; nothing is routed,
  so no redirect is needed.
- Very long deep dive → the OS's own scroll; Linux pages through `less`.
- `/plain` shows the card (About) and every role in full (`ExperienceDetail`, incl. scope) but not case studies;
  `/go/projects/{slug}` shows both. (Owner change 2026-09-25, logged under `ROUTE-PLAIN-01`.)

## Feature IDs + acceptance tests

| ID | Feature | Acceptance test |
|---|---|---|
| `CONTENT-GLANCE-01` | Recruiter card in `AboutOverview` and the `about` text renderer | `cmp: card renders target, stack, location, availability; no work-authorization text anywhere` |
| `CONTENT-NOW-01` | "Now" note in the model, About and text renderer | `unit: now note present, dated; cmp: About shows it` |
| `CONTENT-SCOPE-01` | Scope paragraph in `ExperienceDetail` and `experience-detail` text | `cmp: role detail shows scope; unit: text renderer prints it within width` |
| `CONTENT-CASE-01` | `ProjectCaseStudy` view + `project-detail` text sections; `/go/projects/{slug}` shows it | `cmp: all four parts in order; e2e: /go/projects/enterprise-sso shows the case study without JS` |
| `CONTENT-DIVE-01` | `DeepDiveArticle` view + `deep-dive` text; `/go/projects/{slug}` prints the dives | `cmp: steps render as an ordered list; unit: dive slugs unique; e2e: no-JS project page lists the dives` |
| `CONTENT-CRED-01` | Credentials with kind, status, date, verify link | `unit: every credential has a kind; cmp: a course never reads "certification"` |
| `CONTENT-SKILL-01` | Skill years (with approx) and the evidence-only list | `unit: years only on listed skills; removed skills absent; cmp: years label format` |
| `CONTENT-INV-01` | Content-depth data invariants (non-empty, unique slugs, metrics consistent, hidden facts absent) | `unit: content-depth invariants hold on the real data` |

## Open questions
None — copy approved 2026-09-25; placements above are the working defaults.
