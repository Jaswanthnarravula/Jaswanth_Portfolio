# shared/03 — Content views

## Purpose
The reusable, typed building blocks that turn portfolio data into readable content. Every OS app, the SSR
fallback, `/go/*` and `/plain` compose these — so facts and their structure exist once. Requirements: R24, R44.

## Decisions

| Decision | Rationale | Rejected |
|---|---|---|
| Views are **hook-free, server-renderable** functions of data | Same component renders in RSC fallback and inside client OS apps | Client-only views |
| Views are **unstyled-by-default + slot-based**; the OS app supplies the idiom | Finder columns, a repo list and a terminal listing share data, not looks (north-star B2, B5) | One styled card reused everywhere |
| Each view ships a `variant` for density, never for OS name | Keeps views OS-agnostic (`comfortable`, `compact`, `text`) | `variant="macos"` |
| A `text` renderer exists for every view | Terminal output and screen-reader summaries come from the same source | Separate terminal strings |

## Specification

### Catalogue

| View | Input | Used by |
|---|---|---|
| `AboutOverview` | `person`, featured projects, current role | browser apps, `/go/about`, `whoami` / `cat about.txt` |
| `ProjectList` | `Project[]` | github apps, `projects`, `ls ~/projects` |
| `ProjectDetail` | `Project` (+ GitHub enrichment) | github apps, viewer, `/go/projects/{slug}` |
| `ExperienceList` / `ExperienceDetail` | `Experience[]` / `Experience` | files apps, viewer, `experience` |
| `EducationList` | `Education[]` | files apps, `/go/education` |
| `SkillsMatrix` | `SkillGroup[]` | editor / notes apps, `skills`, `neofetch` |
| `ResumeView` | `resume` meta + PDF | viewer / Quick Look / Edge PDF tab, `open resume` |
| `ContactPanel` | `contact` | mail / messages apps, `contact` |
| `LegalNotice` | asset manifest credits | settings apps, `/plain`, `legal` command |

### Contract
```ts
type Density = 'comfortable' | 'compact' | 'text';
interface ViewProps<T> { data: T; density?: Density; slots?: Partial<ViewSlots>; headingLevel?: 2|3|4 }
interface ViewSlots { Link: LinkComponent; Media: MediaComponent; Tag: TagComponent; Action: ActionComponent }
export function renderText(view: ViewId, data: unknown, width: number): readonly string[]; // terminal + SR summaries
```
- `slots.Link` is how an OS injects `KernelLink` (in-OS navigation) while the SSR fallback injects a plain `<a>`.
- `headingLevel` lets a window (title = `h2`) start content at `h3` — `shared/09-accessibility.md`.
- Views never fetch, never read stores, never call `window`.

### Contact hand-off (`VIEW-CONTACT-01`)
Compose UI lives in the OS mail app; the shared panel exposes typed actions:
`mailto(subject, body)` → builds the `mailto:` URL; `copy(channel)` → Clipboard API with a fallback select;
`open(link)` → new tab with `rel="noopener noreferrer"`. No network calls, no backend.

### Media
`MediaRef { src; alt; width; height; kind: 'image' | 'video' }` — dimensions mandatory (CLS), AVIF/WebP via
`next/image`, lazy below the fold, never autoplaying video with sound.

## Edge cases
- Missing optional fields (`repo`, `live`, `media`) → the action/slot simply isn't rendered; layout doesn't jump.
- Clipboard blocked → show the address selected in a read-only field with "Press Ctrl/Cmd+C".
- Long lists (> 12 items) → `content-visibility: auto` with `contain-intrinsic-size`.
- The résumé is always shown as the published PDF's **page images** (rendered at build time from the owner's
  `Resume.pdf`; `ResumePages`), never an inline `<object>` — the CSP forbids it (`object-src 'none'`, `DEPLOY-HDR-01`)
  and phones have no inline viewer. The text version (`ResumeDocument`) is the **same PDF's own text**, never the
  data. Pages missing (render failed) → Open / Download links only. See the shared/22 Deviations log 2026-09-23.

## Feature IDs + acceptance tests

| ID | Feature | Acceptance test |
|---|---|---|
| `VIEW-CAT-01` | All catalogue views exist and are hook-free | `unit: each view renders in a server (node) environment` |
| `VIEW-TEXT-01` | `renderText` for every view | `unit: text output snapshot at width 80 and 40` |
| `VIEW-SLOT-01` | Link slot swaps between `<a>` and `KernelLink` | `cmp: same view navigates shallowly inside an OS, fully in fallback` |
| `VIEW-HEAD-01` | Heading levels are injectable | `cmp: no heading-order axe violation inside a window` |
| `VIEW-CONTACT-01` | Contact hand-off actions | `cmp: mailto URL encoded; copy fallback when clipboard rejects` |
| `VIEW-RESUME-01` | Résumé view with mobile fallback | `e2e: iPhone project shows pages + working download` |
| `VIEW-MEDIA-01` | Media never shifts layout | `lhci: CLS ≤ 0.1 on a project deep link` |

## Open questions
None.
