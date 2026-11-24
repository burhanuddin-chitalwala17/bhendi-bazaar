# Spec — checkout-links

- **Summary:** A link that opens checkout holding chosen products and sizes, priced and stock-checked at the moment it is opened, so a chat or a message can turn into an order in one tap
- **Status:** Accepted
- **Domain:** cart, with checkout
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-22
- **References:** [decisions.md](decisions.md), [social-selling](../social-selling/spec.md) (Q97, Q108), [inbox-whatsapp](../social-selling/inbox-whatsapp/spec.md), [product-answers](../social-selling/product-answers/spec.md), [ADR-0002](../../adr/0002-server-holds-pricing-authority.md), [ADR-0063](../../adr/0063-every-public-route-is-classified-for-rate-limiting-in-one-registry.md)

> Requirements and product approach only. Technical approach lives in trd.md. A sibling of
> social-selling (Q108), built in its step 5 before inbox-whatsapp. New; the cart's sign-in merge
> and read-after-mount rules stay exactly as they are.

## What this feature is
A link, made for one buyer, that opens checkout with given products and quantities. The WhatsApp
inbox sends one for a cart a buyer sent; an automatic product answer carries one as its Buy button.

## Why
A buyer in a chat who must find the product again, pick the size and add it to a cart often does
not. A link straight to checkout with the right items is one tap from question to payment, while
price and stock stay the store's own (Invariant 1).

## Requirements
- R1 — A link carries only products (a size being its own product) and quantities, never a price;
  checkout prices everything when it opens, as it always does (ADR-0002).
- R2 — A link cannot be altered: one that has been changed opens nothing but the shop's page (Q1).
- R3 — Opening it adds its items to the buyer's cart and shows checkout; opening it again adds
  nothing more. Checkout marks the items that came from the link and shows anything already in the
  cart, each removable, so nothing is paid for unseen (Q2).
- R4 — An item out of stock when the link is opened is shown as such and left out; a price that
  changed since the link was sent shows the current price, plainly.
- R5 — A link expires after a set time; an expired one opens the products' pages with a line saying
  the link has expired (Q1).
- R6 — Guests and signed-in buyers check out exactly as they do today.
- R7 — Each link records where it came from (an inbox order, an automatic answer, a campaign) and
  which order it became, so sales per message can be reported later (Q3, social-selling Q108).
- R8 — The route that opens links is classified for rate limiting (ADR-0063).

## Hazards the TRD must answer
- **A forwarded link** opened by someone else: it opens checkout for whoever holds it, which is
  harmless since they pay; nothing personal is in it.
- **The same link opened twice,** before or after the first became an order, adding its items twice.
- **The cart's read-after-mount and sign-in merge rules** holding when a link adds items.

## Product acceptance
Judged on a phone (~360px) first.
- A1 — A link for a kurta in L and a dupatta opens checkout with those two, at today's prices.
- A2 — With a dupatta now out of stock, the link opens with the kurta and says the dupatta is gone.
- A3 — A buyer with a scarf already in the cart opens a link for a kurta: checkout shows the kurta
  marked as from the link and the scarf as already in the cart, removable; opening the link again
  does not add a second kurta.
- A4 — An edited link opens the shop's page; an expired one opens the products with the expired line.

## Scope
- **Outcome:** a chat or message turns into an order in one tap, at the store's own prices.
- **In:** R1–R8, tested by A1–A4.
- **Later:** reporting sales per message (social-selling Q108).

## Open questions
None.
