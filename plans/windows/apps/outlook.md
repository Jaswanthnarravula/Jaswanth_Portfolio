# Windows 11 / apps — Outlook

## Role + requirement refs
**Contact.** R22, R23, R24. `AppRole: mail` · slug `outlook` · owns `contact`. Sending = `mailto:` hand-off
(`VIEW-CONTACT-01`); no backend.

## Portfolio mapping
`ContactPanel` + `person.openTo`. Inbox generated from data — same three messages as every OS's mail app ("Let's
talk", "Where to find me", "My résumé" with attachment chip).

## Anatomy
Window 1020 × 640 (min 600 × 400). Mica title bar with a search box. Far-left **app rail** (Mail · Calendar · People —
the last two decorative-disabled). **Simplified ribbon** (one row): **New mail** (primary accent button) · Reply ·
Copy address · ⋯. Three panes: folder pane (Inbox (3) · Sent Items · Drafts) · message list (Focused | Other pivot —
"Other" is empty with a friendly line; rows: sender, subject, preview, time, unread = accent bar + bold) · **reading
pane** (header, body, attachment chip, action buttons: Reply by email · Copy address · LinkedIn ↗).
**Compose opens inside the reading pane** (inline form: To — prefilled, Subject, body, **Send** accent button,
Discard).

## Behaviour & states
| State | Behaviour |
|---|---|
| Select message | Reading pane updates; unread bar clears (session) |
| New mail / Reply | Reading pane swaps to the compose form; text persists as `WindowInstance.draft`; Drafts shows (1) |
| **Send** | Build encoded `mailto:` (body ≤ 1800 chars) → navigate → compose is replaced by an InfoBar: "Handed to your email app. Nothing opened? Copy the address." + Copy button; emits `contact_initiated` |
| Copy address | Clipboard + toast "Copied to clipboard"; fallback: selected read-only field |
| Attachment chip | Opens `/windows/edge/resume`; chevron menu: Open · Save as (download) |
| Discard | Confirms only if text exists ("Discard this draft?" — Discard / Keep) |

## Navigation & routes
`/windows/outlook` only; selection/compose are session state.

## Motion
Pane swaps 167 ms fade; Send: form collapses 167 ms → InfoBar slides down 250 ms. List hover fills 83 ms.

## Responsive
`medium`: folder pane collapses to icons. `compact`: list → message push; compose full-height with a sticky Send bar
above the safe area; inputs ≥ 16 px; ribbon → ⋯ menu + New mail FAB-less primary button in the header.

## Accessibility
Folder pane `nav`; message list `ul` of buttons with full names ("Unread, Jaswanth, Let's talk, …"); compose is a
`<form>` region with labelled inputs (Ctrl/Cmd+Enter sends; Enter in the body doesn't); InfoBar is `role="status"`;
discard confirmation is a modal `dialog`.

## Edge cases
Long body → truncated note + full text copied. Clipboard blocked → manual field. Closing the window with a draft →
kept; reopening restores the compose state.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `WIN-OUT-01` | Shell: app rail, simplified ribbon, three panes, Focused/Other pivot | `cmp: messages derive from fixture` | P4 |
| `WIN-OUT-02` | Compose inside the reading pane with persisted draft + discard confirm | `e2e: P1 draft survives reload` | P4 |
| `WIN-OUT-03` | Send = encoded `mailto:` + InfoBar + copy fallback | `cmp: mailto encoding; truncation` | P4 |
| `WIN-OUT-04` | Attachment chip → Edge PDF tab / download | `e2e: chip opens /windows/edge/resume` | P4 |
| `WIN-OUT-05` | Compact push navigation + sticky Send | `e2e: N3` | P4 |
| `WIN-OUT-06` | Form semantics, status InfoBar, modal confirm | `e2e: X1 axe clean` | P4 |

## Not like the others
**Ribbon row, Focused/Other pivot, compose inside the reading pane, InfoBar confirmations** (macOS Mail: sheet attached
to the window; iOS Mail: card rising from the bottom; Gmail: FAB + full-screen compose).
