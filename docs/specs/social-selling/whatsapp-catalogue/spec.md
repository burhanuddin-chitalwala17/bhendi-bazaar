# Spec — social-selling/whatsapp-catalogue

- **Summary:** A shop's WhatsApp catalogue is an exact copy of its live products on Bhendi Bazaar, at the price its product page shows, kept in step within minutes with nobody doing anything, its cart turned on
- **Status:** Draft
- **Domain:** channels
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-22
- **References:** [decisions.md](decisions.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md) (Q47, Q97, Q102), [whatsapp-catalogue-import](../whatsapp-catalogue-import/spec.md), [shopfront-feeds](../../shopfront-feeds/spec.md), [ADR-0018](../../../adr/0018-one-effective-price-function.md), [ADR-0023](../../../adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md), [ADR-0043](../../../adr/0043-a-variant-is-a-product-in-a-family.md), [ADR-0077](../../../adr/0077-the-pixel-promise-belongs-to-the-backdrop-tools-and-an-ai-picture-is-labelled-and-secondary.md)

> Requirements and product approach only. Technical approach lives in trd.md. Module: Catalogue.
> Starts when whatsapp-catalogue-import is done, or at connect when there was nothing to settle.

## What this feature is
The shop's products in its WhatsApp catalogue: the shop icon in its chats, and the items buyers
browse, add to a cart and send. Bhendi Bazaar keeps it a copy of the store; the shop never edits it.

## Why
A catalogue typed by hand in the Business app is wrong within a week. Bhendi Bazaar already knows
each product's live price, stock and photos, so the catalogue should simply be the shop's products,
true whenever a buyer opens it (parent Q47).

## Requirements
- R1 — Every product live on the shop's store page is in its catalogue, with nothing to pick
  (parent Q47). A product WhatsApp would refuse (no photo or description) is left out and counted,
  with why.
- R2 — Each item shows the price the product page shows at that moment, offer included, with the
  list price beside it while an offer runs (parent Q47).
- R3 — Out of stock, or held by a live auction, shows as out of stock, the buy button's own answer;
  an archived product is removed (Q4).
- R4 — A change to price, offer, stock, photos, name or archive reaches WhatsApp within 15 minutes
  with nobody acting, including an offer that starts or ends on its own (Q4).
- R5 — A full re-send every night repairs anything missed and keeps it a copy: an item that is not
  one of the shop's live products is removed, and a field changed outside Bhendi Bazaar is put back
  (Q4).
- R6 — The cart is on. A cart a buyer sends reaches the WhatsApp inbox as an order card priced by
  us, and the buyer pays on our checkout (parent Q97).
- R7 — An item opens our product page; a family's members show as one item with options (Q12).
- R8 — A picture marked AI-made is never an item's main image; it may follow a real photograph
  (ADR-0077). A product with only AI-made pictures is left out, with why.
- R9 — The WhatsApp card says how many products are in the catalogue, when it last updated, how
  many were left out and why, and offers Sync now (Q8).
- R10 — An item Meta refuses is listed with Meta's reason and a link to fix the product; the rest
  stay live (Q8). Left-out and refused products can be fixed many at a time, through bulk-publish's
  fix flow (parent Q102).
- R11 — Disconnecting stops updates and leaves the catalogue in the shop's account; the dialog says
  so. Reconnecting the same number resumes the same catalogue (Q10).

## Hazards the TRD must answer
- **A price that differs from the page:** computing it a second way, or caching it.
- **A flood of changes** (a bulk upload, an offer starting on 500 products) against Meta's limits.
- **A missed change:** a job lost, or Meta down for an hour.
- **Two updates racing** for one item, the older one landing last.

## Product acceptance
Judged on a phone (~360px) first.
- A1 — Minutes after connecting (or settling), every live product with a photo and description is
  in the WhatsApp app at its product page's price.
- A2 — A price change, an offer starting, the last unit sold and an archive each show in WhatsApp
  within 15 minutes.
- A3 — An item held by a live auction shows out of stock.
- A4 — An item added in the Business app is gone, and a price edited there is back, after the
  nightly send.
- A5 — A product with only an AI-made picture is left out and counted on the card with why.
- A6 — A refused item shows Meta's reason and a link to fix it; the others stay live.
- A7 — Disconnect stops updates and leaves the catalogue in the shop's account.

## Scope
- **Outcome:** the shop's live products in its WhatsApp catalogue, an exact copy kept in step.
- **In:** R1–R11, tested by A1–A7.
- **Later:** a per-product opt-out; paying inside WhatsApp (parent Q21).

## Open questions
None.
