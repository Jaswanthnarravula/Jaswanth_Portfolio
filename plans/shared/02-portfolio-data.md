# shared/02 — Portfolio data layer

## Purpose
One typed module holds every career fact. All five OSes, `/go/*`, `/plain`, the Linux filesystem, search, OG
cards and the sitemap derive from it. Changing one fact updates every representation. Requirements: R8, R44, R45.

## Decisions

| Decision | Rationale | Rejected |
|---|---|---|
| Data is a TypeScript module (`as const satisfies Portfolio`), not a CMS or JSON fetched at runtime | Slug unions become types; invalid references fail the build; zero runtime cost | MDX/CMS; runtime fetch |
| Long-form text is plain strings / string arrays (paragraphs, bullets), not markup | Each OS renders it in its own idiom; terminal can print it | HTML/Markdown blobs |
| Placeholders are explicit (`placeholder: true`) and **cannot reach production** | No fake facts shipped | Silent sample data |
| GitHub enrichment is a separate generated file merged by selector | Build never depends on the network — `shared/17-github-live-data.md` | Runtime API |

## Specification

### Files
- `data/schema.ts` — types below.
- `data/portfolio.ts` — the facts.
- `data/selectors.ts` — the **only** read API for UI code (`getProjects()`, `getProject(slug)`,
  `resolveContent(ref)`, `getResumeFile()`, `getContactChannels()`, …).
- `data/content-index.ts` — every `ContentRef`, titles, summaries, keywords, plus `contentRev` (hash) used by
  static params, sitemap, VFS, search index and session staleness checks.
- `data/generated/github.json` — committed snapshot written by `scripts/fetch-github.mjs`.

### Types (compact)

```ts
export interface Portfolio {
  person: { name: string; headline: string; location: string; summary: readonly string[]; openTo: string; placeholder?: true };
  contact: { email: string; links: readonly ContactLink[] };            // github, linkedin, x, site…
  experience: readonly Experience[];
  projects: readonly Project[];
  education: readonly Education[];
  skills: readonly SkillGroup[];                                        // e.g. Languages, Frontend, Cloud…
  resume: { file: `/resume/${string}.pdf`; updated: string; pages: number };
}
export interface Experience { slug: string; company: string; role: string; start: string; end: string | 'present';
  location: string; summary: string; highlights: readonly string[]; stack: readonly string[]; placeholder?: true }
export interface Project { slug: string; name: string; tagline: string; description: readonly string[];
  highlights: readonly string[]; stack: readonly string[]; repo?: string; live?: string; year: number;
  featured: boolean; media?: readonly MediaRef[]; placeholder?: true }
export interface Education { slug: string; school: string; degree: string; start: string; end: string; notes: readonly string[]; placeholder?: true }
export interface SkillGroup { id: string; label: string; items: readonly { name: string; level: 1|2|3|4|5; years?: number }[] }
export type ProjectSlug = (typeof portfolio.projects)[number]['slug'];
export type ExperienceSlug = (typeof portfolio.experience)[number]['slug'];
export type EducationSlug = (typeof portfolio.education)[number]['slug'];
export type ContentRef =
  | { section: 'about' | 'skills' | 'resume' | 'contact' }
  | { section: 'projects'; slug?: ProjectSlug }
  | { section: 'experience'; slug?: ExperienceSlug }
  | { section: 'education'; slug?: EducationSlug };
```

### Résumé ingestion
1. Owner drops `Resume.pdf` at the repository root (owner decision 2026-09-23: "open, preview and download show
   this file" everywhere).
2. Content is extracted into `data/portfolio.ts` by hand-review (no automated parsing at build time).
3. `npm run build:resume` (also in `prebuild`) copies the PDF as-is to `public/resume/`, referenced by
   `portfolio.resume.file`, and renders its pages to images + extracts its text (`scripts/resume-pages.mjs`) — what
   every viewer shows (shared/03 `VIEW-RESUME-01`).
4. Every `placeholder: true` is removed; the guard then passes.

### Placeholder guard (`DATA-GUARD-01`)
`scripts/check-content.mjs` runs in `prebuild` when `VERCEL_ENV=production` (or `CHECK_CONTENT=1`): any
`placeholder: true` → non-zero exit with the list of offending entries.

### Invariants (unit-tested)
- Slugs are unique per collection, kebab-case, URL-safe, and stable (changing one needs a redirect entry).
- Dates are ISO `YYYY-MM`; `end >= start`; lists sorted newest first by selector, not by author order.
- Every `ContentRef` in `content-index` resolves; every project/experience/education entry is in the index.
- No UI module imports `data/portfolio` (lint) — selectors only.

## Edge cases
- Empty collection (e.g. no education yet) → selectors return `[]`; content views render an OS-appropriate empty
  state; the section stays reachable (never a broken link).
- Very long text → views clamp with "Show more"; terminal pages through `less`-style paging.
- Removed slug in a persisted session or shared URL → truncated to the parent section (`shared/05`).

## Feature IDs + acceptance tests

| ID | Feature | Acceptance test |
|---|---|---|
| `DATA-SCHEMA-01` | Typed schema + slug unions | `static: invalid slug reference fails tsc` |
| `DATA-SEL-01` | Selectors are the only read API | `static: boundary lint fixture` |
| `DATA-INDEX-01` | Content index + `contentRev` | `unit: every entry indexed; contentRev changes when data changes` |
| `DATA-INV-01` | Data invariants | `unit: slugs unique, dates valid, refs resolve` |
| `DATA-GUARD-01` | Placeholder guard blocks production | `unit: check-content exits non-zero with placeholder present` |
| `DATA-EMPTY-01` | Empty collections handled | `cmp: each content view renders empty state` |
| `DATA-RESUME-01` | Résumé file wired | `e2e: resume PDF returns 200 with correct content-type` |
| `DATA-COPY-01` | Owner-approved copy (2026-09-25): headline, About text, sharper role bullets with before → after numbers, Java/Spring first, corrected project contexts, UAB coursework (`shared/23-content-depth.md`) | `unit: real data carries the approved headline and metrics; no placeholder; lead language is Java 17` |

## Open questions
None — the owner's `Resume.pdf` is published (2026-09-23) and every former `placeholder: true` fact was filled from
it on 2026-09-24.
