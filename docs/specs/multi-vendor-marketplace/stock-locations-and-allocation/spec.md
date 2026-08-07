# Spec — warehouses and stock allocation

- **Status:** Draft
- **Domain:** catalog, shipping, checkout
- **Phase:** 3 — Fulfilment
- **Verified:** 2026-08-08
- **References:** [trd.md](trd.md), [data-model.md](../data-model.md), [consumer-inventory.md](../consumer-inventory.md), [inventory-reservation](../../inventory-reservation/), [shipping-fulfilment](../../shipping-fulfilment/), [product-weight-and-rates](../../product-weight-and-rates/)

> Requirements and product approach only. Technical approach lives in [trd.md](trd.md).

## What this feature is
A selling organisation has named pickup locations with real addresses, each product's stock is known per location, and an order ships from wherever its stock actually is — splitting into more than one parcel when no single location can cover it.

## Why
The store cannot currently answer "where is this item, and where would it ship from". Origin is recorded twice — once on the seller and once on the product — so the two can disagree, and stock is a single number with no location attached to it at all.

That is tolerable while there is one shop and one shelf. It stops being tolerable the moment stock sits in a second place: the customer's shipping price and delivery estimate both depend on which location a parcel leaves from, and a store that guesses the origin quotes the wrong price and promises the wrong date. Getting this wrong is not a display error — it is money, in both directions, on every order.

There is a second reason to do it before the catalogue grows. A location's address has to be typed in by a person. Today that is a handful of rows; after a few hundred products spread across places, reconstructing where everything is becomes guesswork.

## Requirements
- **R1** — A selling organisation has one or more named pickup locations, each with an address complete enough for a courier to collect from, and one or more people who can act for it.
- **R2** — Nothing is preselected. Whoever adds a product chooses which location holds it and how many are there; a buyer chooses a delivery address at checkout. An unchosen location is an error, not a default.
- **R3** — A product's stock is recorded per location, so the store knows both how many exist and where they are.
- **R4** — The quantity offered to a customer is the total across all of that product's locations.
- **R5** — An order is fulfilled from the locations that actually hold the stock, splitting into more than one parcel where no single location can cover the quantity ordered.
- **R6** — Every parcel records the location it shipped from, and that record still describes the true origin after the location's address is later edited.
- **R7** — Shipping is priced per parcel, from that parcel's own origin.
- **R8** — A location cannot be removed while it holds stock or is named by a parcel that has already shipped.
- **R9** — An admin can see, for any product, where its stock is and how much sits at each place, and can correct those quantities.
- **R10** — A customer whose order will arrive as more than one parcel knows that before paying, and knows both when each parcel is expected and when the order will be complete.
- **R11** — A customer sees one availability figure per product. Where that stock physically sits is never shown to them: which location an item ships from is an operational detail, and a customer asked to reason about it has been handed the store's problem.

## Product acceptance
- **A1** — A product cannot be saved without choosing a location and a quantity for it.
- **A2** — A product with 3 units at the shop and 10 at a warehouse offers 13.
- **A3** — Ordering all 13 produces two parcels, one from each location, and no overselling.
- **A4** — Each parcel is quoted from its own origin pincode, and the two quotes may differ.
- **A5** — Editing a location's address leaves the origin recorded on already-shipped parcels unchanged.
- **A6** — Removing a location that still holds stock is refused, with a reason naming what blocks it.
- **A7** — An admin can list a product's stock broken down by location.
- **A8** — A two-parcel order shows both parcels at checkout before payment, each with its own delivery estimate and cost, plus the date by which the last one is expected.
- **A9** — Nothing a customer can reach reveals how a product's stock is distributed, including the serviceability and rate responses.

## Out of scope (this feature)
- **The guarded stock movement itself** — [inventory-reservation](../../inventory-reservation/) owns the requirement that the last unit sells once. This feature changes *where* that guard points, and depends on it landing first.
- **Real courier booking** — [shipping-fulfilment](../../shipping-fulfilment/), still blocked on its own open decision. This feature supplies the pickup address that booking will need.
- Stock transfers as a tracked operation with an in-transit state. Correcting quantities per location covers R9; movement as a first-class event is a later feature.
- Per-location pricing, and choosing a location to optimise anything other than parcel count and distance.
- Holding stock while a customer browses — already out of scope for [inventory-reservation](../../inventory-reservation/).
