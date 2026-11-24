# Spec — social-selling/inbox-instagram

- **Summary:** A connected Instagram account's DMs, story replies, story mentions and comments arrive in the Instagram tab of the shop's Inbox and are answered from it, within Instagram's reply windows, publicly or by a private DM
- **Status:** Accepted
- **Domain:** channels
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-22
- **References:** [decisions.md](decisions.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md) (Q1, Q7, Q34, Q36), [inbox-core](../inbox-core/spec.md), [connect-instagram](../connect-instagram/spec.md), [meta-foundation](../meta-foundation/spec.md), [INTEGRATIONS.md](../../../INTEGRATIONS.md#acting-for-a-shop-on-meta-catalogue-whatsapp-instagram)

> Requirements and product approach only. Technical approach lives in trd.md. Module: Converse.
> The Instagram plug for inbox-core; stands on connect-instagram and meta-foundation.

## What this feature is
The Instagram tab. Everything a buyer says to the shop on Instagram, in a DM, in reply to a story
or in a comment, arrives here and is answered from here, as the shop's own account.

## Why
On Instagram buyers ask "price?" in DMs, in reply to stories and under posts. A shop working from
the app misses half of it; the Inbox shows all of it in one list (parent Q36).

## Requirements
- R1 — A DM, a story reply (shown with the story it answers) or a story mention to the account
  appears as a conversation (parent Q36).
- R2 — A comment on any of the account's posts or reels, however they were published, appears as a
  conversation grouped under its post. Comments arrive only for a public account; a private one is
  told so on the tab (Q2).
- R3 — The shop answers a DM; it arrives in the buyer's Instagram from the shop's account. Within 24
  hours of the buyer's last message the reply is free; from 24 hours to 7 days only a person may
  reply (the reply box says so); after 7 days no reply is possible (parent Q36).
- R4 — The shop answers a comment publicly, told that everyone sees it, or privately by one DM,
  within 7 days of the comment; the DM then continues as its own conversation (parent Q36).
- R5 — The shop hides or unhides a comment on Instagram from the thread; deleting stays in
  Instagram (parent Q36).
- R6 — Replies the shop makes in the Instagram app appear in the thread, marked as from the app (Q2).
- R7 — If Instagram misses telling us about a message, the inbox finds it anyway, by re-reading the
  account's conversations on a schedule, and shows it once (parent Q7).
- R8 — While message access is off in Instagram's settings, the tab says so and shows the three
  taps to allow it (parent Q1).
- R9 — A disconnected or removed connection keeps its conversations readable and asks to reconnect;
  the 90-day clock starts at disconnect and stops if the same account reconnects (Q9).

## Hazards the TRD must answer
- **The same DM from the event and from the re-read** shown twice.
- **A comment storm on one post** filling the inbox: grouped under the post, not a thousand rows.
- **Story replies whose story has expired** still showing what was answered.

## Product acceptance
Judged on a phone (~360px) first.
- A1 — A DM, a story reply and a comment sent to the owner's account appear in the Instagram tab,
  the story reply with its story.
- A2 — A reply to the DM arrives in the buyer's Instagram from the shop's account.
- A3 — After 24 hours the reply box says only a person may reply, until day 7.
- A4 — A comment answered privately becomes a DM conversation; a second private reply to the same
  comment is refused with the reason.
- A5 — A hidden comment disappears on Instagram and shows Unhide in the thread.
- A6 — A message whose event never came appears after the next re-read, once.

## Scope
- **Outcome:** a shop answers Instagram DMs, story replies and comments from its inbox.
- **In:** R1–R9, tested by A1–A6.
- **Later:** live comments (parent Q36). Automatic replies are comment-automations,
  enquiry-autoreplies and product-answers.

## Open questions
None.
