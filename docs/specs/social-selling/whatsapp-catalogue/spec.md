# Spec — social-selling/whatsapp-catalogue

- **Summary:** A shop that connects WhatsApp gets every live product in its WhatsApp catalogue at the price its product page shows, kept in sync with nobody doing anything
- **Status:** Draft
- **Domain:** channels
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [decisions.md](decisions.md), [ux.md](ux.md), [trd.md](trd.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md), [connect-whatsapp](../connect-whatsapp/), [shopfront-feeds](../../shopfront-feeds/spec.md), [ADR-0018](../../../adr/0018-one-effective-price-function.md), [ADR-0023](../../../adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md), [ADR-0043](../../../adr/0043-a-variant-is-a-product-in-a-family.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Requirements and product approach only. Technical approach lives in trd.md. Subfeature 9 of
> social-selling; it needs connect-whatsapp.

## What this feature is
The shop's products in its WhatsApp catalogue: the shop icon on its WhatsApp chat, and the items
it can share in a chat or a campaign. Made when WhatsApp is connected, kept true from then on.

## Why
Indian buyers browse and ask in WhatsApp. A shop's catalogue there is usually typed by hand in the
Business app and wrong within a week. Bhendi Bazaar knows the live price, stock and photos, so the
catalogue should simply be the shop's products, with nothing to maintain (parent Q47).

## Requirements
- R1 — Every product live on the shop's store page is in its WhatsApp catalogue; nothing to pick
  (parent Q47, parent Q47). A product WhatsApp would reject (no photo or description) is left out and
  counted, with why.
- R2 — Each item shows the price the product page shows at that moment, offer included, with the
  list price beside it when an offer is on (parent Q47).
- R3 — Out of stock, or held by a live auction, shows as out of stock; archived is removed (Q4).
- R4 — A change to price, stock, photos, name or archive reaches WhatsApp within 15 minutes, with
  nobody doing anything; a nightly full send repairs anything missed (Q4).
- R5 — Connecting WhatsApp makes the catalogue, connects it to the number and shows it in chats,
  with the cart on; a sent cart becomes an order card in the inbox, paid on our checkout (Q5).
- R6 — An item opens our product page; variants of one family show as one item with options
  (Q12).
- R7 — The WhatsApp card says how many products are in the catalogue, when it last updated, how
  many were left out and why, and offers Sync now (Q8).
- R8 — An item Meta refuses is listed with Meta's reason and a link to fix the product; the rest
  stay live (Q8).
- R9 — Disconnecting stops updates and leaves the catalogue in the shop's account; the dialog says
  how to delete it there. Reconnecting the same number resumes it (Q10).
- R10 — The Meta feed card (Facebook and Instagram) is unchanged and independent (Q5).
- R11 — The catalogue is a replica: an item that is not one of the shop's live products, or a field
  edited outside Bhendi Bazaar, is put back by the nightly full send (Q4).

## Hazards the TRD must answer
- **A price that differs from the page**: computing it a second way, or caching it.
- **A flood of changes** (a bulk upload, an offer starting on 500 products) against Meta's limits.
- **A missed change**: a job lost, or Meta down for an hour.
- **Two updates racing** for one item, the older one landing last.
- **An offer that starts or ends on the clock** with no write to trigger a send.

## Product acceptance
Judged on a phone (~360px) first ([ADR-0015](../../../adr/0015-mobile-first-design.md)).
- A1 — Minutes after connecting WhatsApp, every live product with a photo and description is in
  the shop's WhatsApp catalogue, seen in the WhatsApp app, at the product page's price (parent A3).
- A2 — A price change, an offer starting, a sale of the last unit, and an archive each show in
  WhatsApp within 15 minutes.
- A3 — An item held by a live auction shows out of stock.
- A4 — A product with no photo is absent and counted on the card with why.
- A5 — A refused item shows Meta's reason on the card; the others stay live.
- A6 — Sync now and the nightly send leave the catalogue identical to the store page, removing an
  item added in the Business app and undoing a price edited there.
- A7 — Disconnect stops updates; the catalogue remains in the shop's account.
- A8 — Every state in ux.md's matrix is reachable and reads as written.

## Scope
- **Outcome:** the shop's live products in its WhatsApp catalogue, kept in sync.
- **In:** R1–R11, tested by A1–A8.
- **Later:** a per-product opt-out; paying inside WhatsApp (parent Q21). Product messages
  in chats are whatsapp-campaigns'.

## Open questions
None.
