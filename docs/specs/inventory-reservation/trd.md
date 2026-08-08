# TRD — inventory reservation

- **Status:** ✅ Implemented — PR-40
- **Domain:** checkout, catalog
- **Phase:** 2 — Transaction integrity
- **Verified:** 2026-08-09
- **References:** [spec.md](spec.md), [ADR-0007](../../adr/0007-conditional-stock-decrement.md), [ADR-0003](../../adr/0003-one-repository-per-aggregate.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
The database performs the check and the write as one statement. A conditional update that only matches rows with enough stock, inside the order transaction, means there is no interval during which two callers can both believe stock is available. The check is not a step before the write — it is the `where` clause of the write.

Cart clearing joins the same transaction, so R2 and R6 hold together or not at all.

## Technical decisions
- **D1** — Stock moves via a conditional `updateMany` matching on sufficient stock, and a zero match count means unavailable. Chosen over `SELECT ... FOR UPDATE` because it needs no raw SQL — the codebase currently has none, which is a property worth keeping — and over `SERIALIZABLE` isolation because that would impose retry handling on every checkout to fix one query.
- **D2** — Reservation happens at **order creation**, not at payment confirmation. Reserving later would open a window where a paid order cannot be fulfilled, which is worse for a customer than a checkout that fails before payment.
- **D3** — Release on failure is driven by the order reaching a failed or abandoned state, so it has exactly one trigger — the state transition owned by [payment-confirmation](../payment-confirmation/) — rather than being attempted from several call sites.
- **D4** — The failure message names the specific item and its available quantity, so R3 and A2 are satisfiable. This means the failing item must be identifiable from the failed update, not just a boolean.
- **D5** — One order-creation path. There are currently two, with different stock behaviour; the weaker one is removed rather than patched, since leaving a second create path defeats the guarantee ([ADR-0003](../../adr/0003-one-repository-per-aggregate.md)).
- **D6** — R7 uses the `Cart.version` column already present but never checked, enforced as a conditional update in the same style as D1. Either it is enforced or the column is dropped — a column implying a guarantee it does not provide is worse than no column.
- **D7** — Cart clearing moves server-side into the order transaction. It is currently performed by the client after the fact.

## Packages
None.

## Data model
No new columns. `Product.stock` and `Cart.version` already exist; this changes how they are written. An index review on `Product` may follow if the conditional update proves slow, but the primary-key match should make it a non-issue.

## API / contract changes
None to request shapes. Behaviour changes: order creation can now fail with a specific out-of-stock error that clients must render, and the client's cart-clearing call becomes redundant and is removed.

## Test plan
Per [TESTING.md](../../TESTING.md), stock reservation under concurrency is a 100% target. The concurrency test is the important one and must run real overlapping transactions, not mocked ones — a mocked race proves nothing.
- N concurrent orders for a one-unit item: exactly one succeeds, N-1 receive out-of-stock.
- Insufficient stock creates no order and leaves stock unchanged.
- Stock never reaches a negative value.
- A failed order returns its stock.
- A successful order leaves an empty cart, in the same transaction.
- A stale cart version is rejected rather than silently overwriting.
- The removed second create path is gone (a test asserting the endpoint no longer exists).

## Delivery (PRs)
1. Conditional stock reservation in the live order transaction, plus the concurrency test. This closes R1, R2, R3, R5 — the highest-value slice.
2. Cart clearing into the same transaction; remove the client-side call.
3. Release-on-failure, wired to the order state transition. Depends on [payment-confirmation](../payment-confirmation/) PR 1.
4. Remove the redundant order-creation path.
5. Enforce `Cart.version`, or drop the column.

## Questions closed (2026-08-09)
- **Q1** — 60 minutes: double payment-confirmation's 30-minute sweep threshold, and the release only fires after the gateway has been *asked* and reported nothing captured — so an order the gateway could still confirm is never released first. Failed payments keep their hold until expiry, which also answers payment-confirmation's carried Q3: the customer can retry the same order within the hold; after expiry a new order is needed.
- **Q2** — Unreachable under D2, and now stated in code: `confirmPaid` refuses an expired order (its stock is already back on the shelf), so a capture landing after expiry is refused and refunded manually — the store never confirms an order it may not be able to fulfil.
- **Q3** — The failure names the item and the available quantity ("Only 2 left of X — you asked for 3") and leaves the cart for the customer. Auto-adjusting a cart behind someone's back is the same class of silent mutation R7 forbids.

## Test-plan caveat
The concurrency test — N real overlapping transactions against a one-unit item — **cannot run here yet**: there is no test database ([TESTING.md](../../TESTING.md) § Database behaviour is currently untestable). The guard's correctness rests on its *shape* (the check is the `where` clause of the write, pinned by test) and on Postgres semantics, not on our code winning a race. That test is the first thing the future test-database work should add.
