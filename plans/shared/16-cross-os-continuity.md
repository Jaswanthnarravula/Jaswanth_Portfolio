# shared/16 — Cross-OS continuity (Handoff)

## Purpose
Switching operating systems should feel like moving between your own devices: what you were just reading is
offered — never forced — in the new OS, in that OS's own idiom. Requirement: N10 (supports R36).

## Decisions

| Decision | Rationale | Rejected |
|---|---|---|
| Continuity carries a **`ContentRef`**, never a window or URL | OS-agnostic by construction; the `/go` resolver already maps refs to each OS's app | Copying window state across OSes |
| It is an **offer** with a short freshness window (10 min); **never auto-opens** | Agency (north-star B14); avoids surprising state | Auto-open on arrival |
| One offer at a time; dismissing clears it | No nagging | Queue of offers |
| Not shown if the target OS already has that content focused, or on deep-link arrival | Redundant / the URL already decided | Always showing |

## Specification

### Kernel slice
```ts
interface Continuity { ref: ContentRef; fromOs: OsId; at: number }   // KernelState.continuity
```
- **Capture:** whenever the focused location becomes `{ kind: 'content', ref }` (or a Linux viewer/cwd that maps
  to a ref), set `continuity = { ref, fromOs, at: now }`. Section roots count; app roots don't.
- **Offer:** on `entering` → `idle` of an OS switch, if `now − at < 10 min`, `fromOs !== activeOs`, the ref still
  resolves, and the arriving route wasn't a deep link → the OS shows its offer surface.
- **Accept:** `OPEN_APP{ role: sectionOwner[ref.section], location: { kind: 'content', ref } }` + `go`.
- **Dismiss / expire:** `CONTINUITY_DISMISS` clears it. In-memory only — never persisted across reloads.

### Per-OS offer idiom (owned by each OS's `07-cross-os-features.md` / `linux/09`)

| OS | Offer |
|---|---|
| macOS | **Handoff icon at the left end of the Dock** (app icon with a small device badge); tooltip "Continue: {title} — from {OS}" |
| Windows 11 | A **toast**: "Continue from {OS}" · {title} · [Open] [Dismiss]; stays in Notification Center |
| iOS | A **banner** at the top ("Handoff · {title}") that expands into the app on tap |
| Android | A **chip in At-a-glance** + a silent notification in the shade |
| Linux | An **MOTD line**: `Last viewed on {os}: {path} — run 'open {path}' to continue` with *Paste into Terminal* (inserts, never executes) |

Copy is identical in meaning everywhere; wording follows the OS's voice.

### Accessibility
The offer lives in the pre-existing `role="status"` region (announced politely once), never steals focus, is
reachable by keyboard in its native container (Dock item, toast action, banner button, chip, hint button).

### Analytics
`continuity_offered`, `continuity_accepted` with `{from, to, section}` — no slugs required.

## Edge cases
Ref removed from data → no offer. Rapid A→B→A switching → the offer refers to the latest capture and is dropped if
`fromOs === activeOs`. Reduced motion → the offer appears without animation. Compact mode → same offer, smaller
surface. Lock screen visible → the offer appears as one of its notifications instead of separately.

## Feature IDs + acceptance tests

| ID | Feature | Acceptance test |
|---|---|---|
| `CONT-CAP-01` | Capture on content focus | `unit: continuity set for content refs, not for app roots` |
| `CONT-OFFER-01` | Offer rules (freshness, not same OS, not deep link, not already focused) | `unit: offer decision table` |
| `CONT-ACCEPT-01` | Accept opens via section owner | `e2e: C1 accept opens the right app and location in each target OS` |
| `CONT-NEVER-01` | Never auto-opens | `e2e: C1 no window opens without user action` |
| `CONT-IDIOM-01` | Per-OS offer idiom | `e2e: C1 offer element matches the specified surface per OS` |
| `CONT-A11Y-01` | Polite, non-focus-stealing, keyboard reachable | `cmp: offer announced once; focus unchanged` |
| `CONT-MEM-01` | In-memory only | `unit: continuity absent from persisted payload` |

## Open questions
None.
