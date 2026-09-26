# assets-inbox

Raw official artwork waiting to be ingested into `public/assets/official/` by the asset pipeline
(`plans/shared/11-assets.md`, IDs `ASSET-INBOX-01`, `ASSET-MAN-01`). Everything in this folder except this file is
git-ignored (and ignored by ESLint and Prettier). Each file below maps to an
`official: { src, owner, sourceUrl, retrieved, terms }` manifest entry.

All icons, logos, avatars and the sound are trademarks/artwork of their owners, used referentially per the owner's
decision (official icons everywhere, production default `ASSET_MODE=official`). The original fallback set must still
exist for every entry so `ASSET_MODE=original` keeps working (`TAKEDOWN.md`).

**Retrieved:** 2026-09-21 · **Status:** every planned icon slot has a real file (31 / 31 placements in the preview).

## `icons/appstore/` — Apple App Store artwork
Source: Apple iTunes Lookup API `https://itunes.apple.com/lookup?id=<ids>&country=us` → `artworkUrl512`
(`is1-ssl.mzstatic.com`, swap `.jpg` → `.png`). 512 × 512, full-bleed square → **mask to squircle**.

| File | Owner | App Store id | Used by |
|---|---|---|---|
| `safari.png` · `mail.png` | Apple Inc. | 1146562112 · 1108187098 | iOS, macOS |
| `messages.png` · `notes.png` · `files.png` | Apple Inc. | 1146560473 · 1110145109 · 1232058109 | iOS |
| `github.png` | GitHub, Inc. | 1477376905 | iOS, macOS |
| `gmail.png` · `chrome.png` · `keep.png` | Google LLC | 422689480 · 535886823 · 1029207872 | spare (iOS-style tiles) |
| `outlook.png` · `edge.png` | Microsoft Corporation | 951937596 · 1288723196 | spare (iOS-style tiles) |

## `icons/play/` — Google Play listing icons
Source: `og:image` of `https://play.google.com/store/apps/details?id=<package>` → `play-lh.googleusercontent.com/…=s512`.
512 × 512 → **mask to circle / adaptive shape** on a white plate.

| File | Owner | Package |
|---|---|---|
| `gmail.png` · `chrome.png` · `keep.png` · `files.png` | Google LLC | `com.google.android.gm` · `com.android.chrome` · `com.google.android.keep` · `com.google.android.apps.nbu.files` |
| `github.png` | GitHub, Inc. | `com.github.android` |

## `icons/desktop/` — publishers' own sites and repositories
| File | Owner | Source |
|---|---|---|
| `vscode.png` (1024 px, free-form) | Microsoft | `https://code.visualstudio.com/assets/branding/code-stable.png` |
| `windows-terminal.png` (200 px) | Microsoft | `github.com/microsoft/terminal` → `res/terminal/images/StoreLogo.scale-400.png` |
| `github-mark.svg` | GitHub, Inc. | `github.com/primer/octicons` → `icons/mark-github-24.svg` |

## `icons/system/` — macOS system apps and platform marks
| File | Owner | Source |
|---|---|---|
| `finder.png` (960 px, transparent padding → scale ≈ 1.22) | Apple Inc. | Wikimedia Commons `Finder Icon macOS Big Sur.png` |
| `macos-terminal.png` (960 px, **white backing → squircle mask, scale ≈ 1.26**) | Apple Inc. | Commons `Terminalicon2.png` |
| `macos-system-settings.png` (512 px, transparent padding) | Apple Inc. | `github.com/PuruVJ/macos-web` → `public/app-icons/system-preferences/512.png` |
| `macos-preview.png` (**200 px — low-res**) | Apple Inc. | English Wikipedia `File:Preview icon.png` (`upload.wikimedia.org/wikipedia/en/d/d6/`) |
| `apple-logo.svg` | Apple Inc. | Commons `Apple logo black.svg` |
| `windows-logo.svg` → `windows-logo-mark.svg` | Microsoft | Commons `Windows 11 logo.svg`; the mark file is derived (viewBox cropped to the four panes) |

## `icons/windows/` — Windows 11 system apps
| File | Owner | Source |
|---|---|---|
| `explorer.png` (**64 px — low-res**) | Microsoft | `github.com/blueedgetechno/win11React` → `public/img/icon/explorer.png` |
| `settings.svg` (vector, the real blue gear) | Microsoft | Commons `Windows Settings icon.svg` |
| `edge.svg` (vector, free-form) | Microsoft | Commons `Microsoft Edge logo (2019).svg` |
| `outlook.svg` (vector, current 2025 logo) | Microsoft | Commons `Microsoft Outlook Icon (2025–present).svg` (URL-encode the en-dash) |
| `this-pc.png` · `folder.png` (144 px, Windows 10-era art — superseded) | Microsoft | `github.com/DustinBrett/daedalOS` → `public/System/Icons/144x144/` |
| `folder-11.png` · `this-pc-11.png` · `recycle-bin.png` (256 px, Windows 11 shell art; used by the desktop and File Explorer, P4) | Microsoft | `github.com/blueedgetechno/win11React` → `public/img/icon/win/folder.png` · `thispc.png` · `bin-em.png` (retrieved 2026-09-21) |

## `icons/tech/` — tool logos for the reader page Toolbox (retrieved 2026-09-25)
Source: Devicon (MIT) — `https://cdn.jsdelivr.net/gh/devicons/devicon/icons/<name>/<name>-original.svg` (Go and AWS use
the `-original-wordmark` file). One file per slug in `lib/assets/tech.ts`; each mark's owner is listed in
`scripts/asset-sources.mjs`. `linux` (Tux) and `maven` exceed the SVG budget and are rasterized to WebP.

## `icons/org/` — employer, client and school logos for the reader page (retrieved 2026-09-25)
| File | Owner | Source | Basis |
|---|---|---|---|
| `ibm.svg` | IBM | Commons `IBM logo.svg` | public domain (text logo) |
| `dbs.svg` | DBS Bank Ltd. | en.wikipedia `File:DBS Bank Logo (alternative).svg` | public domain per its file page |
| `uab.svg` | The University of Alabama at Birmingham | Commons `UAB Core Logo Centered Full Color.svg` | public domain (text logo) |
| `aicte.png` (316 px) | All India Council for Technical Education | en.wikipedia `File:All India Council for Technical Education logo.png` | Wikipedia fair-use file |
| `jntuh.png` (309 px) | JNTU Hyderabad | en.wikipedia `File:JNTU Hyderabad logo.png` | Wikipedia fair-use file |
| `xclusive.jpg` (100 px) | Xclusive Trading Inc. | LinkedIn company-page logo (`media.licdn.com/…/company-logo_100_100/…/1630633784582`, link supplied by the owner 2026-09-26; the signed URL expires) | supplied by the owner (an employee); the website is a parked domain |

## `icons/ios/` and `icons/android/`
| File | Owner | Source |
|---|---|---|
| `ios/settings.png` (960 px, padding → squircle mask, scale ≈ 1.26) | Apple Inc. | Commons `Settings (iOS).png` |
| `android/settings.png` (432 px, **adaptive-icon foreground layer** — white gear; render on a circle filled with the dynamic `primary` colour, scale ≈ 1.7) | Google (AOSP, Apache-2.0) | `android.googlesource.com/platform/packages/apps/Settings` → `res/mipmap-xxxhdpi/ic_launcher_settings.png` (`?format=TEXT`, base64) |
| `android/android-head.svg` (boot mark) | Google (CC BY 3.0) | Commons `Android robot head.svg` |

## `wallpapers/` — OS wallpapers (official overlay; the CSS gradients stay the original)
| File | Owner | Source |
|---|---|---|
| `ios-iphone16-ultramarine.jpg` (1290 × 2796, the iPhone 16 Plus screen) | Apple Inc. | iClarified "Download the Official iPhone 16 Wallpaper" → `www.iclarified.com/images/news/94911/453974/453974.jpg` (retrieved 2026-09-23) |
| `android-pixel6-la-mer.jpg` (2880 × 3120, Pixel 6 "La Mer" — `wallpaper.android`, sage) | Google LLC | `github.com/wacko1805/Pixel-Wallpapers` → `Pixel-6-landscapes/8-La-Mer.jpeg` (retrieved 2026-09-24) |
| `android-pixel6-art-4.png` · `-art-13.png` · `-art-9.png` (2880 × 3120 — blue · violet · coral) | Google LLC | same repository → `Pixel-6-art/4.png` · `13.png` · `9.png` (retrieved 2026-09-24) |

Android alternatives seen and not used (same repository): Pixel 6 "Greece" (white text too faint on its pale sky),
Pixel 7/7a feathers and Pixel 8/8a sets (below the 1170 × 2532 phone minimum), Pixel Fold (2208 px tall).

Same family, not used: Teal · Pink · White · Black (same page, ids 453977 · 453978 · 453979 · 453981) and the
iPhone 16 Pro titanium set (453966 · 453972 · 453969 · 453970, 1320 × 2868). The 945 × 2048 copies on iDownloadBlog are
too small for a phone screen. The owner's comparison of three original designs is `preview/ios-wallpaper-options.png`.

## `netflix/`
| File | Owner | Source |
|---|---|---|
| `intro.mp3` (65 965 B — the ta-dum) | Netflix | reference repo `github.com/Sandhit06/Netflix-Portfolio` → `src/netflix-sound.mp3` |
| `avatar-blue.png` · `avatar-grey.png` · `avatar-red.png` · `avatar-yellow.png` (200 px, the "fuzzy" profile avatars) | Netflix | same repo → `src/images/` |

Profile mapping: Recruiter = blue · Developer = grey · Adventurer = yellow · Designer = red ·
**Guest = the blue avatar with `filter: hue-rotate(-62deg) saturate(1.15)`** (green). No fifth official file was found.

## Rejected (do not re-download)
- `microsoft/vscode` → `resources/linux/code.png` — the generic **Code – OSS** placeholder, not the VS Code logo.
- Commons `Windows Settings app icon.png` — a plain black outline gear, not the Windows 11 icon.
- `win11React` → `outlook.png` — the **old** Outlook logo. `daedalOS` → `pdf.png` — that project's own "PDF JS" logo.

## Soft spots — replace if sharper files turn up
`macos-preview.png` (200 px) and `windows/explorer.png` (64 px) are fine at Dock/taskbar size but soft when enlarged
(e.g. desktop icons at 2×, Start menu tiles). Drop a larger file with the same name and nothing else changes.

## Fetch notes
- Contact logos (2026-09-26): `icons/org/gmail.png` from Google's `gstatic.com/images/branding/product/2x/gmail_2020q4_48dp.png`; `linkedin.png` from the `LI-In-Bug.png` in [LinkedIn's logo download](https://brand.linkedin.com/downloads); `instagram.png` from `Instagram_Glyph_Gradient.png` in [Meta's Instagram asset pack](https://www.meta.com/brand/resources/instagram/instagram-brand/). Resized with proportions preserved onto transparent 128 px squares. The ingestion manifest records ownership and emits local 64/128 px WebP variants.
- Wikimedia's API rate-limits after a few calls; use `https://commons.wikimedia.org/wiki/Special:FilePath/<File_name>?width=512`
  with a 4–6 s pause between requests.
- Apple's support/guide pages render with JavaScript — nothing to scrape there.

## `preview/`
- `storyboard.html` — local, unpublished page rendering every planned screen with the files above.
- `icons.html` — contact sheet of every file on a checkerboard (shows transparency and padding).
- Rebuild from `assets-inbox/preview/`: `node build.mjs _template.html storyboard.html` — the icon map at the top of
  `build.mjs` decides which file fills which slot; a missing file automatically shows as a dashed slot.

## `fonts/` — build inputs for the Hello greeting paths (never shipped)
`scripts/build-hello-paths.mjs` renders each greeting with these fonts (Pango/HarfBuzz via `sharp`), extracts the
centreline and writes `lib/welcome/hello-paths.generated.json` (committed). Only the generated paths reach the site.

| File | Font | Licence | Source |
|---|---|---|---|
| `kalam-Kalam-Regular.ttf` · `kalam-OFL.txt` | Kalam (Latin + Devanagari) — Indian Type Foundry | SIL OFL 1.1 | `github.com/google/fonts` → `ofl/kalam/` |
| `kleeone-KleeOne-Regular.ttf` · `kleeone-OFL.txt` | Klee One (Japanese) — Fontworks Inc. | SIL OFL 1.1 | `github.com/google/fonts` → `ofl/kleeone/` |
