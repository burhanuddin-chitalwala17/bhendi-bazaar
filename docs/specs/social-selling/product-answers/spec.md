# Spec — social-selling/product-answers

- **Summary:** A buyer asking about a product on Instagram or WhatsApp is answered at once from that product's live price, offer, stock and sizes, with a link to buy it, and the shop sees how many such enquiries came in and how many still need it
- **Status:** Accepted
- **Domain:** automations
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-22
- **References:** [decisions.md](decisions.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md) (Q7, Q47, Q89), [enquiry-autoreplies](../enquiry-autoreplies/spec.md), [inbox-core](../inbox-core/spec.md), [checkout-links](../../checkout-links/spec.md), [ADR-0018](../../../adr/0018-one-effective-price-function.md), [ADR-0023](../../../adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md)

> Requirements and product approach only. Technical approach lives in trd.md. Module: Converse.
> Runs inside enquiry-autoreplies' switch and pause; platform-free.

## What this feature is
When a buyer asks "price?", "available in L?" or "is this in stock?" about a product, the answer
comes back in seconds with the real price, the sizes in stock and a Buy button, read from the
product at that moment. A count on the inbox shows the shop every product enquiry and which still
need a person.

## Why
Most messages a shop gets are about one product. Answering them from live data, never from a typed
price list, is what turns a question into an order at midnight without risking a wrong price
(parent Q89).

## Requirements
- R1 — A buyer's message is tied to a product when it is a reply to the shop's story or a comment's
  DM thread for a post naming products, a shared post of the shop, a link to one of its product
  pages, or a catalogue item sent from WhatsApp (Q1).
- R2 — When a message names no product clearly, the buyer is offered up to three likely products
  (from the shop's recent posts and the words used) as buttons; nothing is guessed silently (Q1).
- R3 — The answer states, read at that moment: the price the product page shows (offer included,
  with the list price beside it), whether it is in stock or held by an auction, and the sizes or
  options in stock for its family (ADR-0018, ADR-0023).
- R4 — The answer carries a Buy button: a link that opens checkout with that product, or with the
  size the buyer chose, at the live price (Q2).
- R5 — Out of stock, the answer says so and offers to tell the buyer when it is back, the request
  kept for notification-hub's back-in-stock alert once that exists (Q3).
- R6 — Asking about something the product does not say (fabric, measurements beyond its facts) is
  handed to a person, as enquiry-autoreplies does.
- R7 — The inbox shows a daily count: product enquiries received, answered automatically, and still
  needing the shop, each opening the conversations behind it (parent Q89).
- R8 — Like every automatic reply, it pauses when a member is in the conversation and is marked
  Automatic in the thread.

## Hazards the TRD must answer
- **A price that changes** between the answer and the buyer tapping Buy: the link always prices at
  checkout, never from the message.
- **A story or post naming several products** when the buyer asked about one.
- **Sizes in a family** that differ in price or stock.

## Product acceptance
Judged on a phone (~360px) first.
- A1 — A buyer replying "price?" to the shop's story about one kurta gets its page price, offer and
  sizes in stock, with a Buy button, within seconds.
- A2 — Tapping Buy opens checkout with that kurta in the chosen size at the live price.
- A3 — A product on offer shows both prices; one held by an auction says it is not for sale now.
- A4 — "Price?" with no product in view offers three likely products as buttons.
- A5 — The inbox count shows yesterday's product enquiries and opens the ones still needing the shop.

## Scope
- **Outcome:** a product question is answered at once from live data, with a way to buy.
- **In:** R1–R8, tested by A1–A5.
- **Later:** AI wording over the same answers (parent Q89, step 8); sales per enquiry (parent Q108).

## Open questions
None.
