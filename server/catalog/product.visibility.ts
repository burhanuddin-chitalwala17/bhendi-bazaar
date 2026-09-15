/**
 * Whether a product is on sale — one definition, spread by every query that answers
 * to a buyer ([ADR-0026](../../docs/adr/0026-a-product-leaves-sale-by-archiving-not-deletion.md) decision 3).
 *
 * Pure, and deliberately free of Prisma: the fragments are spread by the repositories,
 * so a query here would be a third module reading the Product aggregate (Invariant 5).
 * The enforcement that uses them lives in `product.sale-gate.ts`, and the census in
 * `tests/unit/product-visibility.test.ts` records which reads spread them and which
 * deliberately do not.
 */

import type { Prisma } from "@prisma/client";

/** A product a buyer may see and buy. */
export const ON_SALE = { archivedAt: null } satisfies Prisma.ProductWhereInput;

/** Archived only — the org portal's "Withdrawn" filter. */
export const ARCHIVED = { archivedAt: { not: null } } satisfies Prisma.ProductWhereInput;

/** Which shelf an org is asking about. `all` spreads nothing. */
export type ProductShelf = "on-sale" | "archived" | "all";

export function shelfFilter(shelf: ProductShelf = "on-sale"): Prisma.ProductWhereInput {
  switch (shelf) {
    case "on-sale":
      return ON_SALE;
    case "archived":
      return ARCHIVED;
    case "all":
      return {};
  }
}
