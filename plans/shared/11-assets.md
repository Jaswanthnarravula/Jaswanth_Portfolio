# shared/11 — Assets

## Purpose
One manifest governs every icon, sound, avatar, wallpaper and font, with two complete modes so the site can
switch from official artwork to original artwork by changing one flag. Requirements: R22, N1.

## Decisions

| Decision | Rationale | Rejected |
|---|---|---|
| **Official app icons everywhere** — production default `ASSET_MODE=official` (owner's call) | Instant recognizability | — |
| A **complete original baseline** exists from day one; official artwork is a removable overlay | If any rights holder objects, the fix is a flag flip + redeploy (minutes, no code) | Depending on third-party artwork |
| Both modes run the full journey suite on every PR | The switch is guaranteed to work when needed | Untested fallback |
| Original icons are **parametric**: gradient tile in the OS idiom + an openly-licensed glyph (Fluent UI System Icons — MIT, Material Symbols — Apache-2.0, Lucide — ISC) | Polished, consistent, cheap to produce; not crude imitations | Hand-drawn look-alikes |
| Third-party marks **never** appear in the site's title, favicon, OG cards or branding | Nominative use only; no implied affiliation | — |
| Fonts: system stacks + Inter; never self-host SF Pro / Segoe UI | Font files are licensed software | — |
| Acquisition never blocks work | Missing official files simply render the original version | Waiting on assets |

## Specification

### Manifest (`lib/assets/manifest.ts`)
```ts
type AssetKind = 'app-icon' | 'system-icon' | 'tech-logo' | 'org-logo' | 'wallpaper' | 'avatar' | 'audio' | 'wordmark' | 'device-frame';
interface AssetEntry {
  id: AssetId; kind: AssetKind; os?: OsId;
  box: { w: number; h: number };                     // identical in both modes → zero layout shift
  official?: { src: string; owner: string; sourceUrl: string; retrieved: string; terms: string };
  original: { src: string } | { parametric: { glyph: string; gradient: [string, string]; shape: 'squircle'|'rounded'|'circle'|'none' } }
          | { monogram: { text: string; gradient: [string, string] } };  // org-logo: initials tile (reader page, 2026-09-25)
  alt: '';                                            // icons are decorative; the label names the app
}
export function resolveAsset(id: AssetId): ResolvedAsset;   // honours ASSET_MODE; falls back to original if official missing
```
`ASSET_MODE` is a build-time constant (`NEXT_PUBLIC_ASSET_MODE`). `official` files live in
`public/assets/official/**`; `original` in `public/assets/original/**`. An **`assets-inbox/`** folder at the repo
root is ingested by `scripts/ingest-assets.mjs` (validates dimensions/format, optimizes, writes manifest fields).

### Inventory and acquisition checklist
Status legend: **kit** = official public brand kit/source exists (fetch + record URL/date/terms) · **owner** =
"file needed from you" (no official redistribution source) · original always exists.

| Asset | Used by | Official source | Status |
|---|---|---|---|
| GitHub mark | all graphical OSes | github.com/logos | kit |
| VS Code icon | macOS, Windows | code.visualstudio.com brand | kit |
| Microsoft Edge, Outlook, File Explorer, Settings, Windows Terminal (MIT repo), Start logo | Windows | Microsoft brand/press resources, open-source repos | kit / owner |
| Chrome, Gmail, Files by Google, Keep, Android Settings | Android | Google brand resource center | kit / owner |
| Safari, Finder, Preview, Mail, Messages, Notes, Files, Settings, Terminal (Apple) | macOS, iOS | none | owner |
| Apple logo (boot), Windows logo (boot), Android boot mark | boot screens | none / brand kits | owner / kit |
| Netflix ta-dum mp3 (~66 KB), smiley avatars ×5 | Netflix page | none | owner |
| "JASWANTH" arc wordmark | Netflix page | **original in both modes** (inline SVG) | done in-repo |
| Wallpapers ×5 OS (light + dark) | OS shells | **original** CSS gradients in both modes — **except iOS**, whose official mode shows the iPhone 16 wallpaper (Ultramarine, one AVIF ≤ 60 KB, owner decision 2026-09-23; original mode keeps the gradient) | done in-repo / owner |
| OS home snapshots ×5 OS × 2 aspects (landscape + portrait) | chooser cards + enter/exit transition | **generated in-repo** from the real shells at build time (so they match what the visitor enters); **no device frames anywhere** (north-star B17) | built in P8 (placeholders until each OS is released) |

### Audio
`official`: the ta-dum mp3. `original`: a short chime **synthesized with Web Audio** (0 KB, deliberately not a
sound-alike). Other UI sounds (off by default) are original synthesized ticks. Only `lib/audio` may create an
`AudioContext`; decode on first gesture; fail silently.

### Formats and budgets
Icons: SVG where available, else PNG/AVIF at 1×/2×/3×, ≤ 12 KB each. Wallpapers: CSS gradient first; AVIF
≤ 60 KB, `fetchpriority="low"`. OS chooser snapshots: AVIF ≤ 25 KB each, one landscape and one portrait per OS; the chooser picks the one closest to
the visitor's viewport aspect. Avatars ≤ 16 KB each (WebP q90 at 200 px). Everything has
explicit dimensions.

### Legal surface and runbook
`LegalNotice` content view (in every OS's Settings → About/Legal, `/plain`, Linux `legal`): ownership statement
for all third-party marks, non-affiliation, non-commercial statement, per-asset credits from the manifest, and a
rights-holder contact line. **`TAKEDOWN.md`** (repo root, P0): set `NEXT_PUBLIC_ASSET_MODE=original` → redeploy →
reply. Nothing else is required because both modes are continuously tested.

### Caching
`/assets/**` filenames are content-hashed by the ingest script → `immutable` caching is safe. `/decoders/` moves
to a versioned path (`/decoders/three-0.186/`) before keeping its immutable header.

## Edge cases
Official file missing or fails validation → original is used and the build logs a warning (never fails).
`ASSET_MODE=original` build → no request may hit `/assets/official/**` (asserted). Audio blocked/missing → the
intro completes silently.

## Feature IDs + acceptance tests

| ID | Feature | Acceptance test |
|---|---|---|
| `ASSET-MAN-01` | Typed manifest + resolver | `unit: every manifest entry resolves in both modes` |
| `ASSET-MODE-01` | One-flag switch | `e2e: full journey suite passes with ASSET_MODE=original and =official` |
| `ASSET-MODE-02` | No official requests in original mode | `e2e: network log has zero /assets/official/ hits` |
| `ASSET-BOX-01` | Identical boxes → no shift | `e2e: layout snapshot equal across modes` |
| `ASSET-ORIG-01` | Parametric original icon set for every app | `unit: every OsAppBinding.icon has an original` |
| `ASSET-INBOX-01` | `assets-inbox/` ingestion | `unit: ingest validates size/format, writes hashed files + manifest fields` |
| `ASSET-AUDIO-01` | Official mp3 / original synthesized chime | `unit: audio engine no-throw when blocked or missing` |
| `ASSET-LEGAL-01` | Legal surface + `TAKEDOWN.md` | `e2e: legal notice reachable in every OS and /plain` |
| `ASSET-MARK-01` | No third-party marks in title/favicon/OG | `unit: metadata + OG templates reference only original assets` |
| `ASSET-BUDGET-01` | Size budgets | `unit: manifest size audit` |

## Open questions
None — defaults render until owner files arrive in `assets-inbox/`.
