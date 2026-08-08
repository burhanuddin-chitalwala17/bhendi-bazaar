# Spec — server-side pricing authority

- **Status:** ✅ Implemented — PR-38
- **Domain:** checkout, payments
- **Phase:** 2 — Transaction integrity
- **Verified:** 2026-08-03
- **References:** [trd.md](trd.md), [ADR-0002](../../adr/0002-server-holds-pricing-authority.md), [CONTRACTS.md](../../CONTRACTS.md)

> Requirements and product approach only. Technical approach lives in [trd.md](trd.md).

## What this feature is
The amount a customer is charged is determined by the store, from its own catalogue, at the moment of purchase.

## Why
A customer's browser is not a trustworthy source for what something costs. Prices also legitimately change between the moment an item enters a cart and the moment an order is placed — a sale ends, a price is corrected — and the store needs a defined answer for that case rather than silently honouring whichever number arrived.

## Requirements
- **R1** — The charged amount is computed from catalogue prices held by the store, for every line item, at order placement.
- **R2** — Any price or total supplied by the client is ignored. It is not used, and not merely validated.
- **R3** — The amount requested from the payment gateway equals the total of the order that was persisted, and is derived from it rather than sent alongside it.
- **R4** — Shipping cost is taken from the quote the store issued, not from the value the client returns.
- **R5** — When the computed total differs from what the customer was shown, the purchase does not proceed. The customer is told prices changed and shown the new total.
- **R6** — Discounts are applied by the store according to its own rules; a discount amount is never accepted as input.

## Product acceptance
- **A1** — A purchase attempted with an altered price completes at the correct catalogue price, or fails. It never completes at the altered price.
- **A2** — A purchase where a price changed mid-session shows the customer a clear "prices have changed" state with the new total, and requires them to confirm.
- **A3** — The amount on the customer's gateway receipt equals the amount on their order.
- **A4** — A completed order's stored total can be recomputed from catalogue history and matches.

## Out of scope (this feature)
- Representing money exactly — [money-as-paise](../money-as-paise/).
- Deciding when an order counts as paid — [payment-confirmation](../payment-confirmation/).
- Coupon or promotion mechanics. No such feature exists yet; when one arrives, R6 is where it attaches.
- Price history or audit trail. A1's recomputation assumes current catalogue prices; a full audit trail is a separate feature.
