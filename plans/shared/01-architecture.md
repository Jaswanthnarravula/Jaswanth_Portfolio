# shared/01 — Architecture

## Purpose
Fix the folder structure, route files, rendering strategy, code-splitting, type discipline and dependency
policy that every other plan relies on. Requirements: R4, R8, R9, R39, R44, R45.

## Decisions

| Decision | Rationale | Rejected |
|---|---|---|
| The OS **Shell lives in `app/layout.tsx`** and survives every navigation | A page or `[os]` layout remounts when params change, destroying windows and animations | Shell inside `app/[os]/layout.tsx` |
| One static catch-all page `app/[os]/[[...path]]/page.tsx` renders a **semantic HTML version** of the addressed section | LCP element, SEO, no-JS and screen-reader fallback in one; the OS layer cross-fades above it | Client-only SPA; per-app route folders |
| All in-OS navigation is **shallow** (`history.pushState/replaceState`) | Documented Next 16 behaviour; opening an app never costs an RSC round trip | `router.push` per click; parallel/intercepting routes per window |
| Each OS is one lazy chunk loaded through `lib/os-loaders.ts` | Guaranteed isolation; visiting macOS never downloads Android | Route-folder splitting (`/os/macos/page.tsx`) — forces remounts |
| Pure-TS kernel in `lib/kernel`, wrapped by a vanilla Zustand store | Testable without React; animation/DOM never stored in it | One store per OS; Redux; React context state |
| Portfolio facts in one module, rendered by hook-free shared content views | R44: change one fact → five OSes update | Copy per OS |
| **Imperative three.js** for the single Hello shader; R3F/drei dormant | R3F 9.7 bundles a React 19.2 reconciler while Next runs a vendored 19.3 canary | R3F `<Canvas>` on the critical welcome path |
| No `react-aria`, no framer-motion, no state/animation libraries beyond the pinned stack | Budgets; single owner of focus and motion | — |

## Specification

### Folder tree (responsibility per folder)

```
app/
  layout.tsx                 html, fonts, inline tier script, <Shell>{children}</Shell>
  page.tsx                   SSR Hello markup + real <a href="/{os}"> links (no-JS works)
  [os]/[[...path]]/page.tsx  decode → notFound(); generateStaticParams; generateMetadata; <SemanticFallback>
  go/[[...target]]/page.tsx  canonical OS-agnostic section page (same fallback)
  plain/page.tsx             reader mode: every section, never redirects
  opengraph-image.tsx (+ per-route)  static OG cards
  not-found.tsx · global-error.tsx · sitemap.ts · robots.ts · manifest.ts
data/                        schema.ts · portfolio.ts · selectors.ts · content-index.ts · generated/github.json
lib/
  kernel/                    ids · types · actions · registry · reducers/ · route/ · history/ · persist/ · focus · capabilities
  motion/                    spring · flight · ticker · director · dur()
  audio/                     Web Audio wrapper (only place AudioContext is allowed)
  analytics/                 AnalyticsPort + adapters (only place tracking is allowed)
  search/                    index builder + matcher
  terminal/                  vfs · tokenizer · parser · interpreter · commands/ · completion
  assets/                    manifest + resolver (ASSET_MODE)
  webgl/                     GlassStage (imperative three.js)
  os-loaders.ts              Record<OsId, () => import()>
stores/                      kernel-store · prefs-store · kernel-context
components/
  shell/                     Shell · OSHost · KernelLink · TransitionStage · FocusManager
  onboarding/                hello · netflix · chooser
  content/                   hook-free section renderers (shared by SSR fallback, /plain, all OS apps)
  primitives/                RovingGroup · Menu/Menubar · Combobox/Listbox · FocusScope · Press/LongPress
  os/shared/                 headless window frame, launcher grid, notification host, flight host
  os/{ios,macos,windows,android,linux}/   one chunk each: skins, surfaces, apps
shaders/                     hello.frag, hello.vert
scripts/                     copy-decoders · fetch-github · build-hello-paths · check-plans
plans/                       this directory
```

### Import boundaries (`ARCH-LINT-01`, enforced in ESLint — see risk 5)
- `components/os/{a}/**` may not import `components/os/{b}/**`.
- OS code may not import `data/portfolio` directly — only `data/selectors` and `components/content/*`.
- `history.*`, `localStorage`/`sessionStorage`, `AudioContext`, raw `requestAnimationFrame`, and analytics
  calls are banned outside `lib/kernel`, `lib/audio`, `lib/motion`, `lib/analytics`.
- `lib/kernel/**` and `lib/terminal/**` may not import React.

### Rendering and hydration (`ARCH-HYDR-01`)
1. Server renders the semantic fallback (or Hello markup on `/`). This is the LCP element.
2. First client render of `<Shell>` is exactly `{children}` — constant, URL-independent initial store state.
3. One idempotent boot effect (StrictMode-safe): detect capabilities → rehydrate prefs → rehydrate sessions →
   dispatch `BOOT{url, navType, viewport, now}` → start RouteSync on the next animation frame.
4. `import()` of the URL's OS chunk starts at Shell module scope so it overlaps hydration.
5. OS trees mount only when `boot === 'ready'`; the OS layer fades in above the fallback (no layout change).
6. The inline head script only sets `data-*` attributes on `<html>` (`suppressHydrationWarning`).

### Static generation (`ARCH-STATIC-01`)
`generateStaticParams` comes from `lib/kernel/route/static-params.ts` (OS × app × known slugs + Linux VFS paths,
**released OSes only**), `dynamicParams = false`, `generateMetadata` uses the same title function RouteSync uses
for `document.title`. Canonical URL of every OS route points at its `/go/*` page.

### Released-OS flag (`ARCH-REL-01`)
`OS_REGISTRY[os].released: boolean`. The chooser, static params, sitemap and `/go` resolver only see released
OSes. An OS is flipped to `released` only when its ledger is 100 % `verified`. Every phase therefore ships a
complete site.

### Type discipline (`ARCH-TYPES-01`)
`strict`, `noUncheckedIndexedAccess`, no `any` (lint error), discriminated unions for every state machine,
branded types for `RoutePath`, `WindowId`, `Epoch`, `AssetId`, slug unions derived from data with
`as const satisfies`. Model catalogue lives in `shared/04-os-kernel.md`; exhaustive `switch` with `never` checks.

### Dependency policy (`ARCH-DEPS-01`)
Exact pins. Runtime additions allowed in v1: `@vercel/analytics`, `@vercel/speed-insights`. Dev additions:
`vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`,
`@playwright/test`, `@axe-core/playwright`, `@lhci/cli`, `web-vitals`, `opentype.js` (build script only).
Anything else requires updating this file and the budgets in `shared/10-performance.md` first.
Build scripts may use `sharp`, which `next` already installs (asset ingest only; never shipped). The approved list is
enforced by `tests/tooling/scaffold.test.ts`; a post-build audit (`scripts/check-build.mjs`) fails any dynamic route
or a client asset that carries the GitHub token.

### Scaffold fixes (`ARCH-FIX-01`)
- `app/layout.tsx`: remove `maximumScale: 1`; add `viewportFit: 'cover'`, `interactiveWidget: 'resizes-content'`.
- `app/globals.css`: replace the blanket reduced-motion rule with the `:root[data-motion]` system.
- `vercel.json`: version the `/decoders/` path before keeping `immutable`.
- `next.config.ts`: add `typedRoutes: true`; keep `cacheComponents` off.
- `eslint.config.mjs`: enable `jsx-a11y` strict rules via the already-registered plugin object; add boundaries.

## Edge cases
- Chunk load failure/offline → kernel `failed` transition with Retry + link to `/plain` (content is in the main bundle).
- Unknown `/{os}` or app slug → `notFound()` on the server; on the client, repair to nearest valid route via `canonicalize`.
- JS disabled → Hello, `/go/*`, `/plain` and every OS URL still show complete semantic content.

## Feature IDs + acceptance tests

| ID | Feature | Acceptance test |
|---|---|---|
| `ARCH-TREE-01` | Folder tree exists as specified | `unit: folder-structure matches architecture manifest` |
| `ARCH-SHELL-01` | Shell persists across all navigations | `e2e: H1 shell instance id stable across app open, OS switch, back/forward` |
| `ARCH-STATIC-01` | All released routes statically generated | `unit: generateStaticParams equals registry enumeration` |
| `ARCH-HYDR-01` | No hydration mismatch with persisted state | `e2e: P1 reload with populated storage logs zero hydration warnings` |
| `ARCH-SPLIT-01` | One chunk per OS, none in first load | `perf: visiting /macos requests no ios/windows/android/linux chunk` |
| `ARCH-TYPES-01` | Strict types, zero `any` | `static: tsc + eslint no-explicit-any as error` |
| `ARCH-DEPS-01` | Dependency policy respected | `static: package.json diff check in CI` |
| `ARCH-FIX-01` | Scaffold defects fixed | `lhci: meta-viewport audit passes; e2e safe-area tokens non-zero on iPhone project` |
| `ARCH-LINT-01` | Import boundaries enforced | `static: boundary fixture files fail lint` |
| `ARCH-REL-01` | Only released OSes are visible | `unit: chooser + static params + sitemap use released set` |
| `ARCH-NOJS-01` | Full content without JavaScript | `e2e: W2 no-js project reads every section` |

## Open questions
None.
