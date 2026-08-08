# Spec — inventory reservation

- **Status:** ✅ Implemented — PR-40
- **Domain:** checkout, catalog
- **Phase:** 2 — Transaction integrity
- **Verified:** 2026-08-03
- **References:** [trd.md](trd.md), [ADR-0007](../../adr/0007-conditional-stock-decrement.md)

> Requirements and product approach only. Technical approach lives in [trd.md](trd.md).

## What this feature is
Stock counts mean something: an item with one unit left can be bought once.

## Why
Selling something twice costs more than a lost sale. The customer who cannot be fulfilled has already paid, already received a confirmation, and has to be contacted, apologised to, and refunded — and it happens most on exactly the items where it hurts most, the last unit of something popular during a rush.

The reverse failure matters too. Stock held by checkouts that were never completed is stock that cannot be sold, so a reservation has to be released as reliably as it is taken.

## Requirements
- **R1** — Two customers cannot both buy the last unit. This holds when their attempts overlap exactly.
- **R2** — Stock is committed at the same moment the order is created, as one indivisible step. An order never exists without its stock movement, and stock never moves without an order.
- **R3** — When stock is insufficient, no order is created and the customer is told which item is unavailable.
- **R4** — Stock held by an order that fails or is abandoned returns to available.
- **R5** — Stock never goes negative.
- **R6** — A completed checkout clears the customer's cart as part of the same step, so a closed tab cannot leave a cart that has already been bought.
- **R7** — Concurrent edits to one customer's cart from two places do not silently discard one of them.

## Product acceptance
- **A1** — Two simultaneous purchases of a one-unit item result in exactly one order and one clear out-of-stock message.
- **A2** — A customer buying an item that sold out mid-checkout sees which item and can remove it and continue.
- **A3** — No product ever displays negative stock.
- **A4** — An abandoned checkout's items become buyable again without manual intervention.
- **A5** — Completing a purchase leaves an empty cart, even if the browser is closed at the moment of payment.
- **A6** — Editing a cart in two tabs does not lose a change without warning.

## Out of scope (this feature)
- Holding stock while a customer browses, before checkout. Reservation begins at placement; a browse-time hold is a larger feature with its own expiry mechanics.
- Refunding a payment for an order that fails after payment — [payment-confirmation](../payment-confirmation/) R7 owns the state; the refund flow is Phase 5.
- Backorders, pre-orders, or "notify me when available".
- Warehouse or multi-location stock — [stock-locations-and-allocation](../multi-vendor-marketplace/stock-locations-and-allocation/) owns it, and depends on this feature landing first.
