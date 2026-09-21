# Android — folder index

## Identity statement
A modern **Pixel-style launcher in Material 3**: an At-a-glance line on top, a small home grid, a favorites row above
a **search bar**, and an **app drawer** you swipe up. Colour is *dynamic* — derived from the wallpaper — and surfaces
are **tonal**, not blurred. Touch produces a **ripple** from the finger. Apps open with a **container transform**, and
the single most important idea is **system Back**: it works everywhere, at every level, and the browser's Back button
*is* that Back.

Built in **P6**. Shares the mobile app-lifecycle plumbing proven by iOS (`flight()`, fullscreen policy, warm LRU) —
but with Material motion, Back-centric navigation and a different launcher philosophy.

## App map (role → app → content)

| Role | App | Slug | Shows | Route example |
|---|---|---|---|---|
| `browser` | Chrome | `chrome` | `about` Overview (native scroll) | `/android/chrome` |
| `github` | GitHub | `github` | `projects` + enrichment | `/android/github/portfolio-os` |
| `files` | Files | `files` | `experience`, `education`; **`resume` in a PDF viewer** | `/android/files/experience/acme` · `/android/files/resume` |
| `mail` | Gmail | `gmail` | `contact` → `mailto:` | `/android/gmail` |
| `notes` | Keep Notes | `keep` | `skills` as a board of notes | `/android/keep` |
| `settings` | Settings | `settings` | preferences, accessibility, legal, privacy, Switch OS | `/android/settings` |

**Home:** At-a-glance (date · "Résumé ready" chip) · grid row: GitHub · Keep · Settings · "Career" folder · favorites
row: **Files (Résumé)** · Chrome · GitHub · Gmail · search bar. **Drawer:** all six apps A–Z + a suggestions row.

## Reading order
1. `01-identity.md` 2. `02-app-lifecycle.md`
3. `surfaces/` — `boot` · `lock-screen` · `launcher-home` · `app-drawer` · `favorites-dock` · `notification-shade` ·
   `status-and-navigation-bars` · `heads-up-notifications` · `app-shortcuts` · `recents`
4. `apps/` — `chrome` · `github` · `files` · `gmail` · `keep-notes` · `settings`
5. `03-motion.md` · `04-responsive.md` · `05-accessibility.md` · `06-edge-cases.md`
6. `07-cross-os-features.md` 7. `08-acceptance.md`

## Feature-ID namespaces
`AND-ID` · `AND-LIFE` · `AND-BOOT` · `AND-LOCK` · `AND-HOME` · `AND-DRAWER` · `AND-FAV` · `AND-SHADE` · `AND-BARS` ·
`AND-HUN` · `AND-SHORT` · `AND-RECENTS` · `AND-CHROME` · `AND-GH` · `AND-FILES` · `AND-GMAIL` · `AND-KEEP` ·
`AND-SET` · `AND-MOTION` · `AND-RESP` · `AND-A11Y` · `AND-CASE` · `AND-X`.

## Phase
All `AND-*` IDs are delivered in **P6**, then the definition-of-done audit.

## Not like the others (folder-level)
Unlike iOS: an **app drawer** (not every app on Home), **system Back** (not an in-app chevron), **ripple + state
layers** (not dim-on-press), **tonal colour, no blur**, emphasized-easing container transforms (not springs), one
**shade** for notifications *and* Quick Settings, FABs and bottom navigation bars, 48 dp targets, adaptive icons.
