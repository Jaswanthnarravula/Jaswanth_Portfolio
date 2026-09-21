# Requirements

Tech stack and environment contract for the portfolio. Every version below is
pinned exactly in `package.json` (no `^` / `~`) — the matrix has real constraints
in it, documented under [Version constraints](#version-constraints).

Verified on this matrix: `npm run build` (Turbopack **and** webpack),
`npm run typecheck`, and `npm run lint` all pass.

---

## Environment

| Requirement | Version  | Notes                                       |
| ----------- | -------- | ------------------------------------------- |
| Node.js     | `>=20.9` | Pinned to `22` via `.nvmrc`; built on 22.17 |
| npm         | `>=10`   | `package-lock.json` is committed            |

---

## Runtime dependencies

### Framework

| Package     | Version  | Role                                         |
| ----------- | -------- | -------------------------------------------- |
| `next`      | `16.3.5` | App Router, RSC, Turbopack (default bundler) |
| `react`     | `19.2.8` | See [constraint 1](#1-react-is-held-at-192)  |
| `react-dom` | `19.2.8` | Must match `react` exactly                   |

### 3D / WebGL

| Package              | Version   | Role                                              |
| -------------------- | --------- | ------------------------------------------------- |
| `three`              | `0.186.0` | WebGL 2 renderer, loaders, math                   |
| `@react-three/fiber` | `9.7.0`   | React reconciler for three                        |
| `@react-three/drei`  | `10.7.8`  | Helpers: controls, loaders, environments, staging |

WebGL 2 needs no package — `WebGLRenderer` targets it by default in three
`0.186`. WebGL 1 is no longer supported by this version of three.

### Animation / scroll

| Package       | Version  | Role                                                                                                                                      |
| ------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `gsap`        | `3.15.0` | Tween engine. **ScrollTrigger ships inside this package** — free since 3.12, imported as `gsap/ScrollTrigger`, never installed separately |
| `@gsap/react` | `2.1.2`  | `useGSAP()` — scoped animation contexts with React cleanup                                                                                |
| `lenis`       | `1.3.26` | Smooth scroll. React bindings at `lenis/react` (`ReactLenis`)                                                                             |

Lenis and ScrollTrigger have to be wired to each other (Lenis drives scroll
position, ScrollTrigger reads it) — that wiring is implementation, not setup.
`app/globals.css` already sets `scroll-behavior: auto` so native smooth
scrolling does not fight Lenis, and handles the `.lenis-stopped` lock class.

### State

| Package   | Version  | Role                               |
| --------- | -------- | ---------------------------------- |
| `zustand` | `5.0.15` | Store shared across DOM and canvas |

---

## Dev dependencies

### Language / types

| Package            | Version   | Notes                                           |
| ------------------ | --------- | ----------------------------------------------- |
| `typescript`       | `6.0.3`   | See [constraint 2](#2-typescript-is-held-at-60) |
| `@types/react`     | `19.2.18` | Tracks the pinned React minor                   |
| `@types/react-dom` | `19.2.7`  | Tracks the pinned React minor                   |
| `@types/three`     | `0.186.0` | Must match the `three` minor                    |
| `@types/node`      | `26.6.2`  |                                                 |

### Styling

| Package                | Version  | Notes                                              |
| ---------------------- | -------- | -------------------------------------------------- |
| `tailwindcss`          | `4.3.3`  | v4 — **CSS-first config, no `tailwind.config.js`** |
| `@tailwindcss/postcss` | `4.3.3`  | The only PostCSS plugin required                   |
| `postcss`              | `8.5.28` |                                                    |

Theme tokens go in the `@theme { ... }` block in `app/globals.css`, not in a JS
config file.

### GLSL

| Package      | Version | Notes                                             |
| ------------ | ------- | ------------------------------------------------- |
| `raw-loader` | `4.0.2` | Turns `.glsl/.vert/.frag/.vs/.fs` into JS strings |

Wired in `next.config.ts` for **both** bundlers — `turbopack.rules` (one rule per
extension, because Turbopack does not brace-expand glob keys) and an equivalent
`webpack()` rule, so `next build` and `next build --webpack` behave identically.
Module types live in `types/glsl.d.ts`, so `import frag from '@/shaders/x.frag'`
is typed as `string`.

`raw-loader` is formally deprecated but is the workable option under Turbopack:
Turbopack rules require a loader and have no equivalent of webpack's built-in
`type: 'asset/source'`. It is build-time only and ships no runtime code.

> Shader composition (`#pragma glslify: import`) is **not** installed. Add
> `glslify-loader` + `glslify` and prepend them to the loader arrays in
> `next.config.ts` if you want importable shader chunks.

### Asset pipeline (GLTF/GLB, Draco, Meshopt, KTX2)

| Package                      | Version | Role                                                   |
| ---------------------------- | ------- | ------------------------------------------------------ |
| `@gltf-transform/cli`        | `4.5.0` | The `gltf-transform` command                           |
| `@gltf-transform/core`       | `4.5.0` | Programmatic API for custom pipeline scripts           |
| `@gltf-transform/extensions` | `4.5.0` | `KHR_draco_*`, `EXT_meshopt_*`, `KHR_texture_basisu`   |
| `@gltf-transform/functions`  | `4.5.0` | `draco()`, `meshopt()`, `textureCompress()` transforms |
| `draco3d`                    | `1.5.7` | Draco encoder (compression side)                       |
| `meshoptimizer`              | `1.2.0` | Meshopt encoder (compression side)                     |

**Decoders are served from our own origin, not a third-party CDN.**
`scripts/copy-decoders.mjs` runs on `postinstall` and copies them out of
`node_modules/three`:

```
public/decoders/draco/   ->  DRACOLoader.setDecoderPath('/decoders/draco/')
public/decoders/basis/   ->  KTX2Loader.setTranscoderPath('/decoders/basis/')
```

Meshopt needs no copy — three ships `MeshoptDecoder` as a bundled ES module at
`three/examples/jsm/libs/meshopt_decoder.module.js`.

`public/decoders/` is **gitignored** because it is generated. Re-create it any
time with `npm run setup:decoders`.

> **External, non-npm requirement for KTX2 encoding.** `gltf-transform uastc` and
> `etc1s` shell out to the `ktx` binary from
> [KTX-Software](https://github.com/KhronosGroup/KTX-Software/releases), which
> **npm does not install**. Install it separately and put it on `PATH` before
> running `npm run gltf:ktx2`. Draco and Meshopt compression need no external
> binary. Runtime _decoding_ of `.ktx2` needs no binary either — only the basis
> transcoder files already copied into `public/decoders/basis/`.

### Lint / format

| Package                       | Version   | Notes                                                                         |
| ----------------------------- | --------- | ----------------------------------------------------------------------------- |
| `eslint`                      | `10.11.0` | Flat config; see [constraint 3](#3-eslint-10-needs-an-explicit-react-version) |
| `eslint-config-next`          | `16.3.5`  | Exports native flat config — no `FlatCompat` shim needed                      |
| `prettier`                    | `3.9.8`   |                                                                               |
| `prettier-plugin-tailwindcss` | `0.8.1`   | Sorts Tailwind class strings                                                  |

`next lint` was removed in Next 16, so `npm run lint` calls `eslint` directly.

### Deployment

| Package  | Version   | Notes                                         |
| -------- | --------- | --------------------------------------------- |
| `vercel` | `59.23.2` | CLI, for local `vercel dev` / preview deploys |

`vercel.json` sets immutable long-lived cache headers on `/decoders/*`,
`/models/*` and `/textures/*` — content-addressed binary assets that should never
be revalidated.

> **Audit note.** All 29 `npm audit` advisories in this project come from the
> `vercel` CLI's transitive tree. `npm audit --omit=dev` reports **0
> vulnerabilities** — none of it reaches the deployed bundle. If you deploy via
> the Vercel Git integration instead of the CLI, `npm remove vercel` clears the
> audit entirely.

---

## Version constraints

These are the non-obvious pins. Changing them breaks the install or the build.

### 1. React is held at 19.2

`@react-three/fiber@9.7.0` declares `react: ">=19 <19.3"`. React `19.3.0` is
released and sits **outside** that range, so installing it either fails npm
resolution or, under `--legacy-peer-deps`, silently produces a mismatched
reconciler.

React and React DOM are therefore pinned to `19.2.8`, the newest release R3F
accepts. Revisit when R3F widens its peer range.

### 2. TypeScript is held at 6.0

`typescript@7.0.2` (the native port) is the current `latest` tag, but
`typescript-eslint@8.70.0` — pulled in by `eslint-config-next` — declares
`typescript: ">=4.8.4 <6.1.0"`. TS 7 would break type-aware linting.

`6.0.3` is the newest release inside that window.

### 3. ESLint 10 needs an explicit React version

`eslint-plugin-react@7.37.5`, bundled inside `eslint-config-next`, calls
`context.getFilename()` — an API **removed in ESLint 10** — while auto-detecting
the installed React version. That crashes the entire lint run.

`eslint.config.mjs` pins `settings.react.version` to `'19.2'`, which skips the
detection path completely. The only other rules that touch the removed API
(`react/forward-ref-uses-ref`, `react/jsx-filename-extension`) are not enabled by
`eslint-config-next`, so no further shimming is needed. Drop the setting once the
plugin is updated, or downgrade to `eslint@9` if further breakage appears.

### 4. `three` and `@types/three` move together

`@types/three` is versioned against a specific three minor. Bump both or neither.

---

## Commands

| Command                      | Does                                                    |
| ---------------------------- | ------------------------------------------------------- |
| `npm run dev`                | Dev server (Turbopack)                                  |
| `npm run build`              | Production build (Turbopack)                            |
| `npm run build -- --webpack` | Production build via webpack                            |
| `npm start`                  | Serve the production build                              |
| `npm run typecheck`          | `tsc --noEmit`                                          |
| `npm run lint`               | ESLint                                                  |
| `npm run format`             | Prettier write                                          |
| `npm run check`              | typecheck + lint + format check                         |
| `npm run setup:decoders`     | Re-copy Draco / Basis decoders into `public/`           |
| `npm run gltf:inspect`       | `gltf-transform inspect <in>`                           |
| `npm run gltf:draco`         | `gltf-transform draco <in> <out>`                       |
| `npm run gltf:meshopt`       | `gltf-transform meshopt <in> <out>`                     |
| `npm run gltf:ktx2`          | `gltf-transform uastc <in> <out>` — needs `ktx` on PATH |
| `npm run gltf:optimize`      | Full optimize pass                                      |

---

## Project layout

```
app/              App Router — layout.tsx, page.tsx, globals.css
components/three/ R3F scene components
components/ui/    DOM components
hooks/            Shared React hooks
lib/              Framework-agnostic helpers
stores/           Zustand stores
shaders/          .glsl / .vert / .frag sources
types/            Ambient declarations (glsl.d.ts)
scripts/          Build and setup scripts
public/models/    .glb / .gltf assets
public/textures/  .ktx2 and image textures
public/decoders/  GENERATED — Draco + Basis decoders (gitignored)
```

---

## Deliberately not included

Not part of the requested stack; add when actually needed.

- `@react-three/postprocessing` / `postprocessing` — bloom, DOF, effect composer
- `leva`, `r3f-perf` — runtime debug panels and GPU profiling
- `glslify` — shader `#pragma` composition
- Any test runner (Vitest / Playwright) or CI workflow
- `next-themes`, font loading strategy, analytics
