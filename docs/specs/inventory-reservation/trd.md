# TRD — inventory reservation

- **Status:** Draft
- **Domain:** checkout, catalog
- **Phase:** 2 — Transaction integrity
- **Verified:** 2026-08-03
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

## Open questions
- **Q1** — How long before an unconfirmed order is considered abandoned and its stock released? Should match [payment-confirmation](../payment-confirmation/) Q1 so an order is not released while still confirmable.
- **Q2** — If stock runs out *after* payment succeeded (possible only if D2 is ever relaxed), is the resolution an automatic refund or a manual operational task? Under D2 this should be unreachable; worth stating so the assumption is explicit.
- **Q3** — Should the out-of-stock failure adjust the cart automatically to the available quantity, or leave it for the customer? Affects A2's flow only.
