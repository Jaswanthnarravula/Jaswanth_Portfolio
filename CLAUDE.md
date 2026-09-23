# CLAUDE.md — rules for every session in this repository

## What this project is
Jaswanth's portfolio, built as **five miniature interactive operating systems** — iOS, macOS, Windows 11, Android and a
Linux terminal — in which his career exists as applications, files, windows, commands and system surfaces.

**It is NOT an OS-themed website.** If something you are about to build would look at home on an ordinary portfolio
(hero section, card grid, an icon that links to a page section, a modal pretending to be a window, a terminal made of
`if (input === 'ls')`), stop — it is wrong here. The full list of banned shortcuts is in `plans/00-north-star.md`.

## The plans are the source of truth
`/plans` contains 148 focused documents and **930 feature IDs**. Code follows the plans. Nothing is built that is not
planned; nothing planned is silently dropped.

### Before doing ANY work, read in this order
1. `plans/README.md` — layout, canonical vocabulary, feature-ID rules
2. `plans/00-north-star.md` — banned shortcuts, distinctness contract, smell tests
3. `plans/STATUS.md` — current phase and progress
4. The current phase's work order in `plans/05-roadmap.md`
5. The `README.md` of the folder you are working in, then **only** the files your work order lists

### How to work
- **Work by feature ID.** One change = one or more IDs + their named acceptance tests + a ledger update.
- Status flow: `planned` → `built` → `verified`. **Never mark `verified` without evidence** (test name / CI run / capture).
- Cannot build something as specified? Mark it **`BLOCKED`** with the reason and ask the owner. **Never quietly
  simplify, stub, or skip.**
- Any departure from a spec goes in that folder's **Deviations log** with the reason and the owner's sign-off.
- OS files never restate a shared rule — they link to `plans/shared/*` by ID. If you need to change a rule, change it
  in the one place it lives.
- Update `plans/STATUS.md` in the same change as the ledger.
- One OS at a time. A phase starts only after the previous gate passed **and the owner has reviewed it**.
- New ideas go to the Backlog in `plans/05-roadmap.md`, not into the current work order.

## Non-negotiable product rules
- **Every OS must be genuinely different** (navigation philosophy, open/close metaphor, Back behaviour, spacing, type,
  motion, system surfaces, feedback). Every surface/app spec ends with "Not like the others" — make it true.
- **One portfolio fact lives in one place** (`data/portfolio.ts`) and reaches UI only through `data/selectors` and
  `components/content/*`. Never type career content into an OS component.
- **All five "Who's watching?" profiles behave identically** — same navigation to the OS chooser, no per-profile
  differences anywhere. No reducer may branch on `PersonaId`.
- **Input always wins.** Every animation is interruptible; none may delay access to information. Animated values are
  never in React state or JSX `style`; only `transform`, `opacity`, `clip-path` animate.
- **Hints and tours insert, never execute.** The visitor presses Enter. Nothing autoplays (sound is tap-unlocked).
- **Accessibility is production-critical:** never `role="application"`; windows are labelled regions, not dialogs;
  launchers are real links; focus never rests on `<body>`; every gesture has a non-gesture alternative.
- **Performance:** LCP < 2.5 s, INP < 200 ms, CLS < 0.1, Lighthouse a11y ≥ 95. WebGL = one imperative three.js shader on
  the Hello/chooser pages, top tier only, idle-loaded — **never inside an OS**. R3F, drei and the GLTF/KTX2 pipeline are
  dormant (see `plans/shared/10-performance.md`). ≤ 3 live `backdrop-filter` surfaces per screen; 0 on Android.
- **Assets:** official artwork is a removable overlay over a complete original baseline; `ASSET_MODE=official|original`
  must always work in both modes. Third-party marks never appear in titles, favicons or OG cards. SF Pro / Segoe UI are
  never self-hosted (system font stacks only).
- **Static site, no backend.** Contact is a `mailto:` hand-off. GitHub data is fetched at build time and can never
  fail a build.
- **Dependencies:** exact pins; no new dependency without updating `plans/shared/01-architecture.md` and the budgets.
  No `react-aria`, no framer-motion, no new ESLint plugins in v1. Read `REQUIREMENTS.md` for the version constraints.

## Import boundaries (enforced by lint)
- `components/os/{a}` may not import `components/os/{b}`.
- OS code may not import `data/portfolio` directly.
- `history.*`, `localStorage`, `AudioContext`, raw `requestAnimationFrame` and analytics calls are allowed only inside
  `lib/kernel`, `lib/audio`, `lib/motion`, `lib/analytics`.
- `lib/kernel` and `lib/terminal` may not import React.

## Commands
`npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint` · `npm run check`. Profile **production builds**
(`npm run build && npm start`), never the dev server. Commit only when the owner asks.

## Owner preferences
- Plans first; granular; risks closed by design with working defaults — never present open risks or "inputs needed".
- Explain in short, simple lines.
- Pause for review at every phase gate.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
