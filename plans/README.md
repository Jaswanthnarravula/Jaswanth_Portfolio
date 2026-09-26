# Plans — source of truth for the Five-OS Portfolio

This directory is the architectural source of truth. Code follows the plans; when they disagree, either the
code is wrong or the plan is updated **in the same change** with a logged deviation. Nothing is built that is
not planned here, and nothing planned here is silently dropped.

> This is **five miniature operating systems** that contain Jaswanth's career as applications, files, windows
> and commands. It is **not** an OS-themed website. Read `00-north-star.md` before anything else.

## How to use these plans (every session, human or AI)

1. Read, in order: this file → `00-north-star.md` → `STATUS.md` → the current phase in `05-roadmap.md`.
2. Open the folder you are working in and read its `README.md`, then only the files your work order lists.
3. Work **by feature ID**. One change = one or more IDs, their named acceptance tests, and a ledger update.
4. Never mark an ID `verified` without its evidence (test name or capture) in the ledger.
5. Cannot build something as specified? Mark it `BLOCKED` with the reason and ask — never quietly simplify.
6. Any departure from a spec goes in that folder's **Deviations log** with the reason and the owner's sign-off.
7. OS files never restate a shared rule — they link to it by ID. One rule lives in exactly one place.

## Reading order and layout

| Path | What it holds |
|---|---|
| `00-north-star.md` | Vision, banned shortcuts, distinctness contract, quality bar, smell tests |
| `01-requirements-trace.md` | Every owner requirement → plan file + feature-ID prefix (none unmapped) |
| `02-hello-page.md` · `03-netflix-page.md` · `04-os-chooser.md` | The three pre-OS pages, in visitor order |
| `05-roadmap.md` | Phases as work orders (feature IDs + files to read) and their gates |
| `06-onboarding-acceptance.md` | Ledger for the three pre-OS pages |
| `STATUS.md` | Roll-up of every ledger per phase |
| `visual-targets/` | The owner's approved storyboard frames (PNG) + their source CSS, and `frames/` (every frame full screen at 1440 × 900) — the required look of the welcome screens, the chooser and each OS |
| `shared/` | Cross-cutting contracts `01`–`21`, `23` + `22-acceptance.md` (ledger) |
| `macos/` `windows/` `ios/` `android/` `linux/` | One dedicated folder per OS: identity, lifecycle, `surfaces/`, `apps/`, motion, responsive, accessibility, edge cases, cross-OS features, acceptance ledger |

Build order of the OSes (and writing order of their plans): **macOS → Windows 11 → iOS → Android → Linux**.

## Canonical vocabulary (use these exact identifiers everywhere)

| Term | Values |
|---|---|
| `OsId` | `ios` · `macos` · `windows` · `android` · `linux` |
| `SectionId` | `about` · `projects` · `experience` · `skills` · `education` · `resume` · `contact` |
| `AppRole` | `browser` · `github` · `mail` · `messages` · `files` · `viewer` · `editor` · `terminal` · `notes` · `settings` |
| `PersonaId` | `recruiter` · `developer` · `adventurer` · `designer` · `guest` — **all behave identically** |
| `ContentRef` | `{ section }` or `{ section: 'projects' \| 'experience' \| 'education', slug }` — OS-agnostic pointer to content |
| Size class | `compact` · `medium` · `expanded` · `large` (CSS-driven) |
| Posture | `compact` · `touch` · `pointer` (kernel behaviour switch) |
| Tier axes | `data-tier="0\|1\|2"` · `data-motion="full\|reduced"` · `data-glass="full\|solid"` on `<html>` |
| Asset mode | `ASSET_MODE=official\|original` (production default `official`) |
| Storage keys | `pf.prefs.v1` (long-lived) · `pf.sessions.v1` (24 h TTL) |
| Ledger status | `planned` → `built` → `verified` · or `BLOCKED` (reason + owner sign-off) |
| Phases | `P0` Foundation · `P1` Welcome · `P2` Vertical slice · `P3` macOS · `P4` Windows · `P5` iOS · `P6` Android · `P7` Linux · `P8` Polish |

### URL grammar (defined in `shared/05-routing-and-history.md`)

```
/                                   hello → intro → profiles → chooser   (one history entry)
/{os}                               OS home
/{os}/{appSlug}[/{section}][/{slug}] focused app + its location
/go/{section}[/{slug}]              canonical OS-agnostic share link (resolves into an OS)
/plain                              non-redirecting semantic reader mode ("Skip the OS")
```

### App slugs per OS

| Role | macOS | Windows | iOS | Android | Linux |
|---|---|---|---|---|---|
| `browser` | `safari` | `edge` | `safari` | `chrome` | — |
| `github` | `github` | `github` | `github` | `github` | — |
| `files` | `finder` | `explorer` | `files` | `files` | — |
| `viewer` | `preview` | — (Edge PDF tab) | — (Quick Look in Files) | — (PDF viewer in Files) | `viewer` |
| `editor` | `vscode` | `vscode` | — | — | — |
| `terminal` | `terminal` | `terminal` | — | — | `terminal` |
| `notes` | — | — | `notes` | `keep` | — |
| `mail` | `mail` | `outlook` | `mail` | `gmail` | — |
| `messages` | — | — | `messages` | — | — |
| `settings` | `settings` | `settings` | `settings` | `settings` | — (commands) |

### Section ownership (`sectionOwner`, total for every OS — unit-tested)

| Section | macOS | Windows | iOS | Android | Linux |
|---|---|---|---|---|---|
| `about` | safari | edge | safari | chrome | terminal (`cat about.txt`) |
| `projects` | github | github | github | github | terminal (`~/projects`) → viewer on `open` |
| `experience` | finder | explorer | files | files | terminal (`~/experience`) → viewer on `open` |
| `education` | finder | explorer | files | files | terminal (`~/education`) |
| `resume` | preview | edge (PDF tab) | files (Quick Look) | files (PDF viewer) | viewer (`open resume`) |
| `skills` | vscode | vscode | notes | keep | terminal (`cat skills.txt`) |
| `contact` | mail | outlook | mail | gmail | terminal (`contact`) |

## Feature IDs

Format `{PREFIX}-{AREA}-{NN}` (Linux commands use the command name: `LNX-CMD-cd`). Every ID:
belongs to exactly one spec file, appears exactly once in exactly one ledger, names its acceptance test, and is
assigned to exactly one phase in `05-roadmap.md`. `scripts/check-plans.mjs` (added in P0) enforces this in CI.

| Prefix | Owner file(s) |
|---|---|
| `HELLO` · `NFLX` · `CHOOSE` | `02-hello-page.md` · `03-netflix-page.md` · `04-os-chooser.md` |
| `ARCH` `DATA` `VIEW` `KRN` `ROUTE` `DS` `MOTION` `RESP` `A11Y` `PERF` `ASSET` `TEST` `DEPLOY` | `shared/01` … `shared/13` |
| `RES` `SRCH` `CONT` `GH` `ANL` `OG` `TOUR` `EGG` | `shared/14` … `shared/21` |
| `CONTENT` | `shared/23-content-depth.md` |
| `MAC` `WIN` `IOS` `AND` `LNX` | the OS folders |

## File templates

**Surface / app file** — Role + requirement refs · Portfolio mapping · Anatomy · Behaviour & states · Navigation
& routes · Motion · Responsive · Accessibility · Edge cases · Feature IDs + acceptance tests · **Not like the others**.

**Shared contract file** — Purpose · Decisions (rationale + rejected alternatives) · Specification ·
Types/interfaces · Edge cases · Feature IDs + acceptance tests · Open questions.

**Acceptance file** — Ledger table (`ID · Feature · Spec · Phase · Status · Evidence · Deviation`) ·
Definition-of-done audit checklist · Deviations log.

## Decision log

| Date | Decision | Where |
|---|---|---|
| 2026-09-25 | **Content depth.** Owner-approved copy (recruiter card, Now note, role scope, case studies, three deep dives, credential and skill corrections) from the owner's own answers; work authorization, GPA and recommendations are never shown. Deep dives live inside each OS's GitHub app (no new routes); "Now" gets one native surface per OS. Delivered in P8 | owner conversation + "Portfolio Copy Review" page; `shared/23-content-depth.md` |
| 2026-09-21 | **Welcome screens = the storyboard frames.** Hello (top bar, field, face, name), the intro, "Who's watching?" and the chooser use the frame's own unit (1 em = 1.42 % of a 16:10 screen) and values, and land on its pixels at any 16:10 size; returning-visitor controls (replay, Sound on the profiles) appear only where the frame's first visit has none. | owner conversation ("exactly same as this html page"); `02`/`03`/`04` "Visual target", `06-onboarding-acceptance.md` Deviations log |
| 2026-09-21 | **Owner visual targets.** The chooser and every OS must look exactly like the approved storyboard frames (`plans/visual-targets/`), and exactly like the real OS wherever a frame abbreviates it — not "close". Sample names in the frames are replaced by real data. | owner conversation; `00-north-star.md` smell test 8, `shared/06-design-system.md`, each `{os}/01-identity.md`, `04-os-chooser.md` |
| 2026-09-21 | Owner authorized implementation to completion and reconstruction of any missing plans. Proceed through validated gates without repeat permission requests; do not waive tests or claim manual checks were performed. | owner conversation; `IMPLEMENTATION.md` |
| 2026-09-21 | **No device frames.** iOS and Android fill the whole page at every size: phone layout on phones, full-page iPadOS / large-screen Android layout on tablets, laptops and desktops. Chooser cards are page-shaped snapshots, not device outlines. | owner conversation; `00-north-star.md` B17, `shared/08-responsive.md`, `ios/04`, `android/04`, `04-os-chooser.md` |
| 2026-09-21 | LinkedIn is the primary career source; GitHub supports project details. Do not infer missing dates, proficiency ratings, or metrics. | owner conversation; `shared/02-portfolio-data.md` |
| 2026-09-20 | Plans before implementation; nested per-OS plans; feature IDs + ledgers; owner review after plans | this file |
| 2026-09-20 | Official icons everywhere, production default `ASSET_MODE=official`, complete original baseline | `shared/11-assets.md` |
| 2026-09-20 | Flow: Hello → Tap to begin → Netflix intro + sound → Who's watching? → OS chooser → OS | `02`–`04` |
| 2026-09-20 | All five profiles behave identically — same navigation to the chooser, no per-profile differences | `03-netflix-page.md` |
| 2026-09-20 | Contact is `mailto:` hand-off; site fully static | `shared/03-content-views.md` |
| 2026-09-20 | WebGL = imperative three.js (one shader, top tier only); R3F/drei/GLTF pipeline dormant | `shared/10-performance.md`, `02-hello-page.md` |
| 2026-09-20 | No `react-aria`; five hand-built APG primitives wired to the kernel FocusManager | `shared/09-accessibility.md` |
| 2026-09-20 | Window geometry stored in px, clamped, bucketed per size class | `shared/04-os-kernel.md` |
| 2026-09-20 | Ten additions accepted (résumé fast path, boot, lock screen, GitHub data, eggs, continuity, search, analytics, OG cards, tour) | `shared/14`–`21` |
| 2026-09-20 | Two ledger files added beyond the approved tree so every ID has a home: `06-onboarding-acceptance.md`, `shared/22-acceptance.md` | this file |
