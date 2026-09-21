# macOS / apps — Mail

## Role + requirement refs
**Contact.** A three-pane mail client whose inbox holds a few real, useful messages from Jaswanth, and whose
compose window hands off to the visitor's own email client. R22, R23, R24. `AppRole: mail` · slug `mail` · owns `contact`.
Decision: `mailto:` hand-off, no backend (`VIEW-CONTACT-01`).

## Portfolio mapping
`ContactPanel` (email, links) + `person.openTo`. Inbox messages are generated from data (not hand-typed facts):

| Message | From data |
|---|---|
| "Let's talk" (pinned, unread) | `person.openTo`, email, preferred channels |
| "Where to find me" | `contact.links` (GitHub, LinkedIn, …) as buttons |
| "My résumé" | attachment chip → opens Preview / downloads PDF |

## Anatomy
Window 980 × 620 (min 600 × 400). Toolbar: **New Message** (primary) · Reply · Copy Address. Sidebar 180 px:
Inbox (3) · Sent (empty state) · Drafts (shows a draft if the compose text is non-empty). Message list 300 px (sender,
subject, 2-line preview, date, unread dot). Reading pane: header (from, to "You", date), body, attachment chip,
action row: **Reply by email** · Copy address · Open LinkedIn ↗.
**Compose sheet** (window-attached): To (prefilled, read-only), Subject, Message, **Send**.

## Behaviour & states
| State | Behaviour |
|---|---|
| Select message | Reading pane updates; unread dot clears (session) |
| New Message / Reply | Compose sheet slides from the title bar; Subject/Message editable; text is saved as `WindowInstance.draft` |
| **Send** | Builds `mailto:{email}?subject=…&body=…` (encoded, body ≤ 1800 chars) and navigates to it; then shows a calm confirmation: "Handed to your email app. If nothing opened, copy the address instead." + Copy button. Emits `contact_initiated` |
| Copy address | Clipboard + banner "Email address copied"; fallback: selected read-only field |
| No mail client | The confirmation state covers it (no detection attempted — unreliable) |
| Empty Sent | "Messages you send open in your own mail app." |

## Navigation & routes
`/macos/mail` only. Selected message and compose state are session state; the draft persists with the session.

## Menu-bar menus
File: New Message · Close Window. Message: Reply · Copy Address. Mailbox: Inbox · Sent · Drafts.

## Motion
Compose sheet: drop from under the toolbar, 260 ms `0.2,0.9,0.3,1`, with a scrim on the window only. Send: sheet
lifts away (200 ms) → confirmation. No "whoosh" unless sound is enabled.

## Responsive
`medium`: sidebar collapses to a popover. `compact`: list → message push navigation; compose is a full-height sheet;
inputs ≥ 16 px; Send is a sticky bottom button above the safe area.

## Accessibility
Message list is a `ul` of buttons (name = "Unread. From Jaswanth. Let's talk. …"). Compose is a modal `dialog`
scoped to the window with labelled inputs; Send is a real submit button inside a `<form>` (Enter in the body does
not send; Ctrl/Cmd+Enter does). Confirmation is announced politely.

## Edge cases
Body too long for `mailto:` → truncated with a note "…(continued — paste the rest in your email app)" and the full
text copied to the clipboard. Clipboard blocked → manual-copy field. Draft present when closing the window → kept;
Drafts shows (1).

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `MAC-MAIL-01` | Three-pane client with data-generated inbox | `cmp: messages derive from fixture data` | P3 |
| `MAC-MAIL-02` | Compose sheet with persisted draft | `e2e: P1 draft survives reload` | P3 |
| `MAC-MAIL-03` | Send = encoded `mailto:` hand-off + confirmation + copy fallback | `cmp: mailto URL encoded; long body truncated + copied` | P3 |
| `MAC-MAIL-04` | Copy address with clipboard fallback + banner | `cmp: VIEW-CONTACT-01 on macOS` | P3 |
| `MAC-MAIL-05` | Compact push navigation + full-height compose | `e2e: M3` | P3 |
| `MAC-MAIL-06` | Form semantics, keyboard send, polite confirmation | `e2e: X1 axe clean; Ctrl+Enter sends` | P3 |

## Not like the others
Three-pane layout with a **sheet attached to the window** for compose (Outlook on Windows: ribbon-like command bar,
reading pane right, compose in the reading pane; iOS Mail: stacked push navigation with a compose card rising from
the bottom; Gmail on Android: list + a floating Compose FAB and full-screen compose).
