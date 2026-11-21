# Decisions — social-selling/inbox-core

- **Verified:** 2026-11-21

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented
> ones
> ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste. Claude decides the
> rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn" means
> [../decisions.md](../decisions.md). Binding here from the parent: Q2, Q7, Q8, Q34, Q36, Q37, Q63,
> Q66, Q89.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q2 | What is a conversation? | One thread between the shop and one person on one platform account: a DM or chat thread, or one comment thread under one post (the comment and its replies). Keyed by the platform's own thread id, unique per (shop, source, thread id) | Claude · reversible | 2026-11-06 | What every inbox in the field shows as one row; a re-delivered event finds the same thread | decided |
| Q3 | What is unread, and how is the inbox searched? | A conversation is unread when its newest message is from the person and arrived after any member last opened it; opening the thread marks it read for the whole shop. Each tab has an Unread chip, and search finds a person by name or handle; there is no full-text search of messages | Claude · reversible | 2026-11-06 | Shared inbox (parent Q63): one shop-wide read state, not one per member | decided |
| Q5 | What can a message carry, in and out? | A reply is text up to 1,000 characters and one image from the shop's media library: no voice notes, stickers or files. Anything arriving that the inbox cannot show (a voice note, sticker, video, reel share) appears as a line naming what it was, with its time ("Voice note — open it in Instagram"), never dropped silently | Claude · reversible | 2026-11-06 | Covers selling conversations; both platforms accept text and an image. Instagram's text cap is 1,000 | decided |
| Q7 | How does the reply box behave when a platform's reply window has shut? | The port tells the tool the window: open (reply freely), human-agent (parent Q36: a reply allowed until day 7, sent tagged), or shut. Shut on WhatsApp offers approved templates with each one's cost (parent Q37); shut on Instagram explains Meta allows no reply until the person writes again. Never disabled | Claude · reversible | 2026-11-06 | ADR-0053; the window rules belong to each platform, so the plug reports them | decided |
| Q9 | What happens when a send fails? | The message shows Not sent with the plain reason and Try again. A temporary failure is retried once automatically first; a dead connection says Reconnect | Claude · reversible | 2026-11-06 | Mirrors parent Q51's pattern for posts | decided |
| Q15 | Does the inbox store the person's phone number or profile photo? | The display name and handle (Instagram) or number (WhatsApp) as the platform gives them; no profile photo, whose links expire. A WhatsApp number is contact data (ADR-0024), never an identity key across shops | Claude · reversible | 2026-11-06 | Hold only what the row needs (DPDP) | decided |

## Parked (Later)
- Assigning conversations to a member (parent Q63).
- AI suggested replies (parent Q89).
- Full-text search of message bodies (Q3).

## Merged ids
Absorbed in the 2026-11-21 audit; read the id on the right.
Q1 → parent Q63 · Q4 → parent Q63 · Q6 → Q5 · Q8 → parent Q36 · Q10 → parent Q34 · Q11 → parent Q66 · Q12 → Q3 · Q13 → removed · Q14 → parent Q34
