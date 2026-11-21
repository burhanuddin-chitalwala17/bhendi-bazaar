# Spec — notification-hub/order-updates

- **Summary:** A buyer hears their order was confirmed, shipped and delivered on WhatsApp when the shop turns it on, with email as the fallback and the receipt always by email; every order email goes through the hub
- **Status:** Draft
- **Domain:** notifications
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [decisions.md](decisions.md), [ux.md](ux.md), [trd.md](trd.md), parent [notification-hub](../spec.md), [hub-core](../hub-core/spec.md), [social-selling decisions](../../social-selling/decisions.md), [order-fulfilment trd](../../own-store/order-fulfilment/trd.md)

> Requirements and product approach only. Technical approach lives in trd.md. Subfeature 2 of
> notification-hub; needs hub-core and social-selling's whatsapp-campaigns send port for WhatsApp.

## What this feature is
A switch on the shop's Notifications page: "Order updates on WhatsApp". With it on, a buyer who
opted in hears three moments of their order on WhatsApp. With it off, or when WhatsApp cannot reach
them, email does it as today. Every order and parcel email moves onto the hub, unchanged in words.

## Why
Buyers in India read WhatsApp, not email; "Shipped" on WhatsApp cuts "where is my order" questions.
The shop pays Meta per message, so it chooses. Moving every order email onto the hub makes one path
per event, so a later channel reaches every order message at once.

## Requirements
- R1 — Off until the shop turns it on; the switch shows the cost per message and this month's count
  and cost (social-selling Q61, Q5).
- R2 — With it on, a buyer opted in to WhatsApp gets order confirmed, shipped (with tracking) and
  delivered on WhatsApp, in their language (social-selling Q61).
- R3 — If WhatsApp cannot reach the buyer, or a message is not delivered within 15 minutes, the same
  update goes by email. A buyer never gets both for one update (social-selling Q61).
- R4 — The order receipt always goes by email, whatever the switch (social-selling Q61, Q4).
- R5 — Order updates never count against the global cap or WhatsApp's frequency cap (social-selling Q40).
- R6 — Every existing parcel and order email (shop, admin and buyer) is sent through the hub with
  the same words, once, exactly as today (Q4).
- R7 — With WhatsApp not connected, the card explains and links to connecting it; it is never a
  disabled switch (Q5).

## Hazards the TRD must answer
- **The move changes a working path.** Parcel notices today are rows unique per (parcel, kind,
  audience); the hub's row must keep that uniqueness so the move sends no duplicate and drops none.
- **The 15-minute fallback firing after WhatsApp delivered late**, sending both.
- **A buyer's opt-in withdrawn (STOP) between emit and send.**
- **Cost shown in floats.** Integer paise only (Invariant 3).

## Product acceptance
Judged on a phone (~360px) first.
- A1 — Switch off: a shipped parcel sends the shipped email, as today; no WhatsApp.
- A2 — Switch on, buyer opted in: "Shipped" arrives on WhatsApp with tracking; no email.
- A3 — Switch on, WhatsApp not delivered in 15 minutes (fake channel): the shipped email arrives
  once; a late WhatsApp delivery afterwards sends nothing more.
- A4 — The receipt email arrives for every paid order, switch on or off.
- A5 — Every `NOTICE_KIND` sends the same email as before the move, once (regression suite).
- A6 — The card shows this month's WhatsApp order messages and their cost in rupees from paise.

## Scope
- **Outcome:** order updates reach the buyer on WhatsApp when the shop chooses, by email otherwise.
- **In:** R1–R7, tested by A1–A6.
- **Later:** cancelled and refunded on WhatsApp (decisions Parked).

## Open questions
None.
