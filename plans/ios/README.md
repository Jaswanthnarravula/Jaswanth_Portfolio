# iOS — folder index

## Identity statement
A polished **iPhone Home Screen**: a wallpaper with depth, a grid of rounded-square app icons, a frosted Dock of four,
folders, widgets, a pull-down Spotlight, banners from the top, Control Center from the top-right. **One app fills the
screen at a time.** Tapping an icon makes the app **expand out of that icon**; going Home makes it **shrink back into
it**. Everything moves on springs and responds to the finger's velocity.

Built in **P5**. There is no window manager here — iOS uses the kernel with `WindowPolicy.mode = 'fullscreen'` and
the app lifecycle in `02-app-lifecycle.md`.

## App map (role → app → content)

| Role | App | Slug | Shows | Route example |
|---|---|---|---|---|
| `browser` | Safari | `safari` | `about` Overview (native scroll, IntersectionObserver reveals — no Lenis) | `/ios/safari` |
| `github` | GitHub | `github` | `projects` + enrichment | `/ios/github/portfolio-os` |
| `files` | Files | `files` | `experience`, `education` folders; **`resume` via Quick Look** | `/ios/files/experience/acme` · `/ios/files/resume` |
| `mail` | Mail | `mail` | `contact` → `mailto:` | `/ios/mail` |
| `messages` | Messages | `messages` | a conversation with Jaswanth: quick-reply chips that reveal contact channels (secondary contact surface) | `/ios/messages` |
| `notes` | Notes | `notes` | `skills` as pinned notes | `/ios/notes` |
| `settings` | Settings | `settings` | preferences, accessibility, legal, privacy, Switch OS | `/ios/settings` |

**Home Screen page 1:** row 1–2 = medium **Résumé widget** (2 × 4) · then Safari · GitHub · Notes · Settings ·
"Career" **folder** (Files shortcuts: Experience, Education, Résumé) · Messages. **Dock:** Files (opens to Résumé) ·
Safari · GitHub · Mail. **Page 2:** a small "Open to work" widget + shortcuts (About, Projects, Contact) — proves
paging without hiding anything essential.

## Reading order
1. `01-identity.md` 2. `02-app-lifecycle.md`
3. `surfaces/` — `boot` · `lock-screen` · `home-screen` · `dock` · `folders` · `widgets` · `spotlight` ·
   `notifications` · `status-bar-and-home-indicator` · `control-center` · `quick-actions`
4. `apps/` — `safari` · `github` · `files` · `mail` · `messages` · `notes` · `settings`
5. `03-motion.md` · `04-responsive.md` · `05-accessibility.md` · `06-edge-cases.md`
6. `07-cross-os-features.md` 7. `08-acceptance.md`

## Feature-ID namespaces
`IOS-ID` · `IOS-FLIGHT` · `IOS-BOOT` · `IOS-LOCK` · `IOS-HOME` · `IOS-DOCK` · `IOS-FOLD` · `IOS-WIDG` · `IOS-SPOT` ·
`IOS-NOTIF` · `IOS-STAT` · `IOS-CC` · `IOS-QA` · `IOS-SAF` · `IOS-GH` · `IOS-FILES` · `IOS-MAIL` · `IOS-MSG` ·
`IOS-NOTES` · `IOS-SET` · `IOS-MOTION` · `IOS-RESP` · `IOS-A11Y` · `IOS-CASE` · `IOS-X`.

## Phase
All `IOS-*` IDs are delivered in **P5**, then the definition-of-done audit.

## Not like the others (folder-level)
Unlike macOS/Windows: no windows, no desktop files, no pointer-first chrome. Unlike Android: **no app drawer** (every
app is on the Home Screen), **no system Back button** (in-app chevron + edge swipe), springs instead of emphasized
easing, dim-on-press instead of ripple, squircle icons on a fixed grid, Control Center separate from notifications.
