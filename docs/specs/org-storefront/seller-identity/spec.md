# Spec — seller-identity

- **Status:** Draft
- **Domain:** catalog
- **Phase:** 9 — Seller storefronts
- **Verified:** 2026-09-15
- **References:** [../spec.md](../spec.md) (programme), [../trd.md](../trd.md) D4/D5, [org-handle](../org-handle/), [storefront-discovery](../storefront-discovery/), [CONTRACTS.md](../../../CONTRACTS.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

The buyer finds out who they are buying from. A product says which organisation sells it, and that name is
a way through to everything else that organisation sells.

## Why

The marketplace currently hides its sellers completely. `OrgSummary` travels to the client on every product
and is read by nothing outside an admin form — a buyer cannot tell whether two items come from the same
shop, and a seller gets no credit for a good one.

That is a trust problem before it is a marketing one. Someone deciding whether to spend money wants to know
who is on the other end.

It is also **how storefronts actually get discovered.** A buyer looking at a product is already interested
in whoever sells it, so the seller's name on that page is the platform's own route into their shop — larger
than anything search will send for years, working from the day it ships, and needing no seller to have
shared anything. Every other channel in [storefront-discovery](../storefront-discovery/) is slower, smaller,
or depends on someone else acting first. That makes this the smallest slice of the programme with standalone
value *and* the one carrying the most traffic once the rest lands.

## Requirements

- **R1** — A product page names the organisation selling it.
- **R2** — The name links to that organisation's storefront, once one exists; until then it links to that organisation's goods.
- **R3** — A product card in a listing, a search result, a cart line and an order line can each say who the seller is.
- **R4** — A basket holding goods from several organisations makes that visible, so nobody is surprised by two parcels.
- **R5** — What a buyer learns about an organisation is its public identity only — never a commercial term, a tax identifier, or anything from its ledger.
- **R6** — An inactive organisation's goods do not become unreachable, but its name stops being a link to somewhere.

## Product acceptance

- **A1** — A buyer on a product page can name the seller without scrolling past the fold on a phone.
- **A2** — Tapping the seller's name reaches everything that seller sells.
- **A3** — A cart holding two organisations' goods shows which is which before checkout, not after the parcels arrive.
- **A4** — Nothing in any client payload carries a commission rate, a GST number or a PAN.

## Out of scope (this feature)

- The storefront itself — [storefront-pages](../storefront-pages/).
- Seller ratings, badges, response times or fulfilment statistics. There is no data behind any of them yet; `Review` rates a product.
- Messaging a seller.
