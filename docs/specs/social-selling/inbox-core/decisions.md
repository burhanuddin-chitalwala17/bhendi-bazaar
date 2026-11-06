# Decisions — social-selling/inbox-core

- **Verified:** 2026-11-06

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste.
> Claude decides the rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn"
> means [../decisions.md](../decisions.md). Binding here from the parent: Q7, Q30, Q31, Q34, Q36, Q41, Q43, Q49, Q50, Q63, Q66, Q76, Q79, Q81.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | Does inbox-core reach any real platform? | No. It ships with a fake source a developer and the test suite drive; Instagram and WhatsApp are their own subfeatures, plugged in through the same port | Claude · reversible | 2026-11-06 | Parent Q7: the tool knows no platform; it can be built and accepted before Meta's review | decided |
| Q2 | What is a conversation? | One thread between the shop and one person on one platform account: a DM or chat thread, or one comment thread under one post (the comment and its replies). Keyed by the platform's own thread id, unique per (shop, source, thread id) | Claude · reversible | 2026-11-06 | What every inbox in the field shows as one row; a re-delivered event finds the same thread | decided |
| Q3 | What counts as unread? | A conversation whose newest message is from the person and arrived after any member last opened it. Opening the thread marks it read for the whole shop | Claude · reversible | 2026-11-06 | Shared inbox (parent Q50): one shop-wide read state, not one per member | decided |
| Q4 | Does a member's reply show who sent it? | Yes: each outgoing message carries the member's name, seen by members only, never sent to the person. A reply sent from the phone app (WhatsApp coexistence echo) shows "From the WhatsApp app" | Claude · reversible | 2026-11-06 | Parent Q50 | decided |
| Q5 | What may a reply contain? | Text up to 1,000 characters, and one image from the shop's media library. No voice notes, stickers or files | Claude · reversible | 2026-11-06 | Covers selling conversations; both platforms accept text and an image. Instagram's text cap is 1,000 | decided |
| Q6 | What arrives that the inbox cannot show (voice note, sticker, video, reel share)? | A line naming what it was ("Voice note — open it in Instagram") and the time; never dropped silently | Claude · reversible | 2026-11-06 | The shop must know a person wrote | decided |
| Q7 | How does the reply box behave when a platform's reply window has shut? | The port tells the tool the window: open (reply freely), human-agent (parent Q36: a reply allowed until day 7, sent tagged), or shut. Shut on WhatsApp offers approved templates with each one's cost (parent Q76); shut on Instagram explains Meta allows no reply until the person writes again. Never disabled | Claude · reversible | 2026-11-06 | ADR-0053; the window rules belong to each platform, so the plug reports them | decided |
| Q8 | Can a comment be hidden from the inbox? | Yes, where the plug says the platform supports it (Instagram, parent Q49). Hidden shows on the thread with Unhide; hiding is done on the platform, never only here | Claude · reversible | 2026-11-06 | A hide that only hides here would mislead the shop | decided |
| Q9 | What happens when a send fails? | The message shows Not sent with the plain reason and Try again. A temporary failure is retried once automatically first; a dead connection says Reconnect | Claude · reversible | 2026-11-06 | Mirrors parent Q52's pattern for posts | decided |
| Q10 | How long are messages kept? | While the source's channel is connected; 90 days after it is disconnected every conversation of that source is deleted. A person's deletion request deletes their conversations at once | Owner | 2026-11-06 | Parent Q34, restated as built here | decided |
| Q11 | What does the inbox tell the rest of the app? | Neutral events only, on the queue: `inbox.conversation-waiting` (unanswered 4 hours), `inbox.send-failed`. Notifications decides who hears and how (badge, daily email). The unread count is a read the badge calls | Claude · reversible | 2026-11-06 | Parent Q41, Q66: the inbox never sends an email itself | decided |
| Q12 | Search and filters? | Unread chip per tab, and search by the person's name or handle. No full-text search of messages | Claude · reversible | 2026-11-06 | Small shops; full-text over personal messages is a later need | decided |
| Q13 | Where is the Inbox in the shop menu? | Its own item, "Inbox", directly under Channels, with the unread count beside it | Claude · reversible | 2026-11-06 | It is used daily; the count needs a visible home | decided |
| Q14 | May an admin read a conversation? | Not in this subfeature. The data is shaped so an audited read can be added (parent Q43, Q44): every message is readable by one query keyed by conversation | Owner | 2026-11-06 | Parent Q43, Q44 | decided |
| Q15 | Does the inbox store the person's phone number or profile photo? | The display name and handle (Instagram) or number (WhatsApp) as the platform gives them; no profile photo, whose links expire. A WhatsApp number is contact data (ADR-0024), never an identity key across shops | Claude · reversible | 2026-11-06 | Hold only what the row needs (DPDP) | decided |

## Parked (Later)
- Assigning conversations to a member (parent Q50).
- AI suggested replies (parent Q31).
- Full-text search of message bodies (Q12).
