# ADR-0032: A record a person authored is retired, never deleted

- **Date:** 2026-09-23
- **Status:** Accepted
- **Supersedes:** —
- **Related:** [ADR-0020](0020-money-bearing-records-never-cascade.md), [ADR-0029](0029-a-product-leaves-sale-by-archiving-not-deletion.md), [ADR-0021](0021-audit-trail-never-fails-the-action.md), [product-reviews](../specs/product-reviews/spec.md)

## Context

[ADR-0029](0029-a-product-leaves-sale-by-archiving-not-deletion.md) settled this for products
and [ADR-0020](0020-money-bearing-records-never-cascade.md) settled it for anything carrying
money. Nothing settled it in general, so each new aggregate re-argued it and reviews
came out the other way: the moderation queue hard-deleted a buyer's words and their
photographs, and `Review.userId` was nullable with `onDelete: SetNull` — a column shaped
for deleting the people who wrote them.

That nullable key was not free. It bought an "anonymous voice" branch in the rating
arithmetic, a `viewerId !== null` guard so `null === null` could not make a stranger's
review look like yours, and a nullable `userId` in every projection — three pieces of
defensive code for a state the platform does not actually permit.

Reviews also had one boolean, `isApproved`, standing for two unrelated acts. Nothing ever
approved a review — they publish on write — and when an author deleted their own, the row
was destroyed rather than marked, so the queue could not tell "we took this down" from
"they took it back".

## Decision

1. **A record that carries attribution — who said or did this — is retired by a
   timestamp, never destroyed.** Reviews, users, orders, products. The row keeps its
   author and its content; what changes is who can see it.

2. **Each way a record can be retired gets its own column.** A review has `withdrawnAt`
   (the platform took it down) *and* `deletedAt` (the author took it back). They are
   different acts, by different people, with different remedies, and one boolean cannot
   report which happened. Restoring a withdrawal must not un-retract someone's words.

3. **`NULL` is the live state, and a restore returns it to `NULL`** — the shape
   `Product.archivedAt` already uses, so there is one idiom rather than two.

4. **A user is deactivated, never deleted** (`User.deactivatedAt`). Separate from
   `isBlocked`, which is the platform shutting someone out: a banned account and a closed
   one need different answers, and an admin panel that cannot tell them apart can act on
   neither. Foreign keys pointing at a user are therefore `Restrict`, not `SetNull`.

5. **One exported predicate per aggregate decides visibility**, spread by every read a
   buyer reaches — `VISIBLE_REVIEW_WHERE` beside the catalogue's `ON_SALE` and
   `FROM_ACTIVE_ORG`. Two reasons to hide a row means a read path that remembers one and
   forgets the other shows content that was taken down.

6. **The buyer's control says *Delete*; the platform's says what it did.** A buyer means
   "stop showing my name on this", and *Delete* is the honest word for the outcome they
   get — it leaves the product page, the list, the count, the average and the org portal
   at once. Calling it *Archive* would suggest they can get it back. The admin console
   says **Withdrawn** or **Deleted by author**, because the platform is the audience that
   needs to know which act occurred. Retention is a privacy-policy statement, not a label
   on a button.

7. **The narrow hard-delete carve-out of [ADR-0029](0029-a-product-leaves-sale-by-archiving-not-deletion.md)
   survives, and generalises**: a row that nothing references *and* that was never real —
   a mistyped SKU, a bad import line — may still be destroyed, because that is discarding
   a mistake rather than retiring a record. It must refuse whenever anything depends on
   it. No such path exists for reviews: a review is always something a person said.

## Consequences

- Reviews accumulate for ever, and so do their objects in R2. Accepted deliberately: no
  reaping job, and the photographs of a withdrawn or retracted review stay reachable at
  their URLs. That is the honest cost of keeping the record, and it is recorded here
  rather than hidden behind a label. Revisit when storage says so, not before.
- `Review.userId` becoming `NOT NULL` is refused rather than repaired by the migration if
  author-less rows exist. Guessing an author is worse than stopping.
- The admin console loses its delete control entirely. What it gains is a detail view,
  because a queue that could not show a review could not moderate one either.
- A `user.delete()` anywhere is now a bug that Postgres will catch, since the keys are
  `Restrict`. Account closure has to go through `deactivatedAt`.

## Alternatives considered

- **One `isVisible` boolean.** Smallest change, and it loses exactly the thing the rule
  exists to preserve: which act hid the row, and therefore who may unhide it.
- **Purge soft-deleted rows after a retention window.** Rejected for now. It reintroduces
  the destruction this ADR removes, and the audit log would end up pointing at rows that
  no longer exist. A media-only purge remains available later; nothing here forecloses it.
- **Keep `isApproved` and add `deletedAt`.** Rejected: leaving a column named for a
  workflow that does not exist is how the org portal came to tell sellers a withdrawn
  review was "awaiting moderation".
