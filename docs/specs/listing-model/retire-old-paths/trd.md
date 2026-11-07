# TRD — listing-model / retire-old-paths

- **Status:** Accepted
- **Domain:** listing, with channels and catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-07
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), parent [trd.md](../trd.md) D10

> Technical approach. Parent D10's contract step.

## Approach
A release gate runs the backfill comparison against production before the drop migration; the drop
is its own migration, applied only after the gate passes, with a backup taken first.

## Prior art
Expand/contract (parallel change). Followed.

## Technical decisions
- **D1 — Gate.** a new `listing-model-verify` script compares every product's old facts, measurements,
  weight and brand compliance with its values; exits non-zero on any mismatch; run in the deploy before
  `migrate deploy` of the drop migration, its output kept in the release log.
- **D2 — Backup.** Prisma Postgres point-in-time recovery confirmed, plus a `pg_dump` of the dropped
  tables before the drop.
- **D3 — Drop.** `Product.facts`, `Product.measurements`, `Product.weight`, `ChannelCategoryMap`
  (replaced by `TypeMap`), `ChannelAttributeMap`, `ChannelAttributeFill`, `ChannelValueMap`,
  `ListingValue`; `FACT_DECLARATIONS`, `fill-facts.ts`, `forwardAttributes`/`fillAttributes`. The
  migration header names the comparison and the owner's approval (`migration-drops` test).
- **D4 — Docs.** ADR-0051 and ADR-0052 status set to superseded by ADR-0070; ADR-0070 accepted;
  CONVENTIONS and ARCHITECTURE describe only the new model.

## Packages
None.

## Gates touched
`migration-drops`, docs-integrity, every test reading the removed parts.

## Data model
[MIGRATION] drops listed in D3.

## Test plan
Full unit and integration suites green with the removed parts gone; a test asserts no source file
names a removed column or table.

## Delivery
1. Verify script. 2. Drop migration and code removal. 3. Docs.

## Open questions
None.
