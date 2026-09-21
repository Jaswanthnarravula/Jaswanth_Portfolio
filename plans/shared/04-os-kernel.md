# shared/04 — OS kernel

## Purpose
One engine for all five OSes: app registry, window/app lifecycle, z-order, per-OS sessions, OS switching,
persistence, focus, sound preference and capability detection. Pure TypeScript, framework-agnostic, fully
unit-tested. Requirements: R9, R36, R45, R46.

## Decisions

| Decision | Rationale | Rejected |
|---|---|---|
| Pure reducers + small state machines in `lib/kernel`; Zustand is only the container | Deterministic, testable in node, no React coupling | Logic inside components/hooks |
| Keyed on OS-agnostic **`AppRole`**; each OS *binds* a role to slug/title/icon/window policy | Shared logic, distinct skins | App ids per OS |
| **Singleton window per (os, role)**: `WindowId = \`${OsId}:${AppRole}\`` | "Open" is idempotent → rapid clicks just focus | Multiple instances per app |
| Z-order is an **array** (back → front); CSS `z-index` = index | No ever-growing integers, trivial to persist | Incrementing counters |
| Window geometry in **px, clamped, bucketed per size class** | Real OSes keep pixel size and clamp; normalized rects reflow unnaturally | Normalized 0..1 rects |
| Leaving an OS **unmounts it**; return restores from its session snapshot | One restore path for switch *and* refresh; hidden trees still cost memory | Keep all OSes mounted with `<Activity>` |
| `<Activity mode="hidden">` only for minimized/background windows inside the live OS | Frees effects, keeps state, same lifetime as the OS | — |
| Drag/resize/animation progress are **not** kernel state | No re-renders at 60 fps; kernel stores committed results only | Storing pointer positions |
| **Focus is a kernel output**: every action returns a `focusTarget`; one FocusManager applies it | Focus never lost to `<body>`; one owner | Per-component focus effects |
| All five personas are data only; **no reducer branches on `PersonaId`** | Owner decision: identical behaviour | Persona-tailored flows |

## Specification

### State model (authoritative type catalogue)

```ts
type Brand<T, B extends string> = T & { readonly __b: B };
export type RoutePath = Brand<`/${string}`, 'RoutePath'>;
export type WindowId  = Brand<`${OsId}:${AppRole}`, 'WindowId'>;
export type Epoch     = Brand<number, 'Epoch'>;
export type AssetId   = Brand<string, 'AssetId'>;

export type AppLocation =
  | { kind: 'root' }
  | { kind: 'content'; ref: ContentRef }
  | { kind: 'vfs'; path: readonly string[] };            // Linux cwd / file

export interface PxRect { x: number; y: number; w: number; h: number }
export interface WindowPolicy { mode: 'floating' | 'fullscreen' | 'tiled'; defaultRect: Record<SizeClass, PxRect>;
  minPx: { w: number; h: number }; resizable: boolean }
export interface OsAppBinding { role: AppRole; slug: string; title: string; icon: AssetId; window: WindowPolicy;
  pinned: boolean; owns: readonly SectionId[] }
export interface OsDefinition { id: OsId; chrome: 'desktop' | 'mobile' | 'terminal'; released: boolean;
  apps: readonly OsAppBinding[]; sectionOwner: Readonly<Record<SectionId, AppRole>> }

export type WindowPhase =
  | { s: 'opening'; originId: string | null }            // launcher element id, re-measured by motion layer
  | { s: 'normal' }
  | { s: 'maximized'; restore: PxRect }
  | { s: 'minimized'; restore: PxRect; wasMaximized: boolean }
  | { s: 'closing' };
export interface NavStack { entries: readonly AppLocation[]; index: number }
export interface WindowInstance { id: WindowId; os: OsId; role: AppRole; phase: WindowPhase;
  rect: Partial<Record<SizeClass, PxRect>>; nav: NavStack; scrollTop: number; draft?: string }

export interface TerminalSession { cwd: readonly string[]; history: readonly string[]; scrollback: readonly string[] } // capped 500
export interface OsSession { os: OsId; windows: Readonly<Partial<Record<WindowId, WindowInstance>>>;
  zOrder: readonly WindowId[]; focused: WindowId | null; terminal: TerminalSession | null;
  sizeClass: SizeClass; parkedAt: number | null; contentRev: string; bootSeen: boolean; lockSeen: boolean }

export type OsTransition =
  | { phase: 'idle' }
  | { phase: 'exiting';  epoch: Epoch; from: OsId | null; to: OsId | null }
  | { phase: 'loading';  epoch: Epoch; from: OsId | null; to: OsId; since: number }
  | { phase: 'entering'; epoch: Epoch; from: OsId | null; to: OsId }
  | { phase: 'failed';   epoch: Epoch; to: OsId; reason: 'chunk' | 'offline' | 'timeout' };

export type Onboarding = 'hello' | 'intro' | 'profiles' | 'chooser' | 'done';
export interface Continuity { ref: ContentRef; fromOs: OsId; at: number }
export interface KernelState { boot: 'ssr' | 'hydrating' | 'ready'; route: RouteState; activeOs: OsId | null;
  sessions: Readonly<Record<OsId, OsSession>>; transition: OsTransition; onboarding: Onboarding;
  viewport: { w: number; h: number; sizeClass: SizeClass; posture: Posture; orientation: 'portrait' | 'landscape' };
  capabilities: CapabilityProfile; continuity: Continuity | null }
export interface UserPreferences { v: 1; persona: PersonaId | null; lastOs: OsId | null; introSeen: boolean;
  sound: { enabled: boolean; volume: number }; motion: 'system' | 'reduced' | 'full';
  glass: 'system' | 'solid' | 'full'; theme: 'system' | 'light' | 'dark'; singleKeyShortcuts: boolean;
  tourOffered: boolean; eggsFound: readonly string[] }
export interface PersistedSessionsV1 { v: 1; savedAt: number; contentRev: string;
  sessions: Partial<Record<OsId, OsSession>>; learnedRects: Partial<Record<WindowId, Partial<Record<SizeClass, PxRect>>>> }
```

### Actions (every action returns `{ state, focusTarget, routeIntent }`)
`BOOT` · `ROUTE_CHANGED` · `VIEWPORT_CHANGED` · `OPEN_APP{role, location?, originId?}` · `CLOSE_WINDOW` ·
`FOCUS_WINDOW` · `MINIMIZE` · `RESTORE` · `TOGGLE_MAXIMIZE` · `COMMIT_RECT` · `NAVIGATE_IN_APP` · `APP_BACK` ·
`GO_HOME` (mobile) · `SWITCH_OS{to}` · `PHASE_DONE{epoch}` · `TRANSITION_FAILED` · `RETRY_TRANSITION` ·
`ONBOARDING_ADVANCE` · `SELECT_PERSONA` · `SET_PREF` · `TERMINAL_*` · `CONTINUITY_DISMISS` · `MARK_BOOT_SEEN` · `MARK_LOCK_SEEN`.

### Window phase guards (illegal transitions return the **same state reference**)

| From \ Action | OPEN | FOCUS | MINIMIZE | RESTORE | TOGGLE_MAX | CLOSE | PHASE_DONE |
|---|---|---|---|---|---|---|---|
| (none) | → opening | – | – | – | – | – | – |
| opening | focus | ✓ | – | – | – | → closing | → normal |
| normal | focus | ✓ | → minimized | – | → maximized | → closing | – |
| maximized | focus | ✓ | → minimized(wasMax) | – | → normal(restore) | → closing | – |
| minimized | → restore + focus | → restore | – | → normal/maximized | – | → closing | – |
| closing | re-open (cancel close) | – | – | – | – | – | removed |

### Sessions and restore rules (`KRN-SES-*`)
URL always wins for *OS + focused role + location*; the snapshot wins for everything else.

| Entry | Restored | Dropped |
|---|---|---|
| Same-tab OS re-entry | Full in-memory session, no TTL | Transient phases (`opening`→`normal`, `closing` removed); overlays never stored |
| Reload / back-forward / bfcache | Persisted session if < 24 h; geometry from the matching size-class bucket | `ContentRef`s that no longer resolve → truncated to parent |
| Cold deep link | Only the app the URL names (placed from `learnedRects`) | The snapshot's other windows |
| Cold `/{os}` | Session if < 30 min | Otherwise a clean home |
| Schema/`contentRev` mismatch | Result of `migrate`/revalidation | On failure: discard sessions; **prefs survive** (separate key) |

Desktop OS on `compact` size class → single-window (maximized) mode; stored floating rects are kept for later.

### OS switch transaction (`KRN-SWITCH-*`)
`SWITCH_OS` bumps the epoch → `exiting` (motion director plays exit, parks the session with `parkedAt`) →
`loading` (chunk import; boot screen after 150 ms — `{os}/surfaces/boot.md`) → `entering` → `idle`.
Any new switch or popstate during a transition bumps the epoch again: older timelines are killed, stale
`PHASE_DONE{epoch}` ignored; if the new target equals `from`, the running timeline reverses.
Failure → `failed` with Retry and a link to `/plain`; `online` event auto-retries.

### Persistence (`KRN-PERSIST-*`)
Zustand `persist` with `skipHydration: true`, custom **safe storage** (try/catch, in-memory fallback, debounced
writes 250 ms, flush on `pagehide`), validating `merge`, versioned `migrate`. Geometry is committed only on
pointer-up. Two keys: `pf.prefs.v1`, `pf.sessions.v1`.

### FocusManager (`KRN-FOCUS-*`)
Applies `focusTarget` with `preventScroll` when an animation **starts**, moves focus before setting
`inert`/`hidden`, and asserts focus is never on `<body>`. Rules per action live in `shared/09-accessibility.md`.

### Sound preference (`KRN-SOUND-01`)
`prefs.sound`. Intro sound defaults on (it answers a tap); all other UI sounds default off. `lib/audio` reads the
preference; nothing else may create an `AudioContext`.

### Capabilities (`KRN-CAP-01`)
`CapabilityProfile { tier: 0|1|2; deviceClass; pointer; hover; webgl2; reducedMotion; reducedTransparency; saveData }`
— detection algorithm and governor are specified in `shared/10-performance.md`; the kernel only stores the result.

## Edge cases (mechanism per case — R46)

| Case | Mechanism |
|---|---|
| Rapid repeated clicks | Singleton `WindowId` → open = focus; guard table returns same reference; `go()` dedupes |
| Many apps open | `zOrder` array; each window subscribes via its own selector |
| OS switch mid-animation | Epoch bump; director kills older timelines; stale completions ignored; reverse if returning |
| Resize/rotate during drag | Pointer capture; `pointercancel`/`lostpointercapture`/`blur`/resize commit the last valid rect; workspace `ResizeObserver` re-clamps keeping ≥ 48 px of title bar reachable |
| Refresh inside an app | Static page exists → fallback → boot → revive; URL wins |
| Back/Forward during transition | popstate takes the same epoch-retarget path as a user switch |
| Slow assets | `loading` phase + boot screen; chunk prefetch on chooser hover/focus and idle for `lastOs` |
| Offline / chunk failure | Two retries → `failed` with Retry + `/plain`; content is in the main bundle |
| Storage unavailable / quota / corrupt | Safe storage → memory fallback; corrupt JSON → defaults; never throws |
| Animation interrupted | End state always derives from kernel state → `kill()` + set final values is safe |
| Removed content in snapshot | Revalidated against `contentRev`; truncated to parent section |

## Feature IDs + acceptance tests

| ID | Feature | Acceptance test |
|---|---|---|
| `KRN-REG-01` | OS registry + role bindings; `sectionOwner` total | `unit: every section reachable in every OS` |
| `KRN-WIN-01` | Idempotent open / focus | `unit: open() on an open app raises instead of duplicating` |
| `KRN-WIN-02` | Phase guard table | `unit: illegal transitions return identical state reference` |
| `KRN-WIN-03` | Minimize / restore / maximize round-trips | `unit: restore returns prior rect and wasMaximized` |
| `KRN-Z-01` | Z-order array semantics | `unit: focus moves id to end; close removes; index = z-index` |
| `KRN-GEO-01` | Px geometry, clamp, size-class buckets | `unit: clampGeometry keeps 48px of title bar on-screen` |
| `KRN-SES-01` | Restore rules table | `unit: each entry type restores/drops as specified` |
| `KRN-SES-02` | Staleness + `contentRev` revalidation | `unit: removed slug truncates to parent` |
| `KRN-SWITCH-01` | Epoch-tagged OS switch | `unit: stale PHASE_DONE ignored; return-to-origin reverses` |
| `KRN-SWITCH-02` | Failure + retry path | `e2e: offline chunk load shows Retry and /plain, recovers online` |
| `KRN-PERSIST-01` | Safe storage + migrations | `unit: quota error → memory fallback; corrupt → defaults` |
| `KRN-PERSIST-02` | Prefs survive session schema bump | `unit: sessions discarded, prefs intact` |
| `KRN-FOCUS-01` | Focus target per action; never on body | `cmp: focus never on body across open/close/minimize` |
| `KRN-SOUND-01` | Sound preference | `unit: only intro sound enabled by default` |
| `KRN-CAP-01` | Capability profile stored | `unit: profile shape + demotion persisted` |
| `KRN-PERSONA-01` | No reducer branches on persona | `unit: SELECT_PERSONA yields identical next state for all five ids (except stored id)` |
| `KRN-EDGE-01` | Edge-case table | `e2e: impatience test script (spam, back, rotate, resize) leaves valid state` |

## Open questions
None.
