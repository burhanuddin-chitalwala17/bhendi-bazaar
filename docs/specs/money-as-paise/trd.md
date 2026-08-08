# TRD — money as paise

- **Status:** ✅ Implemented — PR-37
- **Domain:** cross-domain
- **Phase:** 2 — Transaction integrity
- **Verified:** 2026-08-09
- **References:** [spec.md](spec.md), [ADR-0004](../../adr/0004-money-as-integer-paise.md), [CONTRACTS.md](../../CONTRACTS.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
Monetary columns become integers denominated in paise, and all arithmetic becomes integer arithmetic. Conversion to a rupee string happens once, at the display edge. The alternatives and the reasoning for integers over `Decimal` are in [ADR-0004](../../adr/0004-money-as-integer-paise.md).

The risk here is not the concept but the cutover: a partial migration displays amounts 100× wrong. That failure is loud and immediate rather than subtle, which is the one thing working in its favour.

## Technical decisions
- **D1** — A data migration, not a type change. Converting the column type alone would reinterpret existing values and lose the paise; the migration must multiply and round explicitly in SQL. `[MIGRATION]`
- **D2** — Schema change and every read site change in **one PR**. A half-migrated state is unshippable, so there is no incremental path here — this is the one place in the backlog where a large single PR is correct.
- **D3** — Formatting is centralised in `src/lib/format.ts`. Paise never reach a component pre-divided, so there is exactly one place a factor-of-100 error can live.
- **D4 (revised 2026-08-09)** — Admin price inputs accept rupees; the conversion lives at the **server service boundary** (`server/catalog/admin.product.service.ts` → `moneyToPaise`), not the form layer as first drafted. [ADR-0013](../../adr/0013-one-error-envelope-and-useserverform.md) post-dates this TRD: the same Zod schema now validates on both client and server, so a rupees→paise transform inside it would run twice and multiply by 100 twice. The schema validates rupees (`rupeeAmount`, two decimals at most); the service converts once. Asking an admin to type paise would be a usability regression for no gain.
- **D5** — Wire DTOs carry paise, documented in [CONTRACTS.md](../../CONTRACTS.md). A DTO field named `price` carrying paise is a real footgun; naming or documentation must make the unit unambiguous at every boundary.
- **D6** — Admin aggregation moves to database-side `SUM` where it currently sums in application code. With integers this is exact, which is what makes R5 achievable.
- **D7** — A verification query runs before and after the migration comparing totals, so R4 and A2 are checked rather than assumed.
- **D8** — Land this **before** [server-side-pricing-authority](../server-side-pricing-authority/) if both are in flight. Recomputation logic written against floats would have to be rewritten.

## Packages
None. No decimal library — see [ADR-0004](../../adr/0004-money-as-integer-paise.md) for why `Decimal` was rejected.

## Data model
Monetary columns on `Product` (`price`, `salePrice`), `Order` (`itemsTotal`, `shippingTotal`, `discount`, `grandTotal`), `Shipment` (`shippingCost`), and `ShippingRateCache` (`rate`) change from `Float` to `Int`. Values are multiplied by 100 and rounded. **A verified backup is a precondition.** `[MIGRATION]`

## API / contract changes
Yes — `[CONTRACT]`. Every DTO carrying an amount changes its unit without changing its type, which is the dangerous kind of change: nothing fails to compile. `CONTRACTS.md` and the clients move in the same PR (D2).

## Test plan
Per [TESTING.md](../../TESTING.md), conversion and formatting are high-coverage targets.
- Round-trip: rupees in → paise stored → rupees displayed, for whole rupees, values with paise, and zero.
- Totals sum exactly for a basket large enough that float arithmetic previously drifted.
- No monetary comparison uses a tolerance (assert the epsilon comparison is gone).
- The gateway receives `grandTotal` with no further multiplication.
- Migration verification: pre- and post-migration totals match (D7).
- Formatting is correct for large values and for zero.

## Delivery (PRs)
1. `src/lib/format.ts` conversion and formatting helpers, with tests. Inert — nothing calls them yet.
2. The migration plus every read and write site, in one PR (D2). Large by necessity; PR 1 having landed keeps the formatting logic out of it.
3. Database-side aggregation for admin revenue (D6).

## Questions closed (2026-08-09)
- **Q1** — Surveyed before writing the migration: **zero rows** across all eight columns carried sub-paisa drift, so `ROUND` in the migration changes no value — it is a guard, not a correction. Baselines for D7: `SUM(price) = 29899.00 → 2989900`, `SUM(grandTotal) = 40490.54 → 4049054`.
- **Q2** — Field names stay. The unit is carried by the schema vocabulary instead: wire money validates as `paiseAmount` (integer), human input as `rupeeAmount` (two decimals) — so a misused field fails validation rather than relying on a name being read. [CONTRACTS.md](../../CONTRACTS.md) documents the one asymmetry: admin product prices arrive as rupees and convert at the service; everything else on the wire is paise.
