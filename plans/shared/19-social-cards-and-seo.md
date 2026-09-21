# shared/19 — Social cards and SEO

## Purpose
Every link pasted into LinkedIn, Slack, X or iMessage looks designed, and search engines index real content —
not an empty app shell. Requirement: N13 (supports R35).

## Decisions

| Decision | Rationale | Rejected |
|---|---|---|
| **Static** Open Graph images generated at build with `next/og` (`opengraph-image.tsx`) | No runtime function; instant; cacheable | Runtime OG generation; hand-made PNGs per page |
| One card design keyed by **`ContentRef`**; OS routes reuse the card of the content they show | Consistent brand; no card-per-OS explosion | A card per OS route |
| Cards **never contain third-party marks** (no OS logos, app icons, Netflix styling) | Nominative-use rule; cards are the site's own branding | OS screenshots as cards |
| Canonical URL of every OS route is its **`/go/*`** page; the sitemap lists only `/`, `/plain`, `/go/*` | One indexable URL per piece of content; no duplicate-content across five OSes | Indexing every OS URL |
| The SSR semantic fallback is the indexable body | Real headings and text for crawlers and no-JS | Client-rendered content only |

## Specification

### Card design (1200 × 630, PNG)
Brand glass gradient background (original artwork) · name "Jaswanth" + headline (top-left) · large title
(section or project/role name) · one-line summary (≤ 110 chars, truncated on a word) · bottom strip of up to four
stack tags · subtle corner motif of five abstract tiles hinting at "five operating systems" (abstract shapes, no
logos). Inter embedded for deterministic rendering. Dark and light are not varied — one design.

### Card inventory
`/` (site card) · `/plain` · `/go/about` · `/go/projects` + one per project · `/go/experience` + one per role ·
`/go/education` · `/go/skills` · `/go/resume` · `/go/contact`. OS routes → `openGraph.images` points at the matching
`/go/*` card.

### Metadata per route (`generateMetadata`)
`title` from the shared title function (`{Content} — Jaswanth` / `{App} · {OS} — Jaswanth`), `description` from the
content summary, `alternates.canonical` → `/go/*`, `openGraph` (type `website`/`profile`/`article`), `twitter:
summary_large_image`, `robots` index for `/`, `/plain`, `/go/*`; OS routes `index, follow` with canonical (so
they consolidate rather than compete).

### Structured data
JSON-LD `Person` on `/` and `/go/about` (name, jobTitle, url, sameAs links, knowsAbout from skills);
`CreativeWork`/`SoftwareSourceCode` on project pages (name, description, codeRepository, programmingLanguage).

### Sitemap / robots / manifest
`sitemap.ts` from `content-index` (lastModified = build date) · `robots.ts` allow all + sitemap URL · previews send
`X-Robots-Tag: noindex` · `manifest.ts` with original icons only.

## Edge cases
Placeholder content → cards still build (guard blocks production anyway). Very long project names → auto-scale
the title between 56 and 84 px, two lines max. Missing summary → tagline → first highlight. Slug removed → card
and sitemap entry disappear together (both derive from the index).

## Feature IDs + acceptance tests

| ID | Feature | Acceptance test |
|---|---|---|
| `OG-GEN-01` | Static OG image per `ContentRef` | `build: every /go/* route emits an opengraph image` |
| `OG-REUSE-01` | OS routes reuse the content card | `unit: generateMetadata for an OS route points at the /go card` |
| `OG-MARK-01` | No third-party marks on cards | `unit: OG template imports only original assets` |
| `OG-META-01` | Titles, descriptions, canonical, twitter card | `unit: metadata snapshot per route type; titles unique` |
| `OG-LD-01` | JSON-LD Person + project schemas | `unit: schema validates` |
| `OG-MAP-01` | Sitemap/robots/manifest from the index | `unit: sitemap lists only /, /plain, /go/*` |
| `OG-FIT-01` | Title auto-fit and truncation | `unit: long-title fixture stays within two lines` |

## Open questions
None.
