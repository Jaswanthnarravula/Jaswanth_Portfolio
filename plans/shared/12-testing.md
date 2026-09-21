# shared/12 — Testing

## Purpose
Production-quality verification of state logic, terminal parsing, mappings, routing, keyboard behaviour,
responsive layouts, critical interactions, reduced motion, accessibility, performance and end-to-end journeys
across all five OSes. Every feature ID names one of the tests defined by this strategy. Requirements: R47, T.

## Decisions

| Decision | Rationale | Rejected |
|---|---|---|
| **Vitest** — default `node` env; a `jsdom` project only for `*.test.tsx`; `globals: false` | TS 6 does not auto-include ambient `@types`; explicit imports avoid `expect` collisions with Playwright | happy-dom (weaker focus/selection/accname fidelity); Jest |
| **React Testing Library + user-event + jest-dom** for keyboard/focus behaviour | Tests what users do | Enzyme-style internals |
| **Playwright** for e2e with device projects; `@axe-core/playwright`; ARIA snapshots | Real browsers incl. WebKit; async Server Components need a real server | Cypress; Vitest browser mode (a third environment) |
| **Lighthouse CI** for LCP/CLS/TBT/a11y/budgets; **INP in Playwright** via `web-vitals` + CDP 4× throttle | Lighthouse navigation mode cannot measure INP | Lighthouse for INP |
| Bundle budgets via Lighthouse `resource-summary` per route | Turbopack chunk names are hashed → `size-limit` globs don't work | webpack analyzers in CI |
| **No new ESLint plugins in v1** (risk 19) | `eslint-plugin-react` already crashed once on ESLint 10 | testing-library/playwright/vitest lint plugins |
| Visual baselines generated **only in the Linux CI container** | Windows-rendered baselines never match Linux CI | Local baselines |
| Kernel behind a `RouterPort`/`HistoryPort` | Component tests need no Next mocks | Mocking `next/navigation` everywhere |

## Specification

### Layers
**Static** — `tsc --noEmit`, ESLint (jsx-a11y strict as errors, import boundaries, `no-explicit-any`), Prettier,
`check-plans`, `check-content`.

**Unit (Vitest, node, ~70 %)** — kernel reducers + guard tables, route codec + `go()` table, persistence
migrations, size-class classifier, keymap deny-list, scrim contrast, asset manifest, search matcher/ranking,
terminal tokenizer/parser/VFS/commands/completion/hints, mapping invariants (`sectionOwner` total; static params
= registry), GitHub snapshot fallback, persona identity (`KRN-PERSONA-01`).

**Component (Vitest + jsdom + RTL, ~20 %)** — the five a11y primitives (APG suites), window frame (Move mode,
minimized is hidden), focus never on body, Spotlight combobox, terminal input (Tab pass-through, synchronous
announcer, Ctrl+C with selection copies), notifications (region pre-exists; hover pauses), content views. An
`axe-core` helper runs with contrast checks disabled (jsdom cannot evaluate them).

**End-to-end (Playwright, ~10 %)** — journeys below.

### Journey catalogue (IDs referenced by feature acceptance tests)

| ID | Journey |
|---|---|
| W1 | Hello → Tap to begin → intro (skip + full) → each of 5 profiles → chooser → OS (identical path asserted) |
| W2 | No-JS: `/`, `/plain`, `/go/*`, one deep link per OS show complete content |
| W3 | Audio: blocked, missing, muted, both asset modes — intro always completes |
| D1 | Cold deep link per OS: only the named app opens, **no boot/lock screen** |
| D2 | Unknown route / removed slug / unreleased OS repair |
| H1 | Back/Forward consistency: URL, top window and focus target at every step; no full reload |
| P1 | Persistence: reload, per-OS isolation, corrupt storage, TTL expiry |
| R1 | Reduced-motion smoke across all OSes: `getAnimations()` nothing > 200 ms; final states match |
| O1 | Rotate mid-session: windows clamped, return flight lands on the new icon rect |
| C1 | Cross-OS continuity: view a project in one OS → switch → offered, never auto-opened |
| S1 | System search: same query finds the same content in every OS's search skin |
| T1 | Tour: offered once, cancel leaves valid focused state, Linux tour never presses Enter |
| M1 / M2 / M3 | macOS keyboard-only (move, minimize, restore, close) / mouse (drag, resize, z-order, context + menu bar) / compact mode |
| N1 / N2 / N3 | Windows Start search → window / Snap + toasts / compact Start sheet + Back |
| I1 / I2 | iOS open app → Home, focus lands on icon / folder → Spotlight → résumé |
| A1 / A2 | Android drawer → app → `goBack()` / shade → notification → app |
| L1 / L2 / L3 | Linux command suite + exact error strings / hint inserts, never executes / mobile accessory row + `visualViewport` |
| X1 | axe WCAG 2.2 AA on every OS home + one app per OS + open overlays |
| X2 | `toMatchAriaSnapshot` per shell · X3 tap-target audit · X4 no horizontal scroll at 320 px · X5 live blur count ≤ 3 |
| Q1 | Résumé reachable in 1 click from every surface of every OS |

### Playwright project matrix

| Project | Runs |
|---|---|
| `chromium-desktop` 1440×900 (all journeys) · `iphone` (WebKit) · `pixel` (Chromium) · `reduced-motion` · `no-js` · `perf` · `asset-original` | **PR gate** |
| `firefox-desktop` 1366×768 · `ipad-portrait` · `ipad-landscape` | smoke on PR, full nightly |
| `webkit-desktop` · `iphone-landscape` · `forced-colors` + `contrast: more` · `visual` (12 shots, Linux container, `page.clock` frozen) · `leak` loop | nightly |

### Gates
**PR:** static → Vitest with coverage (kernel/terminal/routing ≥ 90 %, global ≥ 80 %) → `next build` → sharded e2e
→ Lighthouse CI → INP. **Nightly:** full matrix, visual regression, Lighthouse against the Vercel URL, leak loop,
`npm audit --omit=dev`. **Per release (manual):** real iPhone + Android (keyboard up, rotate), VoiceOver, TalkBack, NVDA.

### Performance assertions
Lighthouse CI against `next start`, 3 runs, median; mobile preset on all routes, desktop preset for macOS/Windows.
Error-level: `categories:accessibility ≥ 0.95`, LCP ≤ 2500, CLS ≤ 0.1, TBT ≤ 200, per-route
`resource-summary:script:size`. INP: inject `web-vitals`, 4× CDP CPU throttle, scripted interactions per OS,
assert INP ≤ 200 and session CLS ≤ 0.1. Field data via Speed Insights (`shared/18-analytics.md`).

### Test doubles
`HistoryPort` memory adapter · `AnalyticsPort` no-op · audio engine fake · `visualViewport` shim · safe-area token
overrides · fixed clock · deterministic portfolio fixture (so tests don't depend on real content).

### CI
GitHub Actions: `check` → `unit` → `build` → `e2e` (sharded ×4) → `lhci` → `inp`; nightly workflow; artifacts =
traces, screenshots, Lighthouse reports. Node 22 (`.nvmrc`); `engines` raised to match tool floors at install.

## Edge cases
Flaky animation timing → tests assert end states and use `page.clock`; never sleep. WebGL in CI → the tier-2
path is tested with a forced-tier flag and a software-GL allowance in the test project only.

## Feature IDs + acceptance tests

| ID | Feature | Acceptance test |
|---|---|---|
| `TEST-TOOL-01` | Vitest + RTL + Playwright + axe + LHCI installed and wired | `ci: all stages run on a PR` |
| `TEST-UNIT-01` | Coverage thresholds | `ci: kernel/terminal/routing ≥ 90 %, global ≥ 80 %` |
| `TEST-E2E-01` | Journey catalogue implemented | `ci: every journey id has a spec file` |
| `TEST-MATRIX-01` | Project matrix (PR vs nightly) | `ci: matrix config matches this file` |
| `TEST-PERF-01` | LHCI + INP assertions | `ci: thresholds as specified` |
| `TEST-DOUBLE-01` | Ports and doubles | `unit: kernel tests run without Next or DOM` |
| `TEST-VIS-01` | Container-only visual baselines | `nightly: visual job green` |
| `TEST-MANUAL-01` | Per-release manual script recorded | `release: checklist signed in STATUS.md` |

## Open questions
None.
