# Spec — social-selling/comment-automations

- **Summary:** A buyer who comments the shop's keyword on its Instagram post gets one DM with what the shop chose to send, the product links suggested, and optionally a public reply saying a DM was sent
- **Status:** Draft
- **Domain:** automations
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-22
- **References:** [decisions.md](decisions.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md) (Q7, Q18, Q89), [post-composer](../post-composer/spec.md), [inbox-instagram](../inbox-instagram/spec.md), [inbox-core](../inbox-core/spec.md)

> Requirements and product approach only. Technical approach lives in trd.md. Module: Converse.
> The first automatic reply. Platform-free: comments arrive as neutral events, DMs leave through the inbox.

## What this feature is
A panel in the post composer: a keyword and the DM to send. When a buyer comments that keyword,
they get the DM, the products' links in it, without the shop doing anything.

## Why
Instagram captions cannot carry a link, and product tags need a checkout India does not have
(parent Q18). "Comment SHOP to get the link" is how Indian sellers get a buyer from a post to the
product, and it is free; doing it by hand for every comment is what makes them miss sales.

## Requirements
- R1 — The composer shows this module's panel: a keyword (default SHOP) and a DM pre-filled, for
  each product the post names, with its name, Buy now (a checkout link) and See details (its page);
  the shop may rewrite it to anything up to 1,000 characters. The rule is this module's, kept
  against the post (Q1, Q4, parent Q114).
- R2 — A shop may also keep one shop-wide rule, used for comments on any of its posts with no rule
  of its own, including posts made in the Instagram app (Q1).
- R3 — A comment matches when it holds the keyword as a whole word, ignoring case, accents,
  punctuation and emoji (Q3).
- R4 — A match sends the DM through the inbox, where it appears in the thread marked Automatic; an
  optional public reply (off by default) says a DM was sent (Q4).
- R5 — One DM per comment, ever, and at most one per person per post, whatever Meta redelivers (Q6).
- R6 — A comment older than 7 days by the time it is reached gets nothing, and says so; the shop's
  own comments and replies within a thread are never answered (Q6).
- R7 — A burst of comments is answered within Meta's rate limit; none under 7 days old is dropped (Q6).
- R8 — An archived product's link is never sent; an out-of-stock one is, since its page says so. If
  nothing the shop wrote would remain, nothing is sent and the post's activity says why (Q4).
- R9 — Each post shows its rule, DMs sent today and in total, and its recent matches with their
  outcome; any rule can be paused and resumed without losing its settings (Q1, Q11).

## Hazards the TRD must answer
- **A viral post:** thousands of matching comments within Meta's private-reply limit.
- **A comment edited after it matched,** or deleted before the DM went.

## Product acceptance
Judged on a phone (~360px) first.
- A1 — A post scheduled with keyword SHOP and one product: a comment "shop 🙏" gets one DM with the
  product link; the DM appears in the inbox marked Automatic.
- A2 — The same person commenting SHOP again on that post gets nothing more.
- A3 — The shop-wide rule answers a comment on a post made in the Instagram app.
- A4 — A paused rule sends nothing; resumed, it answers new comments.
- A5 — A comment reached after 7 days is marked too late in the post's activity.

## Scope
- **Outcome:** a keyword comment gets the shop's DM, with the product link suggested.
- **In:** R1–R9, tested by A1–A5.
- **Later:** several shop-wide rules; story-mention automations; AI understanding of comments (parent Q89).

## Open questions
None.
