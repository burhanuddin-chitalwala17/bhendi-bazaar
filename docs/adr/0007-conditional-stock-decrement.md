# ADR-0007: Stock moves conditionally, inside the order transaction

- **Date:** 2026-08-03
- **Status:** Accepted
- **Context:** Two order-creation paths existed with two different stock behaviours: the one the checkout UI actually used did not touch stock at all, while the older one guarded it by reading each product's stock and then decrementing. A `Cart.version` column had likewise been added for optimistic locking but was never passed by any caller — incremented faithfully, never compared.

  The unifying defect is **read-then-write used as a guard.** A check and a write that are not a single atomic statement do not constitute a check, and wrapping them in a transaction does not change that: Prisma's default isolation is READ COMMITTED with no row lock, so concurrent callers all pass the same check before any of them writes. A column that exists but is never read for a decision is a related failure — it implies a guarantee that does not hold, which is worse than having no column.
- **Decision:**
  1. **Stock changes with a conditional write, in the same transaction as the order:**
     `tx.product.updateMany({ where: { id, stock: { gte: qty } }, data: { stock: { decrement: qty } } })`.
     `count === 0` means insufficient stock — abort the transaction. The database performs the check and the write as one statement, so there is no window.
  2. **The live path decrements.** `createOrderWithShipments` does this for every line item. No order is created without a corresponding stock movement.
  3. **The cart is cleared in the same transaction**, not by the browser afterwards. It currently clears client-side (`useCheckoutPayment.ts`), so an abandoned tab leaves the cart populated after a successful order.
  4. **`Cart.version` is enforced or removed.** Enforce: return `version` from `GET /api/cart`, require it on write, and apply it as `updateMany({ where: { userId, version: expected }, data: { version: { increment: 1 }, ... } })`, rejecting on `count === 0`. A column that exists but is never read is worse than no column — it implies a guarantee that does not hold.
  5. **General rule:** any invariant guarded by a read is expressed as a conditional write. `SELECT ... FOR UPDATE` is acceptable where a conditional write cannot express the rule, but a bare read-then-write is not.
- **Alternatives considered:**
  - *Raise the transaction isolation level to SERIALIZABLE* — rejected as the primary mechanism. It would make the read-then-write correct, but at the cost of retry handling on every checkout and a throughput hit on unrelated queries, to solve what one `where` clause solves locally.
  - *`SELECT ... FOR UPDATE` on each product row* — correct, and the conventional answer, but rejected as the default: it needs `$queryRaw` (the codebase currently has zero raw SQL, which is a property worth keeping) and holds locks for the transaction's duration. Conditional `updateMany` achieves the same guarantee declaratively.
  - *Reserve stock at add-to-cart with a TTL* — rejected as out of scope. It solves a different problem (overselling between browse and pay) and adds a reservation-expiry mechanism. Revisit if oversell complaints persist after this change.
  - *Decrement on payment confirmation rather than order creation* — considered seriously. It avoids holding stock for abandoned checkouts, but opens a window where a paid order cannot be fulfilled, which is worse for a customer than a failed checkout. Decrement at creation; release on cancellation or payment failure.
  - *Allow negative stock and reconcile manually* — rejected. It converts a preventable error into operational work and customer apologies.
- **Consequences:**
  - ✅ Overselling becomes impossible rather than merely unlikely under load.
  - ✅ The N+1 pre-check loop disappears — the guard is the write.
  - ✅ Order, stock movement, and cart clearing become one atomic unit, so no partial checkout state survives.
  - ⚠️ Checkout can now fail late, after the customer has committed, if the last unit sold concurrently. This needs a real error path in the UI, and — because payment may already have succeeded — a refund path. That is the honest cost of correctness and belongs in the checkout spec.
  - ⚠️ Abandoned checkouts now hold stock until cancelled. Requires an order-cancellation path that releases stock, and eventually a timeout sweep for orders left `pending`.
  - ⚠️ The legacy `/api/orders` create path remains exposed as an HTTP endpoint. It must be brought under the same rule or removed; leaving a second, weaker create path defeats this ADR (see [ADR-0003](0003-one-repository-per-aggregate.md)).
