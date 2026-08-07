# Spec — order and cart lines

- **Status:** Not drafted — scope agreed, requirements provisional, no TRD yet
- **Domain:** checkout, catalog
- **Phase:** 3 — Fulfilment
- **Verified:** 2026-08-08
- **Depends on:** money-as-paise
- **References:** [../spec.md](../spec.md), [../data-model.md](../data-model.md)

> Requirements and product approach only. A `trd.md` is written when this subfeature is picked up.

## What this feature is
What a customer bought is a relation to the product, not an id inside a blob.

## Why it is separate
The missing order-to-product relation. Money columns are integer paise from birth so [../../money-as-paise](../../money-as-paise/) does not migrate them twice.

## Requirements (provisional)
- **R1** — An order records each line with its quantity and the price as it stood at purchase.
- **R2** — A product that has been sold cannot be deleted out from under its order history.
- **R3** — What was sold, and for how much, can be answered without reading JSON in application code.
- **R4** — A cart line records quantity and the chosen size and colour.
- **R5** — One order line can be fulfilled by more than one parcel, and both parts remain linked to it.
