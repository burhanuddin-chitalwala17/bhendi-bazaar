/**
 * Whether a product is available to buy — one definition, spread by every query that answers
 * to a buyer ([ADR-0029](../../docs/adr/0029-a-product-leaves-sale-by-archiving-not-deletion.md) decision 3).
 *
 * Pure, and deliberately free of Prisma: the fragments are spread by the repositories,
 * so a query here would be a third module reading the Product aggregate (Invariant 5).
 * The enforcement that uses them lives in `product.sale-gate.ts`, and the census in
 * `tests/unit/product-visibility.test.ts` records which reads spread them and which
 * deliberately do not.
 */

import type { Prisma } from "@prisma/client";

/** A product a buyer may see and buy. */
export const AVAILABLE = { archivedAt: null } satisfies Prisma.ProductWhereInput;

/**
 * A product whose selling organisation is still trading.
 *
 * The org-level counterpart of `AVAILABLE`: that one asks whether the *product* was
 * archived, this one whether the *shop* was withdrawn — two different acts, which is
 * why they read as two different words. Both are spread together by the reads a
 * buyer can reach — an active org's archived product and a withdrawn org's live product
 * are equally unbuyable, and neither is expressed by the other.
 *
 * Derived from the org row on every read, never copied onto `Product`: withdrawing an
 * organisation writes nothing to its catalogue, so restoring it needs no backfill.
 * `Org.isActive` is the platform's one withdrawal switch — see the org-withdrawal spec.
 */
export const FROM_ACTIVE_ORG = {
  org: { isActive: true, isBlocked: false },
} satisfies Prisma.ProductWhereInput;

/** Archived only — the org portal's "Archived" filter. */
export const ARCHIVED = { archivedAt: { not: null } } satisfies Prisma.ProductWhereInput;

/** Which shelf an org is asking about. `all` spreads nothing. */
export type ProductShelf = "available" | "archived" | "all";

export function shelfFilter(shelf: ProductShelf = "available"): Prisma.ProductWhereInput {
  switch (shelf) {
    case "available":
      return AVAILABLE;
    case "archived":
      return ARCHIVED;
    case "all":
      return {};
  }
}
