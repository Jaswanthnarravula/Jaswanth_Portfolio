# Implementation record

## Authorization and plan review

On 2026-09-21 the owner authorized starting implementation, reconstructing missing plans, and completing the portfolio.
This supersedes the earlier pause while Claude wrote plans and the repeated permission stops in the roadmap.
All 148 plan documents and all five nested OS trees were inspected before application changes.
The seven ledgers enumerate 930 requirements. No plans are currently missing.

Work order: P0 foundation → P1 welcome → P2 macOS vertical slice → P3 complete macOS and terminal engine →
P4 Windows → P5 iOS → P6 Android → P7 Linux → P8 final validation. No later phase starts before the preceding gate.
Evidence is recorded in the owning ledger; this document does not substitute for acceptance tests.

## Content sources

- Primary: <https://www.linkedin.com/in/jaswanth-narravula/>, as requested by the owner.
- Supporting project information: <https://github.com/Jaswanthnarravula/>.
- Do not invent employment dates, project dates, proficiency scores, or additional experience.
- Source access: LinkedIn blocks direct anonymous retrieval; its publicly indexed profile supplies partial detail.
  GitHub's public profile is readable. Preserve provenance and distinguish reported results from measured site performance.

## Issues found during review

These remain explicit reconciliation tasks in their owning phases, not permission to omit features:

1. Shared résumé access requires one action from every surface; some mobile specs describe two actions.
   Preserve the stricter one-action requirement through native system chrome and overlay controls.
2. OS release definitions include later-phase continuity and manual audit IDs. Keep unfinished OSes unreleased;
   distinguish preview validation from final production release and reconcile the circular gates before P3 completion.
3. Persisted running-app markers, draft archives and Snap state require typed additions to the compact kernel catalogue.
4. Linux's 24-line stagger would exceed its stated 240 ms cap; cap the computed stagger rather than extending the cap.
5. A project hint must resolve from its actual cwd; use absolute home paths where needed.
6. Build a downloadable résumé from sourced content; user supplied LinkedIn instead of a résumé document.
   Done in P0: the PDF is generated from `data/portfolio.ts`; an owner file at `content/resume.pdf` replaces it.

## P0 checkpoint (2026-09-21)

The P0 gate passed on automated evidence; every P0 ledger row is `verified` except `TEST-TOOL-01`, which needs a
first GitHub PR run. Gate table, Lighthouse baseline and inputs: `plans/STATUS.md`. Departures from specs:
`plans/shared/22-acceptance.md` → Deviations log.

Defects found and fixed while validating the gate:
- `RouteSync` created its history listener one frame late, so a Back pressed straight after a reload was lost and the
  first canonical write overwrote the entry (found by the WebKit iPad project; regression test added).
- Reader contrast: white on the dark-theme accent fill was 3.6:1 and the résumé paper inherited dark-theme text
  (1.07:1). Accent darkened, the paper re-scopes its own tokens; contrast tests now cover the brand layer.
- The tier script was 691 B against a 600 B budget; rewritten to 598 B with identical behaviour.
- `content/resume.pdf` was not picked up by the résumé build as `shared/02` requires; now it is.

Still owed outside automation: real-device, screen-reader and external deployment checks need real evidence;
browser emulation is not a substitute. No commits have been made (the owner commits).
