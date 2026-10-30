# TRD — own-store/offers-hardening

- **Status:** Implemented — 2026-10-29, units 1–6 (55292be…02c9e5e) on branch offers-hardening
- **Domain:** promotions, payouts, with checkout and catalog
- **Phase:** 12 — The shop's own store
- **Verified:** 2026-10-29
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), the 2026-10-29 money audit (own-store spec), [ADR-0004](../../../adr/0004-money-as-integer-paise.md), [ADR-0007](../../../adr/0007-conditional-stock-decrement.md), [ADR-0018](../../../adr/0018-one-effective-price-function.md), [ADR-0019](../../../adr/0019-discount-is-one-winning-offer.md), [ADR-0020](../../../adr/0020-money-bearing-records-never-cascade.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
Each gap is closed where the rule already lives, not beside it. Reversal moves from the order to
the parcel inside the ledger. Concurrency is closed by a lock in the transaction that already
claims the coupon. The ceiling and the 30-day basis enter the one pure engine
(`server/promotions/discount-engine.ts`) as inputs, so the product page and the charge still come
from one function (ADR-0018). The budget is a second conditional counter beside `usageCount`. The
database then refuses what the engine should never produce.

## Prior art
- **Partial reversal:** marketplaces settle per shipment or per item, never per order (Amazon's
  settlement report carries refunds per order-item; Shopify refunds by line item and quantity).
  We follow it. Splitting a line across parcels uses cumulative floor allocation, which keeps the
  sum of parts equal to the whole; our `allocateLargestRemainder` is the same family.
- **Per-customer limits:** done either with a redemption table under a unique key or a lock on the
  offer row. We take the lock: contention is per coupon, and the existing count stays the record.
- **Lowest price in 30 days:** the EU Omnibus Directive (2019/2161, Art. 6a) makes it the reference
  price for an announced reduction; shops keep a price history. We keep one, written by a database
  trigger so no writer (form, sheet, marketplace import) can skip it.
- **Campaign budgets:** ad platforms stop serving at the budget; we stop at the transaction, which
  is stricter. Our `usageCount` conditional write (promotions D11) is the pattern, and it is right.

## Technical decisions
- **D1 — A reversal belongs to a parcel (R1).** `OrgLedgerEntry` gains `shipmentId`;
  `OrgLedgerEntryLine` gains `quantity`. The unique `(orderId, orgId, kind)` becomes three partial
  unique indexes in the migration: one SALE per order and org; one legacy order-wide REVERSAL;
  one REVERSAL per parcel. `ledgerService.reverseShipment` replaces `reverseSale` at the call in
  `server/shipping/shipment-status.service.ts`, which passes the parcel's scope (ADR-0033). It locks
  the org's SALE row (`FOR UPDATE`), then returns early if the parcel is reversed; the index is the backstop.
- **D2 — Exact parts.** For each parcel item, base, org-funded, platform-funded and commission each
  reverse `floor(x·to/Q) − floor(x·from/Q)`, where `from` is the quantity already reversed and `Q`
  the line's quantity. Gross is base plus org-funded and payable is base less commission, so every
  part is ≥ 0 and the entry reconciles. A legacy reversal line with no quantity counts as the whole
  line (Q6); a manually edited sale reverses its header pro rata (Q12). Pure, in `commission.ts`.
- **D3 — Lock before counting (R2).** `applyToOrder` takes `SELECT … FOR UPDATE` on the typed
  coupon's row before the per-buyer count. A concurrent checkout waits, then sees the first one's
  committed `OrderDiscount` under READ COMMITTED.
- **D4 — The ceiling is an engine input (R3).** `quoteDiscounts` and `automaticUnitPrice` take each
  org's `maxDiscountBps`. An ORG offer's per-unit discount, and an ORG coupon's line share, are
  clamped to `applyBps(price, ceiling)`. `loadPriceContext` loads every ceiling in the same request
  memo. The form checks flat and fixed-price offers on targeted products, and the sale price, before
  saving (Q7).
- **D5 — Budget beside usage (R4).** `Promotion` gains `platformBudgetPaise`, `platformSpentPaise`,
  `lossConfirmedAt`, `lossConfirmedByUserId`. In the order transaction, each platform-funded
  attribution adds to spent with a conditional raw update (`spent + x ≤ budget`); a miss is a
  `ConflictError` (Q4). `releaseForOrder` gives it back. `isExhausted` also treats a spent budget as
  exhausted, so the offer leaves product pages.
- **D6 — Loss test at save (R4, Q2).** `admin.promotion.service` compares a platform offer's depth
  with the lowest commission rate in force (org defaults and category rules, through
  `commercialTermsService`). Possible loss requires `confirmLoss = "CONFIRM LOSS"` and a budget; the
  admin's id comes from the session, never the body. `platformSpentPaise` is never input.
- **D7 — Funding basis (R5).** `ProductPriceHistory`, filled by an `AFTER INSERT OR UPDATE OF price`
  trigger on `Product`, backfilled. Catalog reads the lowest list price over 30 days, counting the
  price in force at the window's start; the order passes it as `fundingBasisUnitPaise`. The buyer is
  priced as before; the platform pays at most its winning offer valued on the basis (a coupon once
  per order, its shortfall on raised lines only, pro rata to the rise; minimum spend at the shown
  price, Q15), the org the rest. Equal basis gives today's split. D4 bounds only the shop's own
  offer. Budget fit (D5) is decided on the shown price, as the preview decides it.
- **D8 — Repeated lines (R6).** The quote route merges lines by key, as `order.service` does; the
  engine refuses duplicate keys as a programming error.
- **D9 — A beaten coupon is set aside (R7).** `applyToOrder` no longer throws on `ALREADY_BETTER_OFF`
  and claims nothing.
- **D10 — Database checks (R8).** CHECK constraints on `Promotion` (percent 1–10000, positive amounts
  and limits, `0 ≤ spent ≤ budget`), `OrderItem` (`0 ≤ orgFunded ≤ discount ≤ unitPrice·quantity`)
  and `OrderDiscount` (non-negative parts). The migration header carries the pre-check queries.

## Packages
None.

## UI approach
Screens, states and copy: [ux.md](ux.md). `OfferForm` gains the loss panel and budget field through
`useServerForm` with the shared `promotion.schema.ts`; the panel is shown from the same pure loss
test the server runs, fed the lowest rate by the edit page (server component). `OfferList` reads
spent and budget from its DTO. Phone first: the panel is a full-width block in the form column. The
ceiling messages are `DomainError`s with a `field`, shown inline by the existing forms.

## Gates touched
`one-repository`: ledger writes stay in `ledger.repository.ts`, budget writes in
`promotion.repository.ts`; the trigger is SQL. `file-cohesion`: `price-context.ts` and
`promotion.service.ts` gain catalog (two other domains at most). `test-integrity`: new integration
suites use the shared throwaway-database guard. No allowlist entry.

## Data model
[MIGRATION] three migrations: ledger parcel columns and partial indexes (U1); CHECK constraints (U3);
promotion budget columns, price history table and trigger (U5, U6).

## API / contract changes
[CONTRACT] the offer form input gains `budget` and `confirmLoss`; the offer list DTO gains
`platformBudgetPaise`, `platformSpentPaise`, `lossConfirmedAt`, `lossConfirmedBy`. CONTRACTS.md moves with U5.

## Test plan
Unit: cumulative reversal sums to the sale for random splits (A2); ceiling clamp on every value type
and coupon share, product page equals charge (A4); funding basis split (A6); duplicate keys refused;
loss test (A5). Integration (real Postgres): two-org parcel reversal (A1); concurrent per-user
redemption (A3); budget exhaustion and release (A5); quote equals order for repeated lines (A7);
beaten coupon (A8); CHECK refusals (A9); trigger writes history. Each new guard mutation-tested.

## Delivery (PRs)
- **U1** — parcel reversal (R1). Behaviour change. [MIGRATION]
- **U2** — per-buyer lock (R2).
- **U3** — repeated lines, beaten coupon, database checks (R6–R8). [MIGRATION]
- **U4** — ceiling in the engine and the forms (R3).
- **U5** — budget and loss confirmation, with UI (R4). [MIGRATION] [CONTRACT]
- **U6** — 30-day funding basis (R5). [MIGRATION]

## Open questions
None.
