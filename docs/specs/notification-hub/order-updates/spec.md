# Spec — notification-hub/order-updates

- **Summary:** A buyer hears their order was confirmed, shipped and delivered on WhatsApp when the shop turns it on and the buyer opted in, by email otherwise, the receipt always by email; every existing order and parcel email goes through the hub
- **Status:** Draft
- **Domain:** notifications
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-22
- **References:** [decisions.md](decisions.md), parent [notification-hub](../spec.md) and its [decisions](../decisions.md) (Q1, Q3), [hub-marketing](../hub-marketing/spec.md), [whatsapp-sending](../../social-selling/whatsapp-sending/spec.md), [social-selling](../../social-selling/spec.md) (Q37, Q40, Q61)

> Requirements and product approach only. Technical approach lives in trd.md. Built in
> social-selling's step 7.

## What this feature is
A switch on the shop's notification settings, in Shop details: "Order updates on WhatsApp". With
it on, buyers who opted in hear about their order on WhatsApp; everyone else, and every receipt,
still by email.

## Why
Indian buyers look for order news on WhatsApp, not in email (social-selling Q61). Each message
costs the shop, so it is the shop's choice, made knowing the cost; the receipt must never depend
on WhatsApp.

## Requirements
- R1 — Off until the shop turns it on; the card shows the cost per message, billed by Meta, and this
  month's count and cost; before WhatsApp is connected it says so and links to connecting (Q5).
- R2 — With it on, a buyer opted in to WhatsApp from that shop gets order confirmed, shipped (with
  tracking) and delivered, as the starter utility template in their language (social-selling Q61, Q37).
- R3 — If WhatsApp cannot reach the buyer, or a message is not delivered within 15 minutes, the
  same update goes by email (social-selling Q61).
- R4 — The order receipt always goes by email, whatever the switch (social-selling Q61).
- R5 — Order updates never count against the global cap or WhatsApp's frequency cap; they do count
  toward the shop's spend (social-selling Q40).
- R6 — Every existing order and parcel email, for shops, admins and buyers, is sent through the hub
  with its words unchanged; cancellations and refunds stay on email (Q4).

## Hazards the TRD must answer
- **A WhatsApp update delivered at minute 16:** the email already gone, so the buyer hears twice.
- **Moving today's emails** onto the hub with none lost in the switch.

## Product acceptance
- A1 — With the switch on, an opted-in buyer's order sends confirmed, shipped and delivered on
  WhatsApp, and the receipt by email.
- A2 — A buyer not opted in gets every update by email.
- A3 — A WhatsApp update not delivered in 15 minutes is followed by the email.
- A4 — Every order email sent today still arrives, word for word.

## Scope
- **Outcome:** order news reaches buyers where they look, at the shop's choice and cost.
- **In:** R1–R6, tested by A1–A4.
- **Later:** cancellations and refunds on WhatsApp.

## Open questions
None.
