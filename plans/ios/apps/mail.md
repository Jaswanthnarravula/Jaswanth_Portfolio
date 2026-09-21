# iOS / apps — Mail

## Role + requirement refs
**Contact** on iOS. R22, R23, R24. `AppRole: mail` · slug `mail` · owns `contact`. Sending = `mailto:` hand-off
(`VIEW-CONTACT-01`).

## Portfolio mapping
`ContactPanel` + `person.openTo`. Inbox generated from data — the same three messages as every OS ("Let's talk" —
unread, "Where to find me", "My résumé" with an attachment).

## Anatomy
- **Mailboxes (root):** large title "Mailboxes": Inbox (1) · Sent · Drafts.
- **Inbox (pushed):** large title "Inbox", search field; rows: unread blue dot, sender (17 semibold), time, subject
  (15), 2-line preview (15 secondary), chevron. Bottom toolbar: filter glyph (decorative) · "Updated Just Now" ·
  **Compose** (pencil-square, bottom-right).
- **Message (pushed):** sender header with initials avatar, subject (22 bold), body, attachment tile (PDF icon,
  name, size) → Quick Look in Files; bottom toolbar: **Reply** · Copy address · Share.
- **Compose (sheet, large detent):** "New Message" nav bar with **Cancel** (left) and **Send** (↑ in a blue circle,
  right); fields To (prefilled token, read-only) · Subject · body.

## Behaviour & states
| State | Behaviour |
|---|---|
| Open message | Push; unread dot clears (session); Home Screen badge clears |
| Compose / Reply | Sheet rises; text stored as `WindowInstance.draft`; Cancel → action sheet "Delete Draft / Save Draft" only if text exists |
| **Send** | Encoded `mailto:` (body ≤ 1800 chars) → navigate → sheet dismisses → banner "Handed to your mail app" with **Copy address** as the fallback action; emits `contact_initiated` |
| Copy address | Clipboard + "Copied" banner; fallback sheet with the address selected |
| Swipe row left | Reveals "Copy address" (alternative: long-press menu / message toolbar) |
| Sent / Drafts | Sent: "Messages open in your own mail app." · Drafts lists the saved draft |

## Navigation & routes
`/ios/mail` only; stack and sheet are session state.

## Motion
Push/pop and sheet per lifecycle. Send: the sheet flies up and out (300 ms ease-in) — the "whoosh" without sound
unless enabled.

## Responsive
Inputs 17 pt (≥ 16 px, no focus zoom); the body field grows; Send stays in the nav bar above the keyboard; sheet
height follows `--vvh`. Pad: three-column split (mailboxes · list · message); compose is a centred form sheet.

## Accessibility
Rows are links with full names ("Unread. Jaswanth. Let's talk. …"). Compose = modal `dialog` with a `<form>`;
Send is a submit button named "Send"; Cancel first in order. Swipe action has a non-gesture equivalent. Banner in
the status region.

## Edge cases
Long body → truncated note + full text copied. Keyboard up + rotation → sheet re-measures `--vvh`. App backgrounded
with compose open → draft kept and sheet restored on return.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `IOS-MAIL-01` | Mailboxes → Inbox → Message push flow with data-generated messages | `cmp: messages derive from fixture` | P5 |
| `IOS-MAIL-02` | Compose sheet with draft persistence + Delete/Save action sheet | `e2e: P1 draft survives reload` | P5 |
| `IOS-MAIL-03` | Send = encoded `mailto:` + banner with copy fallback | `cmp: mailto encoding + truncation` | P5 |
| `IOS-MAIL-04` | Attachment → Files Quick Look | `e2e: tile opens /ios/files/resume` | P5 |
| `IOS-MAIL-05` | Keyboard-safe compose (`--vvh`, ≥ 16 px inputs); pad split view | `e2e: iphone keyboard-up; ipad` | P5 |
| `IOS-MAIL-06` | Form/dialog semantics; swipe alternative | `e2e: X1 axe clean` | P5 |

## Not like the others
**Compose as a card sheet with Cancel/Send in the nav bar, swipe actions, push navigation** (macOS: three-pane +
window sheet; Outlook: compose in the reading pane; Gmail on Android: Compose FAB + full-screen activity, system Back).
