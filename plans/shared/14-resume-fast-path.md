# shared/14 — Résumé fast path

## Purpose
A recruiter with thirty seconds must never have to learn an operating system. The résumé is **one click from
every screen**, expressed in each OS's own idiom so it never feels bolted on. Requirement: N5 (and the Recruiter
smell test).

## Decisions

| Decision | Rationale | Rejected |
|---|---|---|
| Always reachable in **1 action**, from every surface of every OS and from all three pre-OS pages | The most valuable artifact for the most time-poor visitor | Résumé only inside a Files app |
| Expressed **natively per OS** (Dock stack, pinned taskbar item, widget, chip, command) | Keeps the OS illusion (north-star "website test") | A floating "Download CV" button over every OS |
| One PDF, one canonical link: `/go/resume` | Single source; shareable | Per-OS copies |
| Two actions everywhere: **Open** (in the OS's viewer) and **Download** | Reading and saving are different intents | Download only |

## Specification

### Per-surface idiom (each OS's `07-cross-os-features.md` / `linux/09` owns exact placement)

| Surface | Fast path | Opens |
|---|---|---|
| Hello · Netflix · chooser | Discreet top-right text link "Résumé" (not a button competing with the flow) | `/go/resume` (semantic page with Open PDF + Download) |
| macOS | **Document stack at the right of the Dock** ("Résumé.pdf") + menu-bar status item | `/macos/preview` |
| Windows 11 | **Pinned taskbar item** (PDF) + Start "Recommended" first row | `/windows/edge/resume` |
| iOS | **Dock app** (Files opens straight to the résumé) + Home-screen widget | `/ios/files/resume` |
| Android | **Favorites row** shortcut + At-a-glance chip | `/android/files/resume` |
| Linux | `resume` command (alias of `open resume`) + a persistent title-strip hint `resume ↵` | `/linux/viewer/resume` |
| Lock screens | First notification: "Résumé ready to view" | the OS route above |
| `/plain` | Top of page: Open PDF · Download | PDF |

### Behaviour
- **Open** → the OS's viewer app via the kernel (`OPEN_APP{role: sectionOwner.resume}`) — normal window/app rules.
- **Download** → `<a download>` to `portfolio.resume.file`; filename `Jaswanth-Resume.pdf`; emits `resume_downloaded`.
- Every viewer shows the published PDF (the owner's `Resume.pdf`) as page images + its own text, in every browser
  (shared/03 `VIEW-RESUME-01`); Open and Download are always that one file.
- The fast path is visible in **compact mode** too (it may collapse to an icon, never disappear).
- It is a real link (`href`), so it works without JS and by middle-click.

### Accessibility
Accessible name "Résumé (PDF)"; the Download action states the file type and size ("PDF, 120 KB"). Included in
the keyboard order of the Dock/taskbar/favorites like any other item.

## Edge cases
PDF missing (placeholder phase) → the link opens the semantic résumé page built from data; the Download action is
hidden; the production guard prevents shipping this state. Pop-up blockers are irrelevant (same-tab navigation).
Offline → the semantic résumé page is in the bundle; Download shows a gentle "You're offline" notice.

## Feature IDs + acceptance tests

| ID | Feature | Acceptance test |
|---|---|---|
| `RES-REACH-01` | 1-action reachability from every surface | `e2e: Q1 résumé reachable in 1 click from every surface of every OS` |
| `RES-PRE-01` | Link on Hello, Netflix and chooser | `e2e: W1 résumé link present and keyboard reachable on all three` |
| `RES-IDIOM-01` | Native idiom per OS (table above) | `e2e: per-OS assertion that the fast path is the specified element` |
| `RES-OPEN-01` | Open uses the OS viewer through the kernel | `e2e: opening follows window/app rules and deep-links correctly` |
| `RES-DL-01` | Download with correct filename + analytics event | `e2e: download event fired; filename matches` |
| `RES-COMPACT-01` | Present in compact mode | `e2e: M3/N3 fast path visible at 390 px` |
| `RES-NOJS-01` | Works without JS | `e2e: W2 /go/resume offers PDF link with JS disabled` |

## Open questions
None.
