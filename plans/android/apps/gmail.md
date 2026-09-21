# Android / apps — Gmail

## Role + requirement refs
**Contact** on Android. R22, R23, R24. `AppRole: mail` · slug `gmail` · owns `contact`. Sending = `mailto:` hand-off
(`VIEW-CONTACT-01`).

## Portfolio mapping
`ContactPanel` + `person.openTo`. Inbox generated from data — the same three messages as every OS ("Let's talk" —
unread/bold, "Where to find me", "My résumé" with an attachment chip).

## Anatomy
- **Search bar on top** (56 dp pill "Search in mail", leading ☰ → navigation drawer: Primary · Sent · Drafts ·
  Settings; trailing avatar initials).
- **List:** "Primary" label; items 72 dp+: sender avatar circle (initial on a palette colour), sender (bold if
  unread), time, subject, snippet, star toggle.
- **Extended FAB "Compose"** (pencil + label, `primary-container`), bottom-right above the nav bar; **shrinks to an
  icon on scroll down**, extends on scroll up.
- **Message (forward nav):** top app bar ◀ · archive (decorative hidden) · ⋮; subject Title-L; sender row with
  expand; body; **attachment chip** (PDF icon, "Résumé.pdf", size) with a download glyph; bottom **Reply** /
  **Copy address** outlined buttons.
- **Compose (full-screen activity):** top app bar ✕ (close) · "Compose" · 📎 (disabled) · **Send ➤** · ⋮; fields:
  From (visitor — "you"), To (chip, prefilled, read-only), Subject, body.

## Behaviour & states
| State | Behaviour |
|---|---|
| Open message | Container transform from the list item; unread style clears (session); favorites dot clears |
| Compose | FAB → **container transform FAB → full screen** (M3 signature); text stored as `WindowInstance.draft` |
| **Send** | Encoded `mailto:` (body ≤ 1800 chars) → navigate → compose closes → **snackbar** "Handed to your email app" with action **Copy address**; emits `contact_initiated` |
| Close compose (✕ / **Back**) | If text exists → snackbar "Draft saved"; Drafts shows it |
| Copy address | Clipboard + snackbar "Copied to clipboard"; fallback dialog with the address selected |
| Attachment chip | Opens `/android/files/resume`; download glyph downloads |
| Swipe list item | Reveals a "Copy address" background action (alternative: ⋮ / long-press menu) |

## Navigation & routes
`/android/gmail` only; message/compose/drawer are session state; Back unwinds: IME → compose → message → inbox → launcher.

## Motion
FAB ↔ compose container transform 300 ms emphasized; list → message container transform; FAB extend/shrink 200 ms;
snackbar 150/75 ms. Predictive Back previews the inbox behind compose.

## Responsive
Inputs 16 sp; compose respects `--vvh` (Send stays in the top app bar, always visible). Phone landscape: same.
**Pad:** navigation rail (with a FAB at its top) + list-detail; compose opens as a **dialog-sized card** bottom-right
(like Gmail on tablets/web).

## Accessibility
List items are links with full names ("Unread, Jaswanth, Let's talk, …"); star is a separate toggle button. FAB has
a persistent accessible name "Compose". Compose = full-screen modal `dialog` with a `<form>`, Send = submit button,
Close first. Snackbars in the status region with reachable actions. Swipe action has non-gesture equivalents.

## Edge cases
Long body → truncated note + full text copied. Keyboard + rotation → `--vvh` re-measured. Compose open when leaving
the app via Home → draft saved, state restored from Recents.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `AND-GMAIL-01` | Inbox with top search bar, drawer, data-generated messages | `cmp: messages derive from fixture` | P6 |
| `AND-GMAIL-02` | **Extended FAB** that shrinks on scroll; FAB → compose container transform | `e2e: FAB states; transform plays and reverses on Back` | P6 |
| `AND-GMAIL-03` | Compose activity with persisted draft + "Draft saved" | `e2e: P1 draft survives reload and Clear all` | P6 |
| `AND-GMAIL-04` | Send = encoded `mailto:` + snackbar with Copy action | `cmp: mailto encoding + truncation` | P6 |
| `AND-GMAIL-05` | Attachment chip → Files PDF viewer / download | `e2e: chip opens /android/files/resume` | P6 |
| `AND-GMAIL-06` | Keyboard-safe compose; pad rail + list-detail + card compose | `e2e: pixel keyboard-up; tablet` | P6 |
| `AND-GMAIL-07` | Semantics (dialog form, snackbar status, swipe alternative) | `e2e: X1 axe clean` | P6 |

## Not like the others
**A Compose FAB that transforms into a full-screen compose, snackbar confirmations, Back-unwound layers** (iOS Mail:
card sheet with Cancel/Send; macOS: window sheet; Outlook: compose in the reading pane with InfoBars).
