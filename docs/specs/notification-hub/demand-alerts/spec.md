# Spec — notification-hub/demand-alerts

- **Summary:** A shop turns on price-drop, back-in-stock, abandoned-cart and auction alerts; each reaches opted-in buyers once, by WhatsApp else email, inside the shop's window, caps and monthly spend
- **Status:** Draft
- **Domain:** notifications
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [decisions.md](decisions.md), [ux.md](ux.md), [trd.md](trd.md), parent [notification-hub](../spec.md), [hub-core](../hub-core/spec.md), [social-selling decisions](../../social-selling/decisions.md), [bidding](../../bidding/), [checkout-abandonment](../../checkout-abandonment/spec.md), [ADR-0018](../../../adr/0018-one-effective-price-function.md)

> Requirements and product approach only. Technical approach lives in trd.md. Subfeature 3 of
> notification-hub; needs hub-core, social-selling's audience and whatsapp-campaigns.

## What this feature is
Four switches on the shop's Notifications page — Price drop, Back in stock, Abandoned cart,
Auctions — each with its estimated monthly cost, plus the shop's daily sending window and monthly
WhatsApp spend cap. With a switch on, a buyer who asked for offers hears about the thing they
wanted, once, when it matters.

## Why
The buyers most likely to buy are the ones who already wished for a product, nearly checked out or
bid on it. Bhendi Bazaar knows all three; no outside WhatsApp tool does. The shop pays per message,
so each alert is the shop's choice, inside caps it sets.

## Requirements
- R1 — Each alert is off until the shop turns it on; turning it on shows its estimated monthly cost
  from the shop's own numbers (Q3).
- R2 — Price drop: any fall in a product's effective price, offers included, alerts its opted-in
  wishlisters, at most once a day per product per buyer (Q2, Q8).
- R3 — Back in stock: a product returning to stock alerts its opted-in wishlisters, once per
  restock (Q2, Q8).
- R4 — Abandoned cart: an opted-in signed-in buyer whose cart is left an hour gets one message,
  never if they ordered meanwhile (Q2).
- R5 — Auction: opted-in bidders hear when they are outbid and when the auction ends in an hour;
  who hears is a rule that can widen to all opted-in followers later (Q2, Q6).
- R6 — Each alert reaches a buyer once, by WhatsApp when it can, else by email when they opted in
  to email; inside the shop's global cap and WhatsApp's frequency cap (social-selling Q73, Q74).
- R7 — Alerts go only inside the shop's daily window, default 9am–9pm IST; outside it they wait,
  except "ending in an hour", which is dropped (Q5).
- R8 — A monthly WhatsApp spend cap, set by the shop in rupees; at the cap WhatsApp alerts stop
  for the month, fall to email where allowed, and the shop is told once (Q4).
- R9 — An alert is true when it arrives: re-checked before sending, else skipped with why (Q7).
- R10 — A bidder still gets the outbid email they get today, whatever their marketing consent (Q9).

## Hazards the TRD must answer
- **A price edited in a burst** (down, up, down) alerting several times. R2's daily limit, D-level.
- **A restock of one unit** alerting fifty wishlisters for one item; first to buy wins, fine, but
  the message must not promise it is held.
- **Spend cap raced by a burst** of alerts; the cap is advice by one message (ADR-0069 pattern).
- **Abandoned cart for a guest** — no phone, no consent; never sent.
- **Price from anywhere but the one resolver** (ADR-0018) showing a wrong "now ₹X".

## Product acceptance
Judged on a phone (~360px) first.
- A1 — Price-drop on, a wishlisted product's offer starts: its opted-in wishlisters get one message
  with the new price; a second edit that day sends nothing more.
- A2 — Back-in-stock on, a sold-out wishlisted product is restocked: one message each.
- A3 — Abandoned-cart on: a signed-in opted-in buyer leaves a cart; one message after an hour; a
  buyer who ordered within the hour gets none.
- A4 — Auctions on: an outbid opted-in bidder gets "You've been outbid"; at an hour to go, "Ends in
  1 hour" — or nothing if that falls outside the window.
- A5 — At the spend cap, the next alert goes by email to an email-opted buyer, none by WhatsApp,
  and the shop is told once.
- A6 — With every switch off, nothing is sent and nothing is charged (except the outbid email, R10).
- A7 — A 10pm price drop is delivered at 9am, still at the dropped price, or skipped if it rose back.

## Scope
- **Outcome:** a shop's opted-in buyers hear about what they wanted, within the shop's caps.
- **In:** R1–R10, tested by A1–A7.
- **Later:** "Notify me" (its own vertical); auction audience widened to followers (Q6).

## Open questions
None.
