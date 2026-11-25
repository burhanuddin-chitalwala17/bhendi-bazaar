# TRD — notification-hub/order-updates

- **Status:** Accepted
- **Domain:** notifications, with checkout (order events) and campaigns (utility template sends)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-23
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), [notifications-core TRD](../notifications-core/trd.md), [whatsapp-sending TRD](../../social-selling/whatsapp-sending/trd.md), the shipped order and parcel emails (`server/notifications/templates/`)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
Order confirmed, shipped and delivered become hub events emitted by checkout and fulfilment in
their existing transactions. With the shop's switch on and the buyer opted in on WhatsApp, the
WhatsApp plug sends the starter utility template; if it is not delivered within 15 minutes, email
follows. The receipt is always email.

## Prior art
- **Utility-first fallback with a delivery timeout** (Twilio's and Gupshup's "send WhatsApp, fall
  back to SMS on no delivery receipt"): followed with email as the fallback.

## Technical decisions
- **D1 — Events (R2, R4, R6, Q4).** Checkout emits `order.confirmed` (and the receipt as a
  transactional email-only kind), fulfilment `order.shipped` and `order.delivered`, all inside the
  transactions that change the order. Every existing notice kind is emitted through the hub with its
  templates unchanged (notifications-core D6).
- **D2 — Switch (R1, Q5).** `MessagingSettings.orderUpdatesOnWhatsApp`; the card's counts are the
  month's sends and settled cost for utility sends with source `ORDER_UPDATE`.
- **D3 — Send and fallback (R3, R5).** With the switch on: `deliverByWhatsApp` (purpose UTILITY,
  exempt from how-often, counted in spend) and a check job `notify.wa-fallback(deliveryId)` with
  `startAfter` 15 minutes; if the send is not `DELIVERED` by then (or was skipped/held), the email
  delivery is created. A delivery that settles later does not unsend the email; a buyer may get both,
  which the spec accepts.
- **D4 — Off or not opted in.** Email only, as today.

## Packages
None.

## UI approach
ux.md's card on the Notifications page; WhatsApp templates are whatsapp-sending's starters. Words in
`notifications-copy.ts`.

## Gates touched
Route switch.

## Data model
`MessagingSettings.orderUpdatesOnWhatsApp`.

## API / contract changes
[CONTRACT] Order event kinds.

## Test plan
- Switch on, opted in: three WhatsApp updates and the receipt by email (A1); not opted in → email
  (A2); undelivered in 15 minutes → email follows (A3).
- Every order email word for word (A4).

## Delivery
1. **after notifications-core U2 (notice kinds already emit through the hub)** — Events from checkout and fulfilment through the hub (behaviour unchanged).
2. **after U1, hub-marketing U1 (the `whatsapp` plug), whatsapp-sending U3 (utility starters; `MessagingSettings` from U1) and notifications-core U3 (the Notifications page the card sits on)** — WhatsApp plug for utility, fallback, card.

## Open questions
None.
