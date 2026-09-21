# shared/18 — Privacy-friendly analytics

## Purpose
Learn what visitors actually do (which profile, which OS, which apps, résumé downloads) and watch real-user
LCP/INP/CLS — without cookies, PII, consent banners or any cost to responsiveness. Requirement: N12 (supports T).

## Decisions

| Decision | Rationale | Rejected |
|---|---|---|
| Cookieless **Vercel Web Analytics + Speed Insights** | No consent banner; first-party; real-user Core Web Vitals | Google Analytics |
| Everything goes through a typed **`AnalyticsPort`** with adapters | Custom events depend on the Vercel plan (risk 13); adapter swap needs no app changes | Calling the vendor SDK directly |
| `track()` is fire-and-forget, loaded on idle, and lint-restricted to `lib/analytics` | Analytics can never sit on a hot path | Tracking inside components |
| No PII, no free text, no slugs of visitors' input; honours **DNT and GPC** | Privacy by construction | Recording search queries |

## Specification

### Port
```ts
type AnalyticsEvent =
  | { name: 'persona_selected'; persona: PersonaId }
  | { name: 'os_entered'; os: OsId; via: 'chooser' | 'deep-link' | 'switch' | 'go' }
  | { name: 'app_opened'; os: OsId; role: AppRole; section?: SectionId }
  | { name: 'resume_downloaded'; os: OsId | 'pre-os' | 'plain' }
  | { name: 'contact_initiated'; channel: 'mailto' | 'copy' | 'link' }
  | { name: 'search_used'; os: OsId; resultKind: SearchKind | 'none' }        // never the query text
  | { name: 'hint_used'; step: 'shown' | 'revealed' | 'pasted' }
  | { name: 'continuity_offered' | 'continuity_accepted'; from: OsId; to: OsId; section: SectionId }
  | { name: 'tour_started' | 'tour_completed' | 'tour_cancelled'; os: OsId }
  | { name: 'egg_found'; id: string }
  | { name: 'tier'; tier: 0 | 1 | 2; motion: 'full' | 'reduced'; glass: 'full' | 'solid' }
  | { name: 'intro'; outcome: 'played' | 'skipped' | 'muted' };
interface AnalyticsPort { track(e: AnalyticsEvent): void; pageview(path: RoutePath): void }
```
Adapters: **`vercel`** (page views + custom events when the plan supports them; unsupported calls silently no-op)
· **`noop`** (dev, tests, DNT/GPC, `saveData`) · **`beacon`** (Plausible/Umami-compatible, available if the owner
ever moves hosting). Selection is automatic at boot.

### Page views with shallow routing
RouteSync calls `pageview(canonicalPath)` on every committed route change (debounced 300 ms so back-collapse
echoes don't double count). The reported path is the **canonical `/go/*` form plus the OS** (`/macos → go/projects`)
so content popularity is comparable across OSes.

### Loading
Dynamic import on `requestIdleCallback` after first paint; ≤ 3 KB; never before LCP; zero requests before first
paint (asserted). Speed Insights reports LCP/INP/CLS per route group (`/`, each OS).

### What the owner gets
Profile mix (all profiles behave identically — this is curiosity data only) · OS popularity · most-opened apps and
sections · résumé downloads · contact initiations · hint/tour usage · tier distribution · real-user Web Vitals.

### Privacy statement
Shown in each OS's Settings → Privacy and on `/plain`: what is counted, that there are no cookies or identifiers,
and that DNT/GPC switches everything off.

## Edge cases
Ad-blockers → calls fail silently. Offline → dropped (no queueing). Custom events unavailable on the plan → page
views and Speed Insights still work. Tests → `noop` adapter records calls in memory for assertions.

## Feature IDs + acceptance tests

| ID | Feature | Acceptance test |
|---|---|---|
| `ANL-PORT-01` | Typed port + adapters + automatic selection | `unit: noop under DNT/GPC/saveData; vercel otherwise` |
| `ANL-EVENT-01` | Event catalogue wired at the kernel boundary | `unit: each kernel action emits the specified event once` |
| `ANL-PV-01` | Canonical page views with shallow routing, debounced | `unit: back-collapse echo does not double count` |
| `ANL-LAZY-01` | Idle-loaded, nothing before first paint | `e2e: zero analytics requests before first paint` |
| `ANL-PRIV-01` | DNT/GPC → zero requests; no PII/query text | `e2e: no analytics requests with DNT; payload schema test` |
| `ANL-LINT-01` | Tracking restricted to `lib/analytics` | `static: boundary lint fixture` |
| `ANL-CWV-01` | Speed Insights field Web Vitals | `e2e: speed-insights script present on production build only` |
| `ANL-NOTICE-01` | Privacy statement surfaces | `e2e: statement reachable in every OS and /plain` |

## Open questions
None — if the Vercel plan lacks custom events, the port falls back to page views automatically.
