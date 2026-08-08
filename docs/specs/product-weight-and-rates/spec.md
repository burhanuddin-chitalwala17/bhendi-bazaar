# Spec — product weight and rates

- **Status:** Draft — R1 and A1 landed early in [PR-22](../../CHANGELOG.md); R2–R7 outstanding
- **Domain:** catalog, shipping
- **Phase:** 3 — Fulfilment
- **Verified:** 2026-08-03
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
- **R4** — A product with no recorded weight is identifiable, so the catalogue can be corrected rather than silently quoted on a guess.
- **R5** — Where a weight is genuinely unavailable, the fallback used is visible in the quote rather than silent.
- **R6** — Existing products, which all currently carry the same default weight, can be reviewed and corrected.
- **R7** — Weight is entered in a stated unit, consistently, with no ambiguity between grams and kilograms.

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

