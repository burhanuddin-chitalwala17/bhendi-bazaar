# Spec — listing-model / retire-old-paths

- **Summary:** Once every read and write uses the new model, the old fact list, facts column and old map tables are removed in the same release, after a full comparison proves nothing was lost
- **Status:** Accepted
- **Domain:** listing, with channels and catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-07
- **References:** [decisions.md](decisions.md), parent [listing-model](../spec.md) Q19, Q30, Q31, Q33, [ADR-0070](../../../adr/0070-a-products-attributes-are-rows-mapped-to-each-channels-own-catalogue.md)

> Requirements and product approach only. Technical approach lives in trd.md. Subfeature 5 of 5. No UI.

## What this feature is
The last step of the move: the old ways of describing a product and mapping it to channels are taken
out, so there is exactly one model to understand.

## Why
Two models side by side are the black box again. The owner chose to remove the old one in the same
release as the new form (parent Q30, Q31), so the safety lives in a verified switch.

## Requirements
- R1 — Before removal, every product's answers in the old and new models are compared; any mismatch
  stops the release (parent Q33).
- R2 — A database backup is taken before the removal runs.
- R3 — Removed: the code fact list, the product's facts and measurements columns, and the old category,
  attribute, fill and value map tables; their data already lives in the new model.
- R4 — Nothing reads or writes the removed parts; the test suite proves it.
- R5 — ADR-0051 and ADR-0052 are marked superseded by ADR-0070; every document describes only the new model.

## Product acceptance
- A1 — The release log shows the comparison: every product, zero mismatches, before removal.
- A2 — After release, every product page, listing, feed and channel publish works as before.
- A3 — Searching the code finds no reader of the removed columns or tables.

## Scope
- **Outcome:** one model left.
- **In:** R1–R5.
- **Later:** none.

## Open questions
None.
