# ADR-0002: The server is the sole authority on prices and totals

- **Date:** 2026-08-03
- **Status:** Accepted
- **Context:** The order and payment schemas accepted item prices and totals from the request body and validated them only for *internal consistency* — that the line items summed to the stated total. Nothing compared them against `Product.price`, and the gateway amount was likewise taken from the request rather than derived from the persisted order.

  The underlying error is treating a request body as a source of facts rather than a claim to be checked. Self-consistency of client-supplied numbers is not a security property: it proves the caller can do arithmetic, not that the arithmetic is about real prices. A gateway signature does not close the gap either — it attests that a payment occurred against a gateway order, and says nothing about whether that order's amount matched ours.
- **Decision:**
  Prices, totals, and payment amounts are **always** recomputed server-side from the database.
  1. Order creation re-fetches every line item's price in one `tx.product.findMany({ where: { id: { in: ids } }, select: { id: true, price: true, salePrice: true } })` inside the order transaction, and computes `itemsTotal`, `discount`, and `grandTotal` from those values.
  2. Client-supplied `price`, `salePrice`, `subtotal`, and `total` fields are **dropped**, not validated. They may remain in the request schema for display-intent purposes only if a comment states they are ignored; preferably they are removed.
  3. The gateway amount is derived as `Math.round(order.grandTotal)` (already paise per ADR-0004) from the **persisted** order, loaded by id. No client-supplied amount reaches the gateway.
  4. Shipping cost comes from the persisted rate quote, not from the request body.
  5. If a recomputed total differs from what the client displayed, the request **fails** with a price-changed error. It does not silently charge the new price.
- **Alternatives considered:**
  - *Keep client prices but verify each against the DB and reject mismatches* — rejected. It is the same amount of DB work as recomputing, but leaves a code path where a client number can be persisted if a check is ever missed. Recomputing makes the vulnerability unwriteable rather than merely absent.
  - *Sign the cart server-side and verify the signature at checkout* — rejected as premature. It adds key management and an expiry window to solve a problem that a `findMany` already solves. Worth revisiting only if price lookups become a measured bottleneck.
  - *Trust the client and reconcile after the fact from gateway settlement reports* — rejected. It detects theft instead of preventing it, and the goods have already shipped.
  - *Tighten the `.refine()` to also check against a price range* — rejected outright; it is the current broken design with a narrower window.
- **Consequences:**
  - ✅ Underpayment becomes impossible rather than merely validated-against.
  - ✅ Price changes between add-to-cart and checkout are detected instead of silently honoured in the customer's favour.
  - ⚠️ One extra query per order creation. Negligible — it is a single indexed `IN` lookup inside a transaction that already writes several rows.
  - ⚠️ Clients must handle a price-changed rejection. This is a real UX surface (`"prices updated, review your cart"`) and belongs in the checkout flow, not swallowed.
  - ⚠️ Existing order rows were created under the old rules and may hold client-supplied prices. They are not retroactively trustworthy; treat historical `grandTotal` as reported, not verified.
