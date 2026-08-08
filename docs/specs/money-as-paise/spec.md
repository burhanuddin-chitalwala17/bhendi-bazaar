# Spec — money as paise

- **Status:** ✅ Implemented — PR-37
- **Domain:** cross-domain
- **Phase:** 2 — Transaction integrity
- **Verified:** 2026-08-03
- **References:** [trd.md](trd.md), [ADR-0004](../../adr/0004-money-as-integer-paise.md)

> Requirements and product approach only. Technical approach lives in [trd.md](trd.md).

## What this feature is
Every amount the store displays, stores, charges, and reports is the same amount, exactly.

## Why
Amounts currently pass through arithmetic that cannot represent them precisely, so the cart total, the stored order total, the amount charged, and the revenue report can each differ slightly from one another. Individually the differences are fractions of a rupee; collectively they mean the store cannot state its own revenue with confidence, and cannot answer "was this customer charged the right amount?" with a plain comparison.

It also removes a category of ambiguity from every other feature. Once amounts are exact, a check on an amount is an equality, not a tolerance — and a tolerance is a range of accepted values, which is precisely what a payment check should not have.

## Requirements
- **R1** — Amounts are represented exactly, with no accumulated error, from catalogue price through to gateway charge and reporting.
- **R2** — Two amounts that should be equal compare as equal. No tolerance is used anywhere in a monetary comparison.
- **R3** — Amounts display to the customer in rupees and paise, formatted consistently across the storefront, admin, and email.
- **R4** — Existing catalogue prices, order totals, and shipping costs carry over with their current values preserved to the paisa.
- **R5** — Revenue figures in the admin console are exact sums, not approximations.
- **R6** — Prices including paise (for example ₹499.50) are enterable and storable.

## Product acceptance
- **A1** — A cart's displayed total equals the order total equals the gateway charge, to the paisa, for a basket large enough that rounding error would previously have appeared.
- **A2** — After migration, every existing product price and order total displays the same value it did before.
- **A3** — Admin revenue for a period equals the sum of its orders' totals, exactly.
- **A4** — An admin can enter ₹499.50 and see ₹499.50.
- **A5** — No screen anywhere displays an amount 100× too large or too small.

## Out of scope (this feature)
- Who computes the amounts — [server-side-pricing-authority](../server-side-pricing-authority/).
- Currencies other than INR. The representation chosen does not preclude it, but no multi-currency behaviour is added.
- Tax calculation. None exists yet.
- Historical price auditing.
