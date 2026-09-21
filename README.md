# Jaswanth Narravula — Portfolio

Five miniature, interactive operating systems — iOS, macOS, Windows 11, Android and a Linux terminal — in which one
career exists as applications, files, windows, commands and system surfaces. A plain reader version (`/plain`) and
shareable content pages (`/go/*`) work without JavaScript.

The plans in [`plans/`](./plans/README.md) are the source of truth (930 feature IDs, one ledger row each);
[`plans/STATUS.md`](./plans/STATUS.md) shows where the build stands. Rules for contributors are in
[`CLAUDE.md`](./CLAUDE.md).

## Getting started

```bash
nvm use          # Node 22 (see .nvmrc)
npm install
cp .env.example .env.local
npm run dev
```

## Commands

| Command | What it does |
|---|---|
| `npm run check` | Typecheck · lint (a11y strict, import boundaries) · Prettier · plan ledgers · résumé freshness |
| `npm run test:coverage` | Unit + component tests (Vitest) with coverage thresholds |
| `npm run build` | Production build, then the post-build audit (every route static, no secret in client assets) |
| `npm run test:e2e:build` then `npm run test:e2e` | Both production builds (official + original assets), then the Playwright matrix |
| `npm run test:perf` | Lighthouse CI against the production build |
| `npm run build:resume` | Publishes the résumé PDF (the owner's `content/resume.pdf`, else generated from `data/portfolio.ts`) |
| `npm run assets:ingest` | Validates and ingests artwork dropped in `assets-inbox/` |

Always profile production builds (`npm run build && npm start`), never the dev server.

## Stack

Next 16 (App Router, fully static) · React 19.2 · TypeScript 6 (strict) · Zustand 5 · GSAP 3 · Tailwind 4 ·
Vitest · Playwright · Lighthouse CI · Vercel. One imperative three.js shader is reserved for the welcome pages;
React Three Fiber and the GLTF pipeline stay dormant (see `plans/shared/10-performance.md`).
Pinned versions and constraints: [REQUIREMENTS.md](./REQUIREMENTS.md).
