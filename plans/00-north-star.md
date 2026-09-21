# 00 — North Star (read this first, every session)

## The one sentence

A visitor must genuinely feel they have **entered a small operating system** in which Jaswanth's career exists
as applications, files, windows, commands and system surfaces — five times, in five genuinely different ways.

If a change would be equally at home on a normal portfolio site, it is probably wrong here.

## What this is NOT

- Not an OS-*inspired* website with themed sections.
- Not one interface recoloured five times.
- Not icons that link to ordinary pages.
- Not a tech demo: WebGL, shaders and animation are precision tools, never decoration.

## Banned shortcuts (each has been the cause of a "generic portfolio" before)

| # | Banned | Why | Do instead |
|---|---|---|---|
| B1 | A centered modal with a title bar called a "window" | No layering, focus, drag, minimize, taskbar/Dock state | Kernel window manager — `shared/04-os-kernel.md`, `{os}/02-window-manager.md` |
| B2 | One `<AppGrid>` / `<Shell>` recoloured per OS | Destroys distinct navigation philosophy | Headless primitives + per-OS skins; distinctness contract below |
| B3 | An icon that scrolls to / links to a page section | It is not an application | Open an app surface with its own chrome, nav stack and route |
| B4 | `if (input === 'ls')` style terminal | Not explorable; breaks on the first real command | Tokenizer → parser → interpreter over a VFS — `linux/02`–`04` |
| B5 | Hero + card grid, anywhere | The default portfolio reflex | Content lives inside app idioms (Finder columns, repo list, mail threads…) |
| B6 | `transition: all`, animating `width/height/top/left`, animating in React state | Jank, layout thrash, re-renders | `shared/07-motion-system.md` primitives only |
| B7 | Animation that blocks or delays input | Violates requirement 38 | Every sequence is interruptible; input always wins |
| B8 | Placeholder / lorem copy reaching production | Fake career facts | `placeholder: true` guard fails the build — `shared/02-portfolio-data.md` |
| B9 | Portfolio facts typed into an OS component | Five copies drift | One data module + shared content views — `shared/02`, `shared/03` |
| B10 | Hover-only or drag-only interaction | Excludes touch and keyboard users | Every gesture has a listed alternative — `shared/08-responsive.md` |
| B11 | `role="application"`, `role="dialog"` on every window, focus left on `<body>` | Breaks screen readers | `shared/09-accessibility.md` semantics map |
| B12 | Shrinking the desktop layout for phones | Unusable windows, tiny targets | Designed postures per OS — `{os}/04-responsive.md` |
| B13 | Loading three.js / WebGL on the critical path or inside an OS | Startup + re-blur cost | Top tier only, idle-loaded, Hello/chooser only |
| B14 | Auto-running a hinted command, auto-starting a tour, auto-playing sound | Removes agency | Insert-only hints, offered tours, tap-unlocked audio |
| B15 | Marking work done without its acceptance evidence | Silent gaps → re-prompting | Ledger discipline — `README.md` rules 3–6 |
| B16 | Per-profile behaviour differences | Owner decision: all profiles identical | `03-netflix-page.md` |
| B17 | A phone/tablet frame, bezel or device mock-up around iOS or Android on larger screens | Owner decision: the page **is** the screen — a framed phone is a picture of an OS, not an OS | Full-page layouts — `ios/04-responsive.md`, `android/04-responsive.md` |

## Distinctness contract (five OSes × twelve axes)

Every row must be visibly and behaviourally true. "Not like the others" sections in each file refine these.

| Axis | iOS | macOS | Windows 11 | Android | Linux |
|---|---|---|---|---|---|
| Navigation philosophy | Home screen of apps; one full-screen app at a time | Spatial desktop; many overlapping windows; global menu bar | Taskbar-anchored; Start is the hub; windows snap | Launcher + drawer; system Back is king | Text: paths, commands, history |
| Open metaphor | App **expands from its icon** | Window scales up from the Dock icon; Dock icon bounces while loading | Window scales/fades from the taskbar button | **Container transform** from the tapped icon (Material) | A command prints output; `open` hands off to a viewer |
| Close / leave | Swipe-up / Home pill → **returns into its icon** | Red traffic light; app may stay running (dot in Dock) | ✕ caption button; taskbar pill disappears | System Back / gesture → transform back to icon | `q`, `exit`, Ctrl+C; back to prompt |
| Back behaviour | In-app back chevron + edge swipe; browser Back = one level up | In-app only (Finder back/forward); browser Back = previous focused location | In-app back arrow; browser Back = previous location | **Browser Back = system Back** at every level | `cd ..`, history; browser Back = previous cwd/view |
| Window model | None (sheets, full-screen) | Free-floating, traffic lights left, no snap | Free-floating, caption buttons right, **Snap** | None (full-screen, bottom sheets) | Tiled terminal + optional viewer tile |
| Spacing unit / density | 8 pt grid, generous, 44 pt targets | 4/8 pt, compact, 24 pt pointer targets | 4 px grid, 32/40 px targets | 4 dp grid, **48 dp** targets, 8 dp gaps | Character cells; line height 1.35 |
| Corner radii | Continuous (squircle) 22.37 % icons; large sheets | 10–12 px windows, squircle icons | 8 px windows, 4 px controls | 28 dp large, 16 dp medium, full pills (M3) | 0–6 px |
| Type | SF system stack | SF system stack, 13 px UI | Segoe UI Variable stack, 14 px | Roboto stack (Roboto Flex fallback) | Monospace only |
| Motion signature | Springs with slight overshoot; velocity hand-off | Quick ease-out scale; **Scale** minimize; menus appear instantly | WinUI ladder 83/167/250/333 ms; entrance `0,0,0,1` | M3 emphasized easing; ripple + state layers | Near-instant; line reveal ≤ 240 ms |
| System surfaces | Status bar, Dock, folders, widgets, Spotlight, Control Center, banners | Menu bar, desktop, Dock, Spotlight, Notification Center, Mission Control, context menus | Taskbar, Start, Search, Task View, Notification Center + Quick Settings, toasts | Status + nav bars, At-a-glance, drawer, shade + Quick Settings, heads-up, Recents | Prompt, MOTD, scrollback, hint chip |
| Feedback idiom | Dim on press (80 ms), haptic-like scale | Hover highlights, selection blue, Dock magnification | Hover fill, taskbar pill, reveal-less Fluent states | **Ripple** from touch point, state-layer opacity | Caret, colourised output, exit codes |
| Search | Pull-down Spotlight | ⌘/Ctrl+K Spotlight bar | Taskbar Search flyout | Launcher search bar / drawer search | `search`, `find`, `grep`, Tab completion |

## Quality bar

- **Performance:** LCP < 2.5 s, INP < 200 ms, CLS < 0.1, Lighthouse Accessibility ≥ 95, 60 fps transitions,
  WebGL lazy, graceful tiers — `shared/10-performance.md`.
- **Motion:** every animation communicates hierarchy, state, causality, spatial relationship or feedback. If it
  does none of these, delete it.
- **Truthfulness:** one portfolio fact lives in one place and appears identically in all five OSes.
- **Reachability:** any section is ≤ 2 actions from any OS home; the résumé is 1 click from every screen.
- **Resilience:** Back/Forward, refresh, deep links and shared URLs always work; state restores sensibly.

## Smell tests (run before calling any surface done)

1. **Grayscale test:** screenshots of two OSes in grayscale must not look alike.
2. **Muscle-memory test:** would a daily user of that OS reach for the right place without thinking?
3. **Website test:** could this screen ship on an ordinary portfolio? If yes, it is wrong.
4. **Thumb test:** on a phone, can everything be done one-handed with ≥ the OS's minimum target size?
5. **Keyboard test:** can the whole journey be done without a pointer, and is focus always visible and sensible?
6. **Impatience test:** spam clicks, Back, rotate and resize during every animation — nothing breaks or traps.
7. **Recruiter test:** a first-time visitor finds Projects, Résumé and Contact in under 15 seconds, uninstructed.

## Process rules (non-negotiable)

- Plans first; a phase starts only when the previous gate passed (`05-roadmap.md`).
- Work by feature ID; ledger updated in the same change; deviations logged with the reason.
- Before declaring an OS complete, run its definition-of-done audit against its own plan and fix gaps first.
- Profile production builds, not the dev server.
- Never add a dependency without updating `shared/01-architecture.md` and checking the budgets.
