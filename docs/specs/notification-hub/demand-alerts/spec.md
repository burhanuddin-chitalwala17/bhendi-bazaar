# Spec — notification-hub/demand-alerts

- **Summary:** A shop turns on alerts for price drops, items back in stock, carts left behind and auctions, and each reaches the opted-in buyers who showed interest, once, by WhatsApp or email, inside the shop's hours, caps and budget
- **Status:** Draft
- **Domain:** notifications
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-22
- **References:** [decisions.md](decisions.md), parent [notification-hub](../spec.md) and its [decisions](../decisions.md) (Q1, Q6), [hub-marketing](../hub-marketing/spec.md), [social-selling](../../social-selling/spec.md) (Q8, Q9, Q40, Q54), [product-answers](../../social-selling/product-answers/spec.md)

> Requirements and product approach only. Technical approach lives in trd.md. Built in
> social-selling's step 7.

## What this feature is
Four alerts on the shop's notification settings, in Shop details, each off until turned on: price
drop, back in stock, abandoned cart, and auction (outbid, ending soon). Each reaches only buyers who
opted in and showed interest in that product.

## Why
A buyer who wishlisted an item, left it in a cart or bid on it already wants it. Telling them when
it gets cheaper, comes back or is about to go is the most welcome message a shop can send, and the
cheapest to win a sale with (social-selling Q54).

## Requirements
- R1 — Each alert is off until the shop turns it on; turning it on shows its estimated monthly cost
  (social-selling Q8).
- R2 — Price drop: any fall in a product's effective price, offers included, alerts its opted-in
  wishlisters, at most once a day per product per buyer (social-selling Q54, Q8 here).
- R3 — Back in stock: a product returning to stock alerts its opted-in wishlisters, and buyers who
  asked "Tell me when it's back" in a chat, once per restock (product-answers Q3).
- R4 — Abandoned cart: an opted-in signed-in buyer whose cart is left an hour gets one message,
  never if they ordered meanwhile (social-selling Q54).
- R5 — Auction: opted-in bidders hear when they are outbid and when the auction ends in an hour; who
  hears is a rule that can widen to all opted-in followers later (Q6). A bidder keeps today's
  outbid email whatever their marketing consent (parent Q6).
- R6 — Each alert goes once, by WhatsApp or email under hub-marketing's rules, only inside the
  shop's hours (social-selling Q112); outside them it waits, except an "ending in an hour" alert,
  which is dropped (Q7).
- R7 — An alert is true when it arrives: re-checked before sending, skipped with why if the price
  rose back, the item sold out, the auction closed or the cart was ordered (Q7).
- R8 — At the shop's monthly spending limit, WhatsApp alerts stop for the month and fall to email
  where the buyer opted in; the shop is told once (Q7).

## Hazards the TRD must answer
- **A flash sale on 500 products** alerting each wishlister once, not 500 times.
- **An offer starting on the clock** with no edit to trigger the price-drop alert.

## Product acceptance
- A1 — A wishlisted product dropping from ₹1,499 to ₹1,199 alerts its opted-in wishlisters once.
- A2 — A product back in stock alerts its wishlisters and the buyer who asked in a chat.
- A3 — A cart left an hour gets one message; ordering in that hour cancels it.
- A4 — An outbid bidder hears at once inside the window; an "ending in an hour" at 11pm is dropped.
- A5 — An alert whose price rose back before sending is skipped and recorded.

## Scope
- **Outcome:** a shop's interested buyers hear about what they wanted, within its rules.
- **In:** R1–R8, tested by A1–A5.
- **Later:** "Notify me" on product pages (social-selling Q54); auctions widened to followers (Q6).

## Open questions
None.
