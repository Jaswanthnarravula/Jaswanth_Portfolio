# iOS / apps — Messages

## Role + requirement refs
A friendlier, conversational route to **contact** — a scripted chat with Jaswanth whose quick-reply chips reveal real
contact channels. Secondary to Mail (`sectionOwner.contact = mail`). R22, R24. `AppRole: messages` · slug `messages`.

## Portfolio mapping
All bubble text is generated from data (`person`, `contact`, `resume`, featured projects) through a small **script
graph** — no hand-typed facts:

| Visitor chip | Jaswanth replies with |
|---|---|
| "What do you do?" | `person.headline` + one-line summary → chip "See projects" (opens GitHub) |
| "Are you available?" | `person.openTo` → chips "Email you" · "Copy your email" |
| "Show me your résumé" | an attachment bubble "Résumé.pdf" → opens Files Quick Look |
| "Where else can I find you?" | link bubbles for each `contact.links` entry (↗ new tab) |
| "Email you" | hands off: `mailto:` (same builder as Mail) |

## Anatomy
- **Conversations list (root):** large title "Messages"; one pinned conversation "Jaswanth" (initials avatar, last
  line, time).
- **Thread (pushed):** nav bar with centred avatar + name; bubbles: incoming grey left, outgoing **blue** right
  (radius 18 pt with tail), timestamps as centred captions, "Delivered" under the last outgoing bubble.
- **Composer area:** instead of a free-text keyboard flow, a horizontally scrollable row of **quick-reply chips**
  above a disabled-looking text field whose placeholder reads "Choose a reply above" (tapping the field focuses the
  first chip). This keeps it honest: there is no backend to receive free text.

## Behaviour & states
- First open: the thread shows a greeting sequence (2 bubbles) — appended **instantly on reduced motion**, otherwise
  with a typing indicator (three dots, ≤ 600 ms each, **skipped entirely by any tap/keypress**).
- Tapping a chip → outgoing bubble appears (scale-in from the chip) → typing indicator → reply bubble(s) → next chips.
- The conversation state (which branches were visited) persists with the iOS session.
- Links/attachments inside bubbles are real links.

## Navigation & routes
`/ios/messages` only.

## Motion
Bubble in: scale 0.9 → 1 + rise 8 pt, spring r 0.35 ζ 0.8. Typing dots: opacity loop (CSS). Auto-scroll pins to the
bottom unless the visitor scrolled up. Reduced motion: bubbles appear without animation or indicator.

## Responsive
Chips row scrolls; chips wrap to two rows on pad. Thread max width 640 pt on pad/split view. Bounded by `--vvh`
(no keyboard normally appears).

## Accessibility
Thread = `role="log"` with polite announcements of **final text only** (no typing-indicator chatter). Bubbles are
list items labelled "Jaswanth said…" / "You said…". Chips = a `group` "Suggested replies" of buttons. The fake text
field is `aria-hidden`; the chips group carries the instruction.

## Edge cases
All branches visited → chips reset to the top-level set with "Start over". Clipboard blocked → address shown in a
bubble as selectable text. App reopened → full transcript restored, no re-animation.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `IOS-MSG-01` | Conversations list + thread with iMessage-style bubbles | `cmp: thread renders from script + fixture` | P5 |
| `IOS-MSG-02` | Script graph generated from data; chips drive branches | `unit: every branch resolves; no hard-coded facts` | P5 |
| `IOS-MSG-03` | Typing indicator skippable by any input; none under reduced motion | `e2e: tap during typing shows reply immediately; R1` | P5 |
| `IOS-MSG-04` | Hand-offs: mailto, copy, résumé Quick Look, external links | `e2e: each chip action works` | P5 |
| `IOS-MSG-05` | Transcript persists; log semantics with final-text announcements | `e2e: P1 transcript restored; cmp: log announcements` | P5 |

## Not like the others
Exists **only on iOS** — a conversational contact surface with blue bubbles and reply chips. Other OSes handle
contact solely through their mail apps (and Linux through `contact`).
