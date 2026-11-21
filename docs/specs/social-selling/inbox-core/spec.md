# Spec — social-selling/inbox-core

- **Summary:** One shared inbox where a shop reads and answers its conversations, one tab per platform, built against a fake source so it works before any platform is plugged in
- **Status:** Draft
- **Domain:** inbox (new)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [decisions.md](decisions.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md), [inbox-instagram](../inbox-instagram/spec.md), [inbox-whatsapp](../inbox-whatsapp/spec.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md), [ADR-0024](../../../adr/0024-phone-is-contact-data-not-an-identity-key.md)

> Requirements and product approach only. Technical approach lives in trd.md. Subfeature 3 of
> social-selling. The inbox knows no platform (parent Q7); each platform is a plug.

## What this feature is
An Inbox page in the shop's portal. Conversations arrive newest first, one tab per connected
platform. A member opens one, reads it, and replies; every member sees the same list and who
answered what. Platforms plug in later without the inbox changing.

## Why
Buyers ask about price, size and stock in DMs, comments and chats. Answering them in the platform
apps means a phone per app and no shared view. One inbox the whole shop shares, beside its products,
is where a question becomes a sale. Building it against a fake source means it is finished and
tested before Meta's review, and that adding a platform never touches it.

## Requirements
- R1 — Conversations from every plugged-in source appear in one Inbox, a tab per platform that is
  connected, newest activity first (parent Q63).
- R2 — Every member sees every conversation; each reply shows which member sent it, to members only
  (parent Q63, Q4).
- R3 — A conversation is unread for the shop until a member opens it; the menu shows the shop's
  unread count (Q3).
- R4 — A member replies with text and, optionally, one image from the media library (Q5).
- R5 — The reply box always says what is possible now: reply freely, reply within the extended
  window (parent Q36), send an approved template with its cost (parent Q37), or no reply allowed
  until the person writes again. It is never disabled (Q7).
- R6 — A message the inbox cannot show still appears, named for what it was (Q5).
- R7 — Where the platform allows, a comment can be hidden and unhidden from the inbox, on the
  platform itself (parent Q36, Q8).
- R8 — A failed send shows Not sent, the reason and Try again (Q9).
- R9 — Messages are kept while the channel is connected and deleted 90 days after a disconnect; a
  person's deletion request removes their conversations at once (parent Q34).
- R10 — The inbox emits neutral events (a conversation waiting 4 hours, a send failed) and sends no
  email or alert itself (parent Q66).
- R11 — Search by the person's name or handle; an Unread filter on each tab (Q3).
- R12 — A source that delivers the same message twice shows it once.
- R13 — Each shop sees only its own conversations.

## Hazards the TRD must answer
- **The same event delivered twice or out of order** by a platform: one message, in time order.
- **Two members replying at once** to one conversation: both replies sent, both shown, no loss.
- **A platform plug leaking into the tool**: the boundary test must forbid it.
- **Retention deletes the wrong shop's rows**, or deletes while a reconnect is happening.
- **A person's message text reaching a log or an error tracker.**

## Product acceptance
Judged on a phone (~360px) first ([ADR-0015](../../../adr/0015-mobile-first-design.md)).
- A1 — With the fake source switched on in dev, a member sees a new conversation appear, opens it,
  replies, and sees the reply marked with their name.
- A2 — A second member sees the same conversation read, with the first member's reply.
- A3 — The same fake event sent twice shows one message.
- A4 — Each reply-window state from the fake source shows its own reply box, as ux.md writes it.
- A5 — A conversation left unanswered 4 hours emits one waiting event.
- A6 — Disconnecting the fake source and moving the clock 90 days deletes its conversations; a
  deletion request for one person deletes only theirs.
- A7 — Every state in ux.md's matrices can be reached and reads as written.
- A8 — The boundary test fails if `server/inbox` imports a platform provider.

## Scope
- **Outcome:** a shop reads and answers its conversations in one shared inbox.
- **In:** R1–R13, A1–A8.
- **Later:** assignment (parent Q63), AI replies (parent Q89), full-text search (Q3), the audited
  admin read (parent Q34). Real platforms are inbox-instagram and inbox-whatsapp (parent Q63).

## Open questions
None.
