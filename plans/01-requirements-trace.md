# 01 — Requirements trace

Every owner requirement maps to at least one plan file and feature-ID prefix. **No row may be empty.** When a
requirement changes, update this file first, then the owning plan.

R-numbers are the 50 numbered requirements from the original brief. `T` = performance targets, `S` = phased
strategy, `D` = device support, `N` = later owner additions.

| Req | Summary | Plan file(s) | ID prefixes |
|---|---|---|---|
| R1 | Principal-level UI/UX, creative-tech, architecture and performance bar | `00-north-star.md` | — (quality bar, smell tests) |
| R2 | Five miniature interactive OSes, not an OS-inspired site | `00-north-star.md` (banned shortcuts, distinctness) | — |
| R3 | Career exists as apps, files, windows, commands, system surfaces | `README.md` (section ownership), every `{os}/apps/*` | `MAC` `WIN` `IOS` `AND` `LNX` |
| R4 | Stack used only where it materially helps | `shared/01-architecture.md`, `shared/10-performance.md` | `ARCH` `PERF` |
| R5 | `/plans` is the architectural source of truth | `README.md` | — |
| R6 | Individual planning documents per topic | this tree | — |
| R7 | Plans completed sequentially and thoroughly | `05-roadmap.md`, `STATUS.md` | — |
| R8 | Shared portfolio-data layer | `shared/02-portfolio-data.md`, `shared/03-content-views.md` | `DATA` `VIEW` |
| R9 | Shared OS engine (windows, apps, routing, history, z-index, animation, persistence, sound, reduced motion, capabilities) | `shared/04-os-kernel.md`, `shared/05-routing-and-history.md`, `shared/07-motion-system.md` | `KRN` `ROUTE` `MOTION` |
| R10 | Extraordinary welcome: liquid glass, refraction, depth, morphed "Hello" | `02-hello-page.md` | `HELLO` |
| R11 | Ask how to explore via personas; never gate content | `03-netflix-page.md` (profiles, identical behaviour) | `NFLX` |
| R12 | Present the five OSes with recognizable identities | `04-os-chooser.md` | `CHOOSE` |
| R13 | Selecting an OS feels like entering it | `04-os-chooser.md`, `{os}/surfaces/boot.md` | `CHOOSE` `*-BOOT` |
| R14 | iOS Home Screen: depth, grid, Dock, folders, notifications, Spotlight, fluid open | `ios/surfaces/*` | `IOS` |
| R15 | iOS apps expand from and return to their icon | `ios/02-app-lifecycle.md` | `IOS-FLIGHT` |
| R16 | macOS desktop: wallpaper, menu bar, desktop items, Dock, Finder, chrome, traffic lights, context menus | `macos/surfaces/*`, `macos/apps/finder.md` | `MAC` |
| R17 | macOS windows: drag, focus, layer, minimize, maximize/restore, close, Dock, active indication | `macos/02-window-manager.md` | `MAC-WM` |
| R18 | Windows 11: desktop, centered taskbar, Start, search, pinned apps, windows, context, notifications, acrylic/mica | `windows/surfaces/*`, `windows/01-identity.md` | `WIN` |
| R19 | Windows windows: drag, focus, min/max/restore, close, taskbar state, never modal-like | `windows/02-window-manager.md` | `WIN-WM` |
| R20 | Android launcher: grid, Dock/favorites, notifications, Material depth, touch feedback, distinct from iOS | `android/surfaces/*`, `android/01-identity.md` | `AND` |
| R21 | No generic interface recoloured five times | `00-north-star.md` (B2, distinctness contract), every "Not like the others" | — |
| R22 | Recognizable app identities with official/permitted assets | `shared/11-assets.md` | `ASSET` |
| R23 | Semantic app → content mapping | `README.md` (section ownership), `{os}/README.md` | — |
| R24 | Icons open believable app experiences, not web pages | `00-north-star.md` (B3), `{os}/apps/*` | per app |
| R25 | Micro-interactions: magnification, taskbar states, badges, banners, active indicators, context menus, feedback, selection, switching | `{os}/surfaces/*`, `{os}/03-motion.md` | per surface |
| R26 | Linux is a terminal, not another icon desktop | `linux/README.md`, `linux/01-identity.md` | `LNX` |
| R27 | Believable prompt, welcome, caret, history, focus, spacing | `linux/01-identity.md`, `linux/08-boot-and-motd.md` | `LNX-ID` `LNX-BOOT` |
| R28 | Meaningful commands with aliases and errors | `linux/04-commands.md` | `LNX-CMD` |
| R29 | Coherent navigation, not hard-coded demos | `linux/02-shell-engine.md`, `linux/03-filesystem.md` | `LNX-SH` `LNX-FS` |
| R30 | Playful, restrained help ("Lost already? Linux welcomes you.") | `linux/05-hints.md` | `LNX-HINT` |
| R31 | "Need a hint?" → contextual command + "Paste into Terminal" | `linux/05-hints.md` | `LNX-HINT` |
| R32 | Never auto-execute a hinted command | `linux/05-hints.md`, `00-north-star.md` (B14) | `LNX-HINT` |
| R33 | Performant GSAP terminal output animation | `linux/07-output-animation.md` | `LNX-OUT` |
| R34 | Rich views from commands with continuity back to the shell | `linux/06-rich-views.md` | `LNX-VIEW` |
| R35 | OS-independent routing/state: Back/Forward, deep links, refresh, shared URLs | `shared/05-routing-and-history.md` | `ROUTE` |
| R36 | Preserve OS state intelligently across switches without staleness | `shared/04-os-kernel.md` (sessions, restore rules) | `KRN-SES` |
| R37 | Motion quality: springs, easing, shared elements, GPU-friendly | `shared/07-motion-system.md`, `{os}/03-motion.md` | `MOTION` |
| R38 | Every animation must communicate; none may slow access | `00-north-star.md` (B7), `shared/07-motion-system.md` | `MOTION` |
| R39 | No jank: isolate animation state, lazy-load, code-split, no layout thrash | `shared/10-performance.md`, `shared/01-architecture.md` | `PERF` `ARCH` |
| R40 | 3D/shader tech as precision tools | `shared/10-performance.md`, `02-hello-page.md` | `PERF` `HELLO` |
| R41 | Graceful performance tiers | `shared/10-performance.md` | `PERF-TIER` |
| R42 | Intentional mobile design | `shared/08-responsive.md`, `{os}/04-responsive.md` | `RESP` |
| R43 | Production-critical accessibility | `shared/09-accessibility.md`, `{os}/05-accessibility.md` | `A11Y` |
| R44 | Apps are reusable typed components on centralized data | `shared/03-content-views.md`, `shared/02-portfolio-data.md` | `VIEW` `DATA` |
| R45 | Strict TypeScript models, no `any`, no fragile globals | `shared/01-architecture.md` (model catalogue) | `ARCH` |
| R46 | Deliberate edge cases | `shared/04-os-kernel.md` (edge table), `{os}/06-edge-cases.md` | `KRN` per OS |
| R47 | Production-quality testing | `shared/12-testing.md` | `TEST` |
| R48 | Continuous production profiling | `shared/10-performance.md` (procedure) | `PERF` |
| R49 | Audit each OS against its plan before moving on | `{os}/08-acceptance.md`, `linux/13-acceptance.md`, `05-roadmap.md` | — |
| R50 | Five engineered OSes at production polish | `00-north-star.md`, `STATUS.md` | — |
| R51 | Hire-worthy content depth: recruiter card, Now note, role scope, case studies, deep dives — owner's facts only (2026-09-24) | `shared/23-content-depth.md`, `shared/02-portfolio-data.md`, each OS's `apps/github.md` + one "Now" surface | `CONTENT` `DATA` per OS |
| R52 | Premium motion on the reader page: depth, text reveals, sticky case-study storytelling, architecture diagrams — within the WebGL, compositor and contrast rules (2026-09-25) | `shared/24-reader-motion.md` (incl. the optional `CaseStudy.flow`) | `READER` |
| T | LCP < 2.5 s, INP < 200 ms, CLS < 0.1, a11y ≥ 95, 60 fps, lazy WebGL, fallbacks | `shared/10-performance.md`, `shared/12-testing.md` | `PERF` `TEST` |
| S | Foundation → Welcome → vertical slice → macOS → Windows → iOS → Android → Linux → polish, validated per phase | `05-roadmap.md` | — |
| D | Mobile, laptop and tablet friendly | `shared/08-responsive.md` | `RESP` |
| N1 | Netflix-style intro with sound + "Who's watching?" after Hello | `03-netflix-page.md` | `NFLX` |
| N2 | Five profiles; **all navigate identically to the OS chooser** | `03-netflix-page.md` | `NFLX-PROF` |
| N3 | Nested plans that prevent generic drift and missed details | `README.md`, `00-north-star.md`, `CLAUDE.md` | — |
| N4 | Risks closed by design with defaults | master plan risk register → owning shared files | various |
| N5 | Instant résumé path | `shared/14-resume-fast-path.md` | `RES` |
| N6 | Boot sequences | `{os}/surfaces/boot.md`, `linux/08-boot-and-motd.md` | `*-BOOT` |
| N7 | Lock screen with live notifications | `{os}/surfaces/lock-screen.md` | `*-LOCK` |
| N8 | Build-time GitHub data | `shared/17-github-live-data.md` | `GH` |
| N9 | Easter eggs | `shared/21-easter-eggs.md` | `EGG` |
| N10 | Cross-OS continuity | `shared/16-cross-os-continuity.md` | `CONT` |
| N11 | System-wide search | `shared/15-system-search.md` | `SRCH` |
| N12 | Privacy-friendly analytics | `shared/18-analytics.md` | `ANL` |
| N13 | Shareable deep-link cards | `shared/19-social-cards-and-seo.md` | `OG` |
| N14 | Guided tour | `shared/20-guided-tour.md` | `TOUR` |
