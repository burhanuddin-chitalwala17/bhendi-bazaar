/**
 * Refusing a purchase of something the org has archived (ADR-0029 decision 4).
 *
 * The same three-part shape bidding uses — pure rules in `product.visibility.ts`, the
 * query in the repository, the gate here — so nothing but a repository reads the
 * aggregate (Invariant 5). Listing filters are presentation; this is the control.
 */

import { productsRepository, type ProductDb } from "@server/catalog/product.repository";
import { ConflictError } from "@server/shared/domain-error";

/**
 * Refuse a purchase of anything the org has archived.
 *
 * Throws rather than returning a flag: every caller's correct response is to abandon
 * the write, and inside a transaction that is what a throw does — the same shape, and
 * the same reasoning, as `assertNotUnderBidding`.
 *
 * Call it *inside* the order transaction and *after* the stock reservation. The
 * reservation takes the row lock that archiving also takes, so an archive committed
 * elsewhere is either already visible here and refused, or still queued behind this
 * transaction and lands after the order stands. One of the two wins.
 */
export async function assertNotArchived(
  productIds: string[],
  db?: ProductDb
): Promise<void> {
  const archived = await productsRepository.archivedAmong(productIds, db);
  if (archived.length === 0) return;
  throw new ConflictError(
    archived.length === 1
      ? `${archived[0]} is no longer available.`
      : `${archived.length} items in your order are no longer available: ${archived.join(", ")}.`
  );
}
