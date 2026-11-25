# TRD — notification-hub/demand-alerts

- **Status:** Accepted
- **Domain:** notifications, with catalog, promotions, wishlist, cart, bidding (events) and audience
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-23
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), [hub-marketing TRD](../hub-marketing/trd.md), [ADR-0018](../../../adr/0018-one-effective-price-function.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
Four alert kinds, each a hub MARKETING event emitted by the domain where the fact changes, fanned
out to an audience rule, re-checked at send, waiting for the shop's hours, and delivered through
hub-marketing. Fan-out is a paged job, not a loop in the emitter's transaction.

## Prior art
- **Trigger-then-recheck** (Shopify Flow's back-in-stock apps, Klaviyo price-drop flows): the
  trigger queues, the send re-reads the fact. Followed (R7).

## Technical decisions
- **D1 — Triggers (R2–R5).** Promotions and catalog emit `product.price-dropped(productId, from, to)`
  when the effective price (ADR-0018) falls; catalog's stock commands emit `product.restocked` on a
  0 → positive transition; cart emits `cart.left(cartId)` via a `startAfter` 1-hour job created on
  the last change (reset on each change); bidding emits `auction.outbid` and `auction.ending-soon`.
  Each is a shared job spec, so emitters import nothing.
- **D2 — Audience rules (Q6).** `AUDIENCE_RULE` closed set: `wishlisters(productId)`,
  `askedBackInStock(productId)` (product-answers' requests), `cartOwner(cartId)`,
  `bidders(auctionId)`; later `followers`. Fan-out pages 500 recipients into deliveries.
- **D3 — Re-check and hours (R6, R7, Q7, Q8).** At send: price still dropped, still in stock, cart not
  ordered, auction open; per-product per-buyer guard (price drop once a day, `AlertGuard` unique per
  (kind, productId, contactId, day)); outside shop hours the delivery's `startAfter` is the next
  opening, except ending-soon, which is dropped.
- **D4 — Switches and estimates (R1).** Per alert in `MessagingSettings.alerts`; the estimate is
  audience size × last 30 days' trigger rate × rate, shown "about".
- **D5 — Outbid email stays (R5, parent Q6).** A bidder with no marketing consent still gets the
  outbid email as a transactional kind.
- **D6 — At the spending limit (R8).** WhatsApp held → email where opted in (hub-marketing D1).

## Packages
None.

## UI approach
ux.md's Alerts to buyers rows and activity sheet on the Notifications page. Words in
`notifications-copy.ts`.

## Gates touched
Shared job specs for each trigger; routes switches, activity.

## Data model
[MIGRATION] `AlertGuard`; `MessagingSettings.alerts`.

## API / contract changes
[CONTRACT] Trigger job specs.

## Test plan
- Price drop alerts wishlisters once (A1); restock alerts wishlisters and askers (A2).
- Cart left an hour, ordering cancels (A3); outbid inside hours, ending-soon at 11 pm dropped (A4).
- Price rose back before send → skipped and recorded (A5).

## Delivery
1. **after notifications-core U1 and product-answers U2 (`BackInStockRequest` for `askedBackInStock`)** — Triggers and audience rules (behaviour).
2. **after U1, hub-marketing U1 (delivery and fallback), whatsapp-sending U1 (`hoursFor`, `MessagingSettings`) and notifications-core U3 (the Notifications page)** — Re-check, guards, hours; switches and activity UI.

## Open questions
None.
