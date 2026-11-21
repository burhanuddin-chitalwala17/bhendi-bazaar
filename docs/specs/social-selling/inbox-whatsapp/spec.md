# Spec — social-selling/inbox-whatsapp

- **Summary:** A connected WhatsApp number's chats arrive in the shop's Inbox and are answered from it, free within 24 hours and by a paid template after, with the cost shown first
- **Status:** Draft
- **Domain:** channels (the WhatsApp plug for inbox)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [decisions.md](decisions.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md), [inbox-core](../inbox-core/spec.md), [connect-whatsapp](../connect-whatsapp/spec.md), [whatsapp-templates](../whatsapp-templates/spec.md), [INTEGRATIONS.md](../../../INTEGRATIONS.md#acting-for-a-shop-on-meta-catalogue-whatsapp-instagram)

> Requirements and product approach only. Technical approach lives in trd.md. Subfeature 10 of
> social-selling; needs connect-whatsapp and inbox-core. Behind the single review (parent Q2).

## What this feature is
The WhatsApp tab of the Inbox comes alive. A buyer's WhatsApp message to the shop's number appears
within seconds; any member answers it, and the answer reaches the buyer from the shop's own number.
The shop keeps its WhatsApp Business app; messages show in both.

## Why
Most of a small Indian shop's selling happens in WhatsApp chats, on one owner's phone. When that
phone is busy, buyers wait. Putting the chats in the shared inbox lets anyone in the shop answer,
beside the product and its live stock, without giving up the app.

## Requirements
- R1 — A WhatsApp message to the connected number appears as a conversation in the WhatsApp tab,
  from the day of connecting (Q1, parent Q12).
- R2 — A member replies; the reply reaches the buyer from the shop's number and also appears in the
  shop's Business app (parent Q12, parent Q12).
- R3 — Replies the shop sends from the Business app appear in the thread, marked as from the app.
- R4 — Within 24 hours of the buyer's last message the reply is free and free-form; after that the
  reply box offers the shop's approved templates, each with its cost, never disabled (parent Q37, parent Q37).
- R5 — A template sent from the inbox is paid by the shop's WhatsApp account; its cost is shown
  before Send and recorded with who sent it, in paise (parent Q8, parent Q8). It counts against the
  shop's monthly WhatsApp spend cap; past the cap it is refused with the reason and a way to raise
  the cap, and it is recorded as an inbox reply (parent Q8, parent Q8).
- R6 — The shop's messages show Sent, Delivered, Read or Failed (Q1).
- R7 — A refused send says why in plain words and what to do, including a missing payment method (parent Q8).
- R8 — An event Meta sends twice appears once; events for a number no shop has connected are ignored.
- R9 — A disconnected or removed connection keeps the history readable and asks to reconnect;
  retention follows parent Q34.
- R10 — Nothing from Meta (a payload, a token, an error body) reaches a log or a person.

## Hazards the TRD must answer
- **A forged webhook** injecting chats: the signature must be checked.
- **Statuses arriving before the message they describe**, or out of order: Read never goes back to
  Delivered.
- **A template sent when the window has just reopened** costs money needlessly: the window is read at
  send time, not page load.
- **Charging the wrong amount on screen**: the cost shown comes from one rates table (whatsapp-templates).
- **A coexistence echo duplicating** a message sent from the inbox.

## Product acceptance
Judged on a phone (~360px) first. Verified on the owner's own number (parent Q2).
- A1 — A WhatsApp message to the owner's connected number appears in the WhatsApp tab within a
  minute; a reply from the inbox arrives on the buyer's phone and shows in the Business app.
- A2 — A reply typed in the Business app appears in the inbox thread as from the app, once.
- A3 — A thread older than 24 hours offers templates with their cost; sending one records the cost
  and the member.
- A4 — Ticks move Sent → Delivered → Read and never back.
- A5 — A webhook with a bad signature changes nothing; a replayed one adds nothing.
- A6 — Every state in ux.md's matrices can be reached and reads as written.

## Scope
- **Outcome:** a shop answers its WhatsApp chats from its inbox.
- **In:** R1–R10, A1–A6.
- **Later:** chat history on connect (parent Q12). Contacts and opt-in words are whatsapp-contacts;
  campaigns are whatsapp-campaigns.

## Open questions
None.
