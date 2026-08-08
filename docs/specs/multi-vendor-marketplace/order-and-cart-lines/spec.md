# Spec — order and cart lines

- **Status:** ✅ Implemented (PR-43, PR-44)
- **Domain:** checkout, catalog
- **Phase:** 3 — Fulfilment
- **Verified:** 2026-08-10
- **Depends on:** money-as-paise
- **References:** [trd.md](trd.md), [../spec.md](../spec.md), [../data-model.md](../data-model.md)

> Requirements and product approach only. Technical approach lives in [trd.md](trd.md).

## What this feature is
What a customer bought is a relation to the product, not an id inside a blob.

## Why it is separate
The missing order-to-product relation. Money columns are integer paise from birth so [../../money-as-paise](../../money-as-paise/) does not migrate them twice.

## Requirements
- **R1** — An order records each line with its quantity and the price as it stood at purchase.
- **R2** — A product that has been sold cannot be deleted out from under its order history.
- **R3** — What was sold, and for how much, can be answered without reading JSON in application code.
- **R4** — A cart line records quantity and the chosen size and colour.
- **R5** — One order line can be fulfilled by more than one parcel, and both parts remain linked to it.

## Product acceptance
- A1 — An order placed with a chosen size and colour shows them in the org portal's parcel view; a variant the product never offered is refused at checkout.
- A2 — Deleting a sold product fails; deleting a product only in carts succeeds and the cart line disappears.
- A3 — Old orders and carts read identically after the lift; per-product revenue is answerable in SQL.

## Out of scope (this feature)
- Actually splitting one order line across parcels — expressible now, exercised by [stock-locations-and-allocation](../stock-locations-and-allocation/).
- The org money dashboard widgets these rows unblock — [dashboard-widgets](../dashboard-widgets/).
