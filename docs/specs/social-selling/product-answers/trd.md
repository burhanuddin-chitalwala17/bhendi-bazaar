# TRD — social-selling/product-answers

- **Status:** Accepted
- **Domain:** automations, reading catalog, promotions and bidding through public surfaces
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-23
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), the architecture [TRD](../trd.md), [enquiry-autoreplies TRD](../enquiry-autoreplies/trd.md), [checkout-links TRD](../../checkout-links/trd.md), [ADR-0018](../../../adr/0018-one-effective-price-function.md), [ADR-0023](../../../adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
A part of the auto-reply decision: when a message asks about price, stock or size and the
conversation carries a product reference, answer with a live product card; with no reference, offer
up to three likely products; with a question the product's facts cannot answer, hand over.

## Prior art
- **Context-carrying product questions** (Instagram shops' "price?" replies handled by tools such as
  ManyChat flows): a product bound to the thread by the post or story the person came from. We
  follow it and never guess silently (Q1).

## Technical decisions
- **D1 — Product reference (R1, Q1).** Resolved in order from the message: a catalogue item
  (retailer id = product id), a product link (slug → id), a story reply or shared post (post →
  the post's named products, through social), a comment-to-DM thread (the rule's products). Stored
  on the conversation as `productContext` (last one wins, with its source).
- **D2 — Intent (R2).** An `intentPrice`, `intentStock` and `intentSize` keyword set in English,
  Hindi and Hinglish ("price", "kitna", "rate", "available", "size", "L hai?"), same normaliser.
- **D3 — Answer (R3, R4).** Built at send time: effective price and list price (ADR-0018), stock
  answer including an auction hold (ADR-0023), sizes in stock from the family; buttons Buy now
  (cart's checkout link, source AUTOMATIC) and See details. A family product's Buy opens the size
  step of checkout-links.
- **D4 — No reference (R2).** Up to three products ranked by recency in the shop's posts and token
  overlap with the message; sent as reply buttons; the tap sets the context and answers.
- **D5 — Out of stock (R5, Q3).** "Tell me when it's back" stores a `BackInStockRequest(orgId,
  productId, personKey, platform, consentEvidence)` in audience (a one-message consent); demand-alerts
  reads it.
- **D6 — Daily count (R7).** Each answer writes an `AutoAnswer(orgId, day, kind, conversationId,
  outcome)` row; the Inbox strip is a grouped count over yesterday by index `(orgId, day)`.

## Packages
None.

## UI approach
The answer bubble and which-one buttons render through the platform; the shop's UI is the Inbox's
daily strip (server-rendered, links to filtered lists) and the switch in Auto-replies.

## Gates touched
None new beyond automations' routes.

## Data model
[MIGRATION] conversation `productContext` (inbox, through its repository); `AutoAnswer`;
`BackInStockRequest` (audience).

## API / contract changes
[CONTRACT] `inboxService.setProductContext`; audience's `recordBackInStockRequest`.

## Test plan
- Reference resolution per source; intent table (unit).
- Answer prices from the resolver with an offer; auction hold says not for sale (A1, A3).
- No reference → three buttons (A4); Buy opens checkout with size (A2).
- Daily strip counts (A5).

## Delivery
1. Reference, intent, answer (behaviour).
2. Which-one, back-in-stock request, counts.
3. Strip and switch (UI).

## Open questions
None.
