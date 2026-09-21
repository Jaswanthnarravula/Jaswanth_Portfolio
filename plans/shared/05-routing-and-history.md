# shared/05 — Routing and history

## Purpose
Make an unconventional interface behave like a well-mannered website: Back/Forward, deep links, refresh, shared
URLs and direct section links always work, in every OS. Requirements: R35, R36, R46.

## Decisions

| Decision | Rationale | Rejected |
|---|---|---|
| The URL encodes **only OS + focused app + its location** | Shareable links never carry someone else's window layout | Window sets in query/hash |
| **URL is the source of truth** for those three things; the store owns everything else | No two-way ambiguity | Store-first routing |
| History is written by exactly two primitives, in one module | One place to reason about Back | `pushState` scattered in components |
| `go(url)` has **back-collapse** | History never grows from toggling; Back always does what a human expects | Push on open, replace on close (creates duplicate neighbours) |
| `HistoryPort` interface with `native` (default) and `next-router` adapters | Risk 2: only documented Next behaviour is used; adapter is swappable without touching the kernel | Hard dependency on patched `history` |
| `/go/*` resolves **client-side with `replaceState`** | Static caching; Back never bounces through `/go` | Server redirect with cookies |
| `/plain` never redirects | Stable reader mode for screen-reader users and "Skip the OS" | Reusing `/go` for both jobs |

## Specification

### URL grammar
```
/                                    onboarding (hello → intro → profiles → chooser) — ONE history entry
/{os}                                OS home
/{os}/{appSlug}                      app root (apps that own one section show it here)
/{os}/{appSlug}/{section}            app showing a section list (apps that own several sections)
/{os}/{appSlug}/{section}/{slug}     a specific project / role / school
/go/{section}[/{slug}]               canonical OS-agnostic link
/plain[#section]                     reader mode
```
Examples: `/macos/finder/experience/acme` · `/macos/preview` (résumé) · `/windows/edge/resume` ·
`/ios/github/portfolio-os` · `/android/files/experience/acme` · `/linux/terminal/projects` (cwd `~/projects`) ·
`/linux/viewer/projects/portfolio-os` · `/linux/viewer/resume`.

Rules: when an app owns exactly one section the section segment is elided (`/ios/github/{slug}`); the decoder
accepts the long form and `canonicalize`s. Linux `appPath` = VFS path relative to `~` with extensions stripped
(sibling names are unique without them). `cat` output is scrollback, not addressable.

### Codec
```ts
export type RouteState =
  | { kind: 'welcome' }
  | { kind: 'go'; ref: ContentRef }
  | { kind: 'plain' }
  | { kind: 'os'; os: OsId; focus: { role: AppRole; location: AppLocation } | null };
export type DecodeResult =
  | { ok: true; route: RouteState; canonical: RoutePath }
  | { ok: false; nearest: RouteState; reason: 'unknown-os' | 'unreleased-os' | 'unknown-app' | 'unknown-slug' | 'bad-vfs-path' };
export interface RouteCodec { decode(pathname: string): DecodeResult; encode(r: RouteState): RoutePath }
export interface HistoryEntryState { osk: { idx: number; prev: RoutePath | null } }   // never spread history.state
```
Invariant: `encode(decode(p).route) === decode(p).canonical` for every generated static path (unit-tested).

### The two write primitives
- **`go(url)`** — same as current → no-op · equals `history.state.osk.prev` → `history.back()` (*back-collapse*)
  · otherwise → `pushState`.
- **`canonicalize(url)`** — always `replaceState`.

Invariants: (1) the URL is a pure function of kernel state — `encode(activeOs, focusedWindow)`; (2) no two
consecutive entries share a URL; (3) popstate handlers **never write**, except a repair via `canonicalize`.

### Event → history rule

| Event | Operation |
|---|---|
| Open app · focus another window | `go` (A↔B toggling collapses; history stays bounded) |
| Close · minimize · iOS/Android go-home | `go(next focused window or OS home)` — usually collapses |
| Maximize · restore · move · resize | none |
| In-app navigation to a new place | `go`; in-app Back collapses = browser Back |
| Tabs, filters, scroll, `cat`, Spotlight/Start open | none (session state) |
| Search result chosen | one `OPEN_APP{location}` + one `go` |
| Profile picked · onboarding steps | none (one entry for all of `/`) |
| OS picked on chooser | push `/{os}` |
| OS switch | `go(target session's focused URL)` |
| Terminal `cd` | `go`; `cd ..` collapses; > 20 pushes / 10 s degrades to replace (Safari limit) |
| `open resume` | `go('/linux/viewer/resume')`; quitting the viewer collapses |
| `/go` resolution · alias repair · invalid-URL repair · boot | `canonicalize` |

**Mobile rule:** on iOS, Android and any `compact` posture, opening an app is always a push, so the system/browser
Back returns home. On Android, browser Back **is** system Back at every level (sheet → in-app → home).

**Why Back never traps:** `/` never auto-forwards (returning visitors see the chooser with "Continue in …");
`/go` always replaces; duplicates are impossible by invariant 2.

### Traversal serialization (`ROUTE-SER-01`)
`history.back()` is asynchronous. RouteSync queues further writes until the matching `popstate` arrives, with a
500 ms failsafe that falls back to `push`. Reconcile is idempotent, so the echoed popstate is a no-op.

### Known Next.js caveats (handled inside `route-sync.ts` only)
First write deferred one animation frame after mount (Next patches `history` in an effect) · never spread
`history.state` into our own object · the Shell never reads `useParams` (stale after shallow navigation) ·
`history.scrollRestoration = 'manual'` · `document.title` is set by RouteSync using the same function as
`generateMetadata`.

### `/go` resolution (`ROUTE-GO-01`)
After boot: `os = prefs.lastOs ?? defaultOsFor(deviceClass)` (phone → `ios`/`android` by input heuristics without
UA sniffing, otherwise `macos`; always a released OS) → `role = sectionOwner[section]` → `canonicalize(target)`.
No onboarding gate. A dismissible toast offers "Viewing in macOS · Switch OS". Deep links and `/go` links
**never show boot or lock screens**.

### Contract suite (`ROUTE-CONTRACT-01`)
Playwright, run on every dependency change and on both adapters: push → back → forward → refresh → back, with a
window sentinel proving **no full reload**, asserting URL, focused app and focus target at each step.

## Edge cases
Invalid/unknown URL → server `notFound()`; on client, nearest valid route + `canonicalize`. Removed slug →
parent section. Unreleased OS URL → chooser. Hash on `/plain` scrolls to the section. bfcache restore →
`pageshow.persisted` re-runs reconcile without re-booting.

## Feature IDs + acceptance tests

| ID | Feature | Acceptance test |
|---|---|---|
| `ROUTE-CODEC-01` | Encode/decode + canonical forms | `unit: format∘parse is identity for every registry app and slug` |
| `ROUTE-CODEC-02` | Invalid input → nearest valid | `unit: unknown app redirects to /{os}; unknown slug to parent` |
| `ROUTE-GOFN-01` | `go()` no-op / collapse / push | `unit: go() decision table` |
| `ROUTE-EVENT-01` | Event → history table | `e2e: H1 back/forward consistency for URL, top window and focus` |
| `ROUTE-MOBILE-01` | Mobile push rule + Android Back | `e2e: A1 drawer → app → goBack() returns home` |
| `ROUTE-SER-01` | Traversal serialization + failsafe | `unit: queue/failsafe state machine; e2e: spam never duplicates consecutive URLs` |
| `ROUTE-PORT-01` | `HistoryPort` adapters | `e2e: contract suite green on native and next-router adapters` |
| `ROUTE-CONTRACT-01` | No full reload across traversal | `e2e: window sentinel survives push/back/forward` |
| `ROUTE-GO-01` | `/go` resolution | `e2e: D1 /go/projects/{slug} lands in an OS app, Back leaves the site` |
| `ROUTE-PLAIN-01` | `/plain` reader mode | `e2e: W2 /plain never redirects; every section present` |
| `ROUTE-DEEP-01` | Cold deep link + refresh in app | `e2e: D1 deep link opens only the named app, no boot/lock screen` |
| `ROUTE-TERM-01` | Terminal cwd in URL with rate degrade | `unit: >20 pushes/10s switches to replace` |
| `ROUTE-TITLE-01` | Title parity server/client | `unit: title function shared; e2e: titles unique per route` |

## Open questions
None.
