# ADR-0019: A discount is one winning offer, allocated to lines, with its funding recorded

- **Date:** 2026-08-16
- **Status:** Accepted
- **Context:** `Order.discount` is a single integer. It can say that ₹700 came off an order; it cannot say which items it touched, which offer produced it, or who paid for it. That was sufficient while no discount mechanism existed and the column was a constant zero.

  [promotions](../specs/promotions/) makes both the platform and a selling organisation able to discount the same item, and [org-payouts](../specs/org-payouts/) has to pay that organisation correctly afterwards. At that point "what did this order earn" stops being a subtraction and becomes a question about who funded what. The same question is asked by a partial refund, by a coupon that covers only part of a basket, and by an organisation reading its own settlement — three features that would otherwise each grow their own answer.
- **Decision:**
  1. **Offers compete; they never stack.** For any line, the discount is the single largest applicable offer, not a sequence of reductions applied in turn.
  2. **The winner's value is allocated across its lines** by largest-remainder rounding, so per-line shares sum to the scope total exactly.
  3. **Every discount records its funding split.** The organisation bears its own best offer; the platform bears only the remainder needed to reach what the buyer actually got. That remainder is **floored at zero**, so the arrangement is deliberately asymmetric: the platform tops up to a better offer, it never matches one. Where the organisation's offer is the deeper of the two it bears the whole of it, and the platform contributes nothing while still earning its full rate on the reduced base.
  4. **A database check constraint asserts that the two halves sum to the buyer's discount.** No settlement can be computed from a split that does not reconcile.
  5. **`Order.discount` survives as the sum**, and is a display total only. Settlement arithmetic reads the per-discount records, never this column.
- **Alternatives considered:**
  - *Keep the order-level integer and nothing else* — the conventional answer, and literally what the schema does today. Rejected because it cannot fund a payout, cannot compute a partial refund, and cannot tell a buyer which of their items a coupon covered. Each of those would then need its own reconstruction from prices that have since moved.
  - *Record the split per scope but not per line* — cheaper, and enough for payouts alone. Rejected because partial coupon coverage and per-item refunds both need the line, and adding the line later means migrating rows whose allocation nobody recorded.
  - *Let offers compound* — the buyer-friendliest reading, and the one most people assume. Rejected on two grounds: a clearance item taking a further campaign discount is how a margin goes negative without anyone noticing, and once two reductions both apply to one line, "who funded what" has no determinate answer.
  - *Recompute the split at settlement time from prices and rates* — rejected. Rates change, offers expire, and catalogue prices move. A settlement has to read a fact recorded when the order was paid, not re-derive one from a world that has moved on.
  - *Proportional allocation with ordinary rounding* — rejected: the per-line shares then fail to sum to the total by a paise or two, and under [ADR-0004](0004-money-as-integer-paise.md) a drifting total is a defect, not a tolerance.
  - *Have the platform match an organisation's deeper offer rather than top up to a better one* — rejected as backwards. It would have the platform funding discounts the organisation had already chosen to bear, and would make an organisation's own generosity a cost to the platform.
- **Consequences:**
  - ✅ Partial coupon coverage, per-item refunds, organisation payouts and the organisation's own earnings view all fall out of one mechanism instead of four.
  - ✅ A funding split that does not reconcile cannot be written, so settlement arithmetic never has to defend against one.
  - ✅ "A line's charged price is never above the price displayed for it" becomes a property that can be tested over generated baskets, rather than a claim.
  - ✅ Campaign cost per offer is a query over records that already exist, needing no reporting table.
  - ⚠️ Two new tables and a new per-line column, where the naive design has one integer.
  - ⚠️ The allocator has to be exactly right. A rounding bug here is a money bug, which is why it lands in an inert PR with its own tests before anything calls it.
  - ⚠️ "The discount" is no longer a single number — there is the buyer's, the organisation's share, and the platform's. Every report and screen has to say which it means.
