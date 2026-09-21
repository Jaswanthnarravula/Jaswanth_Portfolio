# shared/21 — Easter eggs

## Purpose
Small, well-made rewards for curious visitors that show personality and engineering humour — restrained, never
childish, never in the way. Requirement: N9 (tone rule from R30).

## Decisions

| Decision | Rationale | Rejected |
|---|---|---|
| Every egg is **lazy** (loaded on trigger) with zero initial cost | Budgets; most visitors never trigger them | Bundling eggs in OS shells |
| Eggs **never block content, never trap, never flash** | Accessibility and requirement 38 | Full-screen takeovers, strobe effects, fake crashes that look real |
| Tone: dry, brief, professional-friendly | Recruiters read these too | Memes, profanity, long jokes |
| Same discovery hints for **every** visitor; a "found n / N" line in Settings | Owner decision: no per-profile behaviour | Adventurer-only hints |
| Each egg is dismissible with Esc/any click and restores focus | Input always wins | Timed, unskippable gags |

## Specification

### Catalogue

| ID | Where | Trigger | What happens |
|---|---|---|---|
| `EGG-SUDO-01` | Linux + Terminal apps | `sudo hire-me` | `[sudo] password for recruiter:` (accepts anything) → prints a short "Offer accepted" block with contact links |
| `EGG-NEO-01` | Linux + Terminal apps | `neofetch` | ASCII monogram + "system specs" = skills, years, location, uptime = career length |
| `EGG-VIM-01` | Linux + Terminal apps | `vim` / `vi` | A calm fake buffer: "Good luck exiting." `:q` / `:q!` / `:wq` / Esc all exit |
| `EGG-RMRF-01` | Linux + Terminal apps | `rm -rf /` (or `~`) | `rm: refusing to delete a career in progress` — nothing changes |
| `EGG-COW-01` | Linux + Terminal apps | `cowsay <text>` / `fortune` | Classic ASCII cow; `fortune` prints one of a few engineering one-liners |
| `EGG-ABOUT-01` | macOS | Apple menu → About This Mac | The familiar sheet, listing **Jaswanth** as the hardware: chip = primary stack, memory = years of experience, serial = a date |
| `EGG-WINVER-01` | Windows | `winver` in Search / Run | "About Windows"-style dialog: version = résumé updated date, licensed to the visitor |
| `EGG-KONAMI-01` | Any graphical OS | ↑↑↓↓←→←→BA | A brief, tasteful wallpaper shimmer + toast "Cheat code accepted — nothing unlocked, you already have full access." |
| `EGG-SHAKE-01` | iOS / Android | Long-press empty home area 2 s | "No jiggle mode here — everything is already where it should be." banner |
| `EGG-MATRIX-01` | Linux | `cmatrix` | 3 s of falling glyphs **inside the terminal pane only**, low contrast, any key stops; disabled under reduced motion (prints a static line instead) |

### Discovery
`help` lists a final line: "Some commands aren't listed." · Spotlight/Start search recognizes `neofetch`,
`sudo hire-me`, `winver` as "Run in Terminal"/actions · Settings → About shows "Easter eggs found: n / N" (no list).
`prefs.eggsFound` stores ids; `egg_found` analytics event fires once per id.

### Rules
No sound unless sound is enabled. No effect exceeds the terminal pane / a toast / a small sheet. Nothing repeats
automatically. Every string goes through the same copy review as product text. Eggs respect `data-motion`,
`data-glass` and the asset mode.

## Edge cases
Trigger during a tour → the tour ends first. Trigger in compact mode → same behaviour in the single window.
Konami keys inside a text field → ignored. `sudo` with any other command → `sudo: permission denied — and none
needed.`

## Feature IDs + acceptance tests

The ten catalogue IDs above are feature IDs; each one's acceptance test is `unit/e2e: egg <id> behaves as
specified (output snapshot or surface assertion)`. Cross-cutting IDs:

| ID | Feature | Acceptance test |
|---|---|---|
| `EGG-LAZY-01` | Loaded on trigger only | `perf: egg chunks absent from every first load` |
| `EGG-SAFE-01` | Dismissible, non-blocking, no flashing, reduced-motion safe | `e2e: Esc dismisses each egg; focus restored; R1 passes` |
| `EGG-COUNT-01` | Found counter in Settings, identical for all visitors | `e2e: counter increments once per egg` |

## Open questions
None.
