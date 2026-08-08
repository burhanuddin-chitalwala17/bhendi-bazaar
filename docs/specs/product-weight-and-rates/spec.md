# Spec — product weight and rates

- **Status:** ✅ Implemented — R1/A1 in PR-22; R2/R3 fell out of the allocation cutover (PR-48); the billing rule, R7, and the remainder closed in PR-53
- **Domain:** catalog, shipping
- **Phase:** 3 — Fulfilment
- **Verified:** 2026-08-10
- **References:** [trd.md](trd.md), [shipping-fulfilment](../shipping-fulfilment/), [CONTRACTS.md](../../CONTRACTS.md)

> Requirements and product approach only. Technical approach lives in [trd.md](trd.md).

## What this feature is

A product's weight is recorded when it is added to the catalogue, and that weight is what its shipping is priced on.

## Why

Shipping is priced by weight. The admin form already asks for a weight, so the information exists and someone is taking the trouble to enter it — but it is not reaching the rate calculation, which falls back to a default. Every quote is therefore priced on an assumed weight rather than the real one, and the error runs in both directions: the store absorbs the cost on heavy items and overcharges on light ones.

This has to be right before shipments are actually booked. A wrong quote on an unbooked shipment is a pricing error; a wrong quote on a booked one is a courier invoice that does not match what the customer paid.

## Requirements

- **R1** — A product's weight is stored when it is created and when it is edited, and persists.
- **R2** — Rate quotes are calculated from the actual weights of the items being shipped.
- **R3** — A shipment's weight is the combined weight of its contents, accounting for quantity.
- **R4** — A product with no recorded weight is identifiable, so the catalogue can be corrected rather than silently quoted on a guess. *(Largely dissolved: the form has required a positive weight since PR-22, so no new product can lack one.)*
- **R5** — Where a weight is genuinely unavailable, the fallback used is visible in the quote rather than silent. *(Met by the billing rule: a weightless parcel bills at the 1 kg floor, and every parcel card shows "billed as N kg".)*
- **R6** — Existing products, which all currently carry the same default weight, can be reviewed and corrected. *(The org product form shows weight on every edit; a dedicated review surface was not built.)*
- **R7** — Weight is entered in a stated unit, consistently, with no ambiguity between grams and kilograms.

## The billing rule (decided 2026-08-10)
Weights are entered in **kilograms with gram precision** (0.6 = 600 g). At checkout,
each parcel — the items allocated to one pickup location — sums its real weights, and
the rate is quoted on that sum **rounded up to the next whole kilogram, floor 1 kg**
(how couriers themselves bill, so a quote never undercharges shipping). The customer
sees the billable figure on the parcel card; the shipment record keeps the real sum.

## Product acceptance

- **A1** — Creating a product with a weight, then reopening it, shows that weight.
- **A2** — Two products of noticeably different weight produce different shipping quotes.
- **A3** — A cart of three units quotes on three units' weight, not one.
- **A4** — An admin can list products missing a weight.
- **A5** — A quote that used a fallback weight says so.
- **A6** — Quoted shipping for a known basket matches the courier's own price for that weight.

## Out of scope (this feature)

- Booking real shipments — [shipping-fulfilment](../shipping-fulfilment/). This feature makes the price right; that one makes the parcel real.
- Package dimensions and volumetric weight. Couriers may price on either; dimensions are a follow-on once weight is trustworthy.
- Splitting a basket across multiple parcels by weight limit.
- Warehouse or per-location differences.

