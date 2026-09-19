/**
 * What makes a product visible to a buyer, as one clause (ADR-0026).
 *
 * Spread into the `where` of every product query that can reach the public. The
 * counterpart of `PRODUCT_INCLUDE`: that one is declared once because the *shape* of a
 * read is shared, this one because its *policy* is — and policy was the half being
 * copied into fifteen separate `where` blocks, where a rule added for one feature had
 * to be remembered fourteen more times.
 *
 * Not applied by a Prisma extension: the admin console, the org portal, payouts and
 * analytics all legitimately read products this clause hides, so a global filter would
 * need a bypass, and an invisible rule with an escape hatch is worse to reason about
 * than an explicit spread (ADR-0026, alternatives).
 *
 * Display only. Anything that must be *refused* rather than hidden belongs inside the
 * order transaction beside the stock guard, which is the only race-safe point in the
 * codebase (ADR-0007, ADR-0023).
 */

import type { Prisma } from "@prisma/client";

/**
 * A product is public when its selling organisation is.
 *
 * Derived from the org row on every read, never copied onto `Product`: withdrawing an
 * organisation writes nothing to its catalogue, so restoring it needs no backfill and
 * there is no window in which a copy disagrees (ADR-0026 decision 6).
 *
 * `Org.isActive` is the platform's one withdrawal switch — see the org-withdrawal spec.
 * Until this clause shipped it was read by nothing a buyer could see.
 */
export const PUBLIC_PRODUCT_WHERE = {
  org: { isActive: true },
} satisfies Prisma.ProductWhereInput;

/**
 * The same rule expressed for a query whose root is not `Product` — a cart line, a
 * wishlist row, an order item. Kept beside the clause it mirrors so the two cannot
 * drift into disagreeing about what "public" means.
 */
export const PUBLIC_PRODUCT_RELATION_WHERE = {
  product: PUBLIC_PRODUCT_WHERE,
} satisfies { product: Prisma.ProductWhereInput };
