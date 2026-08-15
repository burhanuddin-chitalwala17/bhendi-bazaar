# ADR-0020: Records that carry money or attribution never cascade

- **Date:** 2026-08-16
- **Status:** Accepted
- **Context:** The schema already restricts deletion in the places where the risk was noticed — a sold product cannot be deleted out from under its order history, a category cannot be deleted out from under its products — but the rule was never written down, so it is applied case by case and each instance argues itself from scratch in an inline comment.

  The cost of that shows in the record rather than in the schema. `Product.categoryId` did cascade, and was corrected to `Restrict` by the `category_tree` migration on 2026-08-10; six days later [BACKLOG](../BACKLOG.md) still carried it as an open defect, because a fix made as a local judgement left nothing to check the watch list against. A rule stated once would have closed that entry the day the migration landed.

  [promotions](../specs/promotions/) and [org-payouts](../specs/org-payouts/) add tables where a cascade is worse than data loss, because it is *silent* and *wrong in the other direction*. An offer with no target rows applies to everything in its scope — that is what makes targeting purely subtractive and removes the need for an `ALL` enum member. Combined with a cascading delete, removing a category would take its target row with it and convert a category campaign into a store-wide one. Nobody would see an error; every buyer would see a discount on everything.
- **Decision:**
  1. **Every foreign key out of a record that carries money, funding attribution, or a rate is `onDelete: Restrict`.**
  2. This covers promotion targets, per-order discount records, ledger entries and their lines, settlements, and commission rules.
  3. **Deleting a referenced row is refused.** The operation a caller actually wants in these cases is cancellation or deactivation, not deletion.
  4. **Cascade stays correct where a child is meaningless without its parent *and* carries no money or attribution** — order items, cart lines, org memberships. This ADR narrows the default; it does not abolish it.
  5. **Existing restrictions stop being local judgements and become instances of this rule** — `Product.categoryId` and `OrderItem.productId` among them. Each keeps its inline comment about the specific harm; what changes is that neither has to re-argue the principle, and neither can be "tidied up" without contradicting a stated convention.
- **Alternatives considered:**
  - *Cascade on child rows* — the ORM default, what an editor autocompletes, and what a reasonable person writes on a relation called `PromotionTarget` without pausing. Rejected because the two failures are not comparable: for a target row a cascade changes what an offer covers, and for a ledger row it deletes the evidence that money is owed. This is precisely the case the README's test describes — a `Restrict` on a child table looks like an oversight, and will be "tidied up" by whoever meets it next unless the reasoning is on record.
  - *Guard deletions in application code before issuing them* — rejected, and for a reason already settled: a check and a write that are not one statement do not constitute a check ([ADR-0007](0007-conditional-stock-decrement.md)). It is also the mechanism currently standing between a category delete and its products, which is how that gap came to exist.
  - *Soft-delete everything instead* — rejected as a blunter instrument. It makes every query in the codebase carry a filter to solve a problem a foreign key already solves, and a forgotten filter fails open. Payout ledger entries do soft-delete, but for an unrelated reason: a balance has to be able to explain its own change, which is a requirement about history, not about referential integrity.
  - *Keep deciding case by case* — the status quo, and defensible as long as every case gets noticed. Rejected because case-by-case leaves no way to tell a deliberate `Restrict` from a `Cascade` nobody has looked at yet, which is how a corrected `Product.categoryId` sat on the watch list as an open defect for six days after it was fixed. The promotions target-widening trap is considerably less obvious than that one was, and would not have announced itself at all.
- **Consequences:**
  - ✅ The target-widening failure stops being expressible, rather than relying on whoever writes the migration to have thought about it.
  - ✅ Payout records outlive any tidying of the organisations, orders, offers and categories they reference — which is the whole point of keeping them.
  - ✅ One rule to apply when adding a table, instead of a judgement call each time.
  - ⚠️ Deleting a test organisation, order or category becomes harder. This is deliberate; `prisma/seed.ts` remains the way to reset a local database, and it is gated separately ([Invariant 7](../../CLAUDE.md)).
  - ⚠️ `orderService.deleteOrder` becomes unusable on any order that has reached a ledger entry. That is correct, and it points at cancellation being the operation actually wanted there — the commented-out `cancel()` in `server/checkout/order.repository.ts` suggests it always was.
  - ⚠️ Every future table has to be classified on the way in — does this row carry money or attribution? Most do not, and the answer is usually quick, but the question is now mandatory rather than occasional.
