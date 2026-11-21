# Spec — social-selling/inbox-instagram

- **Summary:** A connected Instagram account's DMs and comments arrive in the shop's Inbox and are answered from it: DMs within Meta's reply windows, comments in public or by a private DM
- **Status:** Draft
- **Domain:** channels (the Instagram plug for inbox)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [decisions.md](decisions.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md), [inbox-core](../inbox-core/spec.md), [connect-instagram](../connect-instagram/spec.md), [INTEGRATIONS.md](../../../INTEGRATIONS.md#acting-for-a-shop-on-meta-catalogue-whatsapp-instagram)

> Requirements and product approach only. Technical approach lives in trd.md. Subfeature 7 of
> social-selling; needs connect-instagram and inbox-core. Behind the single review (parent Q2).

## What this feature is
The Instagram tab of the Inbox comes alive. A buyer's DM, or a comment on the shop's post, appears
within seconds. The shop answers a DM, replies to a comment in public, or replies to it privately
by DM, all without opening Instagram.

## Why
On Instagram, the question "price?" under a post is the start of most sales, and it goes cold if not
answered fast. A shop juggling the app and Bhendi Bazaar misses them. Bringing DMs and comments
into the shared inbox, beside the products, closes that gap.

## Requirements
- R1 — A DM, a story reply or a story mention to the connected account appears as a conversation
  in the Instagram tab, a story reply showing the story it answers (Q1, parent Q95).
- R2 — A comment on any of the account's posts or reels appears as a conversation, grouped under its
  post, showing which post (Q1, Q2, Q7).
- R3 — The shop answers a DM; the reply arrives in the buyer's Instagram as from the shop's account.
- R4 — DM reply windows follow Meta: free within 24 hours, by human agent up to 7 days, then none
  until the buyer writes again; the reply box says which (Q4, parent Q36).
- R5 — The shop replies to a comment publicly, and is told that it is public (Q5).
- R6 — The shop replies to a comment privately by DM, once per comment, within 7 days of the comment;
  later, the reply box explains why not (Q3).
- R7 — The shop hides or unhides a comment on Instagram from the inbox (parent Q49).
- R8 — Replies the shop makes in the Instagram app appear in the thread (Q8).
- R9 — An event Meta sends twice appears once; events for an account no shop has connected are
  ignored.
- R10 — A disconnected or removed connection keeps the history readable and asks to reconnect;
  retention follows parent Q34 (Q9).
- R11 — A private account is told that comments arrive only for a public account (Q10).
- R12 — Nothing from Meta (a payload, a token, an error body) reaches a log or a person.

## Hazards the TRD must answer
- **A forged webhook** injecting messages into a shop's inbox: the signature must be checked.
- **Meta retries and reorders** events; one message, in time order (inbox-core R12).
- **Two private replies to one comment** (inbox and comment-automations at once): Meta allows one.
- **Webhooks may not reach us before review** (parent Q81): acceptance on recorded payloads.
- **Rate limits**: Send API and private replies have hourly caps; a burst must queue, not fail.

## Product acceptance
Judged on a phone (~360px) first. Verified on the owner's own account (parent Q81).
- A1 — A DM sent to the owner's account appears in the Instagram tab within a minute; a reply from
  the inbox arrives in Instagram.
- A2 — A comment on the owner's post appears under that post; a public reply shows under the comment
  on Instagram; a private reply arrives as a DM.
- A3 — A second private reply to the same comment is refused, with ux.md's words.
- A4 — A DM thread older than 24 hours offers the extended reply with its end time; older than 7
  days, the reply box explains no reply is allowed.
- A5 — Hiding a comment from the inbox hides it on Instagram.
- A6 — A webhook with a bad signature changes nothing; a replayed one adds nothing.
- A7 — If live webhooks are not available before review, A1, A2 and A6 pass on recorded payloads
  through the real route, and are re-walked live after approval (going-live.md).

## Scope
- **Outcome:** a shop answers Instagram DMs and comments from its inbox.
- **In:** R1–R12, A1–A7.
- **Later:** live comments (Q1); keyword auto-replies are
  comment-automations.

## Open questions
None.
