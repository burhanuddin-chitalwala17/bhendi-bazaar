# ADR-0026: A public product read carries its visibility policy, declared once

- **Date:** 2026-09-19
- **Status:** Accepted

## Context

What a product read *selects* is shared: `PRODUCT_INCLUDE` in `server/catalog/product.repository.ts` is declared once and spread by every method. What a product read *may show* is not. That file holds fifteen separate `where:` blocks, and every public read assembles its own cross-cutting context — `loadPriceContext` appears at thirteen call sites and `loadBiddingLockContext` at six, across nine modules.

The cost is paid per feature, and it compounds. Bidding had to thread "this product cannot be bought" through every read by hand. [org-withdrawal](../specs/org-storefront/org-withdrawal/) would touch roughly twenty files to thread "this organisation is withdrawn" through the same paths, and [storefront-browse](../specs/org-storefront/storefront-browse/) a third rule after it. Nothing fails when one is missed — the query simply returns a row it should not have, which is the failure those features exist to prevent.

The shape of a read is a technical detail and is shared. The policy of a read is a product rule and is not. That is the wrong way round.

## Decision

1. **One clause, declared once.** `PUBLIC_PRODUCT_WHERE` lives beside `PRODUCT_INCLUDE` in its own module and is spread into the `where` of every product query that can reach a buyer — listings, product page, similar products, hero row, offers row, search, suggestions, sitemap.
2. **Visibility is a property of the query, not of the caller.** A page cannot opt out by rendering differently, and no template is trusted to filter.
3. **Public and privileged reads are separated by module, not by flag.** `product.repository.ts` is the public surface and carries the clause; `admin.product.repository.ts` is the privileged one and must not. A boolean parameter that switches visibility on and off would put the decision at the call site, which is where it is being taken away from.
4. **Adding a visibility rule is one edit to the clause**, and reaches every public read at once.
5. **A test asserts that every public read applies it.** The compiler cannot: a missing spread is valid TypeScript producing a valid query. This is the same admission [ADR-0023](0023-bidding-status-stores-only-what-the-clock-cannot-decide.md) makes for bidding, answered here with a check rather than a convention.
6. **Visibility is derived, never denormalised.** It is read from the related row at query time; nothing is written onto `Product` when an organisation is withdrawn or restored, so there is no state to reconcile and no backfill on reactivation.
7. **The clause governs display only.** Anything that must not merely be hidden but *refused* is enforced where the stock guard already is, inside the order transaction — the shape [ADR-0007](0007-conditional-stock-decrement.md) sets and [ADR-0023](0023-bidding-status-stores-only-what-the-clock-cannot-decide.md) follows. Hiding a button has never been a control.

## Alternatives considered

- **Leave the clause at each call site**, as today. Rejected: this is the defect. Fifteen `where` blocks mean fifteen chances to forget, the compiler is silent about all of them, and the cost recurs for every feature that adds a rule.
- **A Prisma client extension or middleware that injects the filter globally.** The textbook answer, and the one a reasonable person reaches for. Rejected because the filter must *not* apply everywhere: the admin console, the org portal, payouts and analytics all legitimately read withdrawn organisations' products, so a global rule would need a bypass — and an invisible filter with an escape hatch is harder to reason about than an explicit clause. It also makes "why is this row missing" a debugging problem with no grep to answer it.
- **A database view of publicly visible products.** Genuinely clean, and it would let Postgres own the rule. Rejected on cost: a migration, a second Prisma model to keep in step with `Product`, and it addresses only the `where` half — the context-assembly half stays exactly as it is.
- **Denormalise onto `Product`** — an `isPubliclyVisible` column written when an organisation changes state. Rejected for the reason [ADR-0023](0023-bidding-status-stores-only-what-the-clock-cannot-decide.md) rejected it for bidding: two sources of truth for one fact, a write on every product when one organisation is withdrawn, and a window during which the copy is wrong.

## Consequences

- ✅ A new visibility rule is one edit. `org-withdrawal` drops from roughly twenty files to the clause plus its enforcement point, and `storefront-browse` gets its scoping nearly free.
- ✅ The rule is greppable and its readers are listed by one search, which is what makes a review of it possible at all.
- ✅ Reactivating an organisation restores everything with no backfill, because nothing was written.
- ⚠️ **A newly written query still has to remember to spread it.** The clause removes the per-rule cost, not the per-query one; the test in decision 5 is the only thing standing behind it, and a test only covers the methods it knows to look at.
- ⚠️ Two reads move from `findUnique` to `findFirst`, since a relation filter cannot ride along with a unique selector. The index still serves them; the dataloader batching `findUnique` allows is lost on those two paths.
- ⚠️ Every public product query now joins `Org`. The join is on an indexed foreign key and these queries already join `Org` for the seller summary, so the added cost is a filter rather than a new join — but it is no longer optional.
