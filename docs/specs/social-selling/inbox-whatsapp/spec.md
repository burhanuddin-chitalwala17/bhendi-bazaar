# Spec — social-selling/inbox-whatsapp

- **Summary:** A connected WhatsApp number's chats arrive in the WhatsApp tab of the shop's Inbox and are answered from it, free within 24 hours and by a paid template after, with the cost shown first; a cart a buyer sends from the catalogue arrives as an order the shop turns into a checkout link
- **Status:** Draft
- **Domain:** channels
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-22
- **References:** [decisions.md](decisions.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md) (Q7, Q8, Q12, Q34, Q37, Q96, Q97), [inbox-core](../inbox-core/spec.md), [connect-whatsapp](../connect-whatsapp/spec.md), [whatsapp-sending](../whatsapp-sending/spec.md), [consent-core](../consent-core/spec.md), [checkout-links](../../checkout-links/spec.md)

> Requirements and product approach only. Technical approach lives in trd.md. Module: Converse.
> The WhatsApp plug for inbox-core; stands on connect-whatsapp, whatsapp-sending, consent-core and
> checkout-links, all built before it in step 5.

## What this feature is
The WhatsApp tab. Every chat to the shop's number arrives here and is answered from here, and
keeps appearing in the shop's Business app too. A cart the buyer sends from the catalogue becomes
an order card with one action: send the buyer a checkout link.

## Why
WhatsApp is where Indian buyers ask and order. The shop should answer from where its products,
prices and orders are, never lose a chat in a busy phone, and turn a sent cart into a paid order
in one tap (parent Q97).

## Requirements
- R1 — A WhatsApp message to the number appears as a conversation, showing the person's WhatsApp
  name and their number when Meta gives it, otherwise their username (parent Q96, Q9).
- R2 — A member replies; it reaches the buyer from the shop's number and also appears in the
  Business app. Replies sent from the Business app appear in the thread, marked as from the app.
- R3 — Within 24 hours of the buyer's last message a reply is free and free-form; after that only an
  approved template, from whatsapp-sending, with its cost shown before Send and counted against the
  spend cap (parent Q8, Q37).
- R4 — The shop's own messages show Sent, Delivered, Read or Failed (Q1).
- R5 — A cart the buyer sends from the catalogue arrives as an order card: each item with our live
  price (never the cart's), what is in stock, and the total we would charge. One action, Send
  checkout link, sends the buyer a link that opens checkout holding those items; payment and stock
  move only at checkout (parent Q97).
- R6 — Voice notes play in the thread; photos, documents and locations show as what they are; a photo or document can
  be opened, downloaded through us (Q1).
- R7 — A buyer's YES, STOP or HINDI is understood by consent-core, whose confirming reply appears in
  the thread.
- R8 — A send refused for a missing payment method, the spend cap or the buyer's consent says which,
  in plain words, with what to do (parent Q8).
- R9 — If Meta misses telling us about a message, it is found on the next re-check and shown once
  (parent Q7).
- R10 — A disconnected or offboarded number keeps its conversations readable and asks to reconnect;
  the 90-day clock starts at disconnect (parent Q34).

## Hazards the TRD must answer
- **A message typed in the Business app and one sent from the inbox** crossing, so the thread order lies.
- **A cart whose items sold out or changed price** since the buyer built it.
- **Media links from Meta that expire** within minutes.

## Product acceptance
Judged on a phone (~360px) first.
- A1 — A message sent to the owner's number appears in the WhatsApp tab and in the Business app.
- A2 — A reply from the inbox reaches the buyer and shows in the Business app; it shows Delivered, then Read.
- A3 — After 24 hours the reply box offers templates with their costs; sending one counts against the cap.
- A4 — A cart of three items arrives as an order card at our prices; Send checkout link sends a
  link that opens checkout with those three items.
- A5 — A cart item that is out of stock shows so on the card and is left out of the link.
- A6 — A send blocked by the spend cap says so and how to raise it.

## Scope
- **Outcome:** a shop answers WhatsApp chats from its inbox and turns a sent cart into a checkout.
- **In:** R1–R10, tested by A1–A6.
- **Later:** chat history on connect (parent Q12); group chats (Meta does not deliver them).

## Open questions
None.
