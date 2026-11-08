# Spec — listing-model / field-maps

- **Summary:** Every field a channel asks has one map saying where its value comes from, made and checked against each channel's own documentation, so a listing is built complete from the product
- **Status:** Accepted
- **Domain:** listing, with channels
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-07
- **References:** [decisions.md](decisions.md), parent [listing-model](../spec.md) Q7, Q23, Q24, Q32, [channel-catalogue](../channel-catalogue/), [ux.md](ux.md)

> Requirements and product approach only. Technical approach lives in trd.md. Subfeature 2 of 5.

## What this feature is
For every channel type, each field the channel asks has one map: its value comes from a product
attribute, a rule (Women → Womens), a core field (name, SKU, weight), the shop's settings, or a fixed
value, with answers paired and units converted. A channel's listing is built from these maps.

## Why
Of the 13 fields Amazon refused the Tote bag for, half we stored and never sent, and two went to the
wrong Amazon field. A map that is missing or wrong is invisible until a refusal. Each must exist,
be right, and say why.

## Requirements
- R1 — Every field of every channel type in scope has exactly one map, or is marked as filled by the
  channel's adapter, or is marked "needs a developer" and raised as a request (parent Q5).
- R2 — Default maps for all five channels are made before release by Claude, each checked against the
  channel's own documentation and recorded with its source, date and reason (parent Q23).
- R3 — A map converts answers (our option to the channel's value) and units (to the channel's unit).
- R4 — A fixed value is a default the shop can override on a product (parent Q24).
- R5 — The listing a channel receives is built from the product and the maps every time it is opened,
  checked or sent; the channel listing stores only overrides and what was sent (parent Q7).
- R6 — An admin can view every map with its source and reason, and change one; a change applies to
  every product of the type from then on.
- R7 — Before release, one real product of every mapped type passes Amazon's check-only mode and the
  Google and Meta feed validators.

## Hazards the TRD must answer
- **A map changed while a listing is being sent:** the send uses the maps it was built with.
- **A channel value with no pair for a shop's answer:** a gap shown to the shop, never dropped silently.
- **Cost:** maps loaded once per batch, not per product.

## Product acceptance
- A1 — On Amazon TOTE_BAG, every required field shows its source; the 13 fields of 2026-11-06 are all
  mapped (to an attribute, a rule, a core field or a fixed value) or flagged for a developer.
- A2 — A Women's tote sends Department "Womens" and Age range "Adult" without the shop answering either.
- A3 — Weight entered in grams reaches Amazon in kilograms; length in cm reaches Flipkart in cm.
- A4 — An admin changes Amazon's Style map; the next built listing uses the new source.
- A5 — Each mapped type's sample product passes Amazon check-only, and the Google and Meta validators.

## Scope
- **Outcome:** every channel field is filled from one known, checked source.
- **In:** R1–R7; the maps, value pairs and unit conversion; the admin's read-and-edit screen; the
  default maps for Amazon, Flipkart, Meesho, Google and Meta.
- **Later:** none.

## Open questions
None.
