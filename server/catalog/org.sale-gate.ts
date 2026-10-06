/**
 * Refusing a purchase from an organisation the platform has withdrawn
 * (org-storefront/org-withdrawal R5, ADR-0030 decision 10).
 *
 * The org-level counterpart of `product.sale-gate.ts`, deliberately the same shape:
 * pure rules in `product.visibility.ts`, the query in the repository, the refusal here.
 * `FROM_ACTIVE_ORG` already stops a withdrawn shop's goods being listed; a listing
 * filter is presentation, and a buyer holding a link or a basket filled before the
 * withdrawal is exactly who it does not reach.
 */

import {
  productsRepository,
  type ProductDb,
} from "@server/catalog/product.read.repository";
import { ConflictError } from "@server/shared/domain-error";

/**
 * Refuse a purchase of anything sold by a withdrawn organisation.
 *
 * Call it *inside* the order transaction and *after* the stock reservation, for the
 * reason `assertNotArchived` documents: the reservation takes the row lock, so a
 * withdrawal committed elsewhere is either already visible here and refused, or lands
 * after the order stands. One of the two wins, and never both.
 *
 * The message says the shop is unavailable rather than that the item is gone — a
 * withdrawal is usually temporary and the item itself is fine.
 */
export async function assertOrgNotWithdrawn(
  productIds: string[],
  db?: ProductDb,
): Promise<void> {
  const withdrawn = await productsRepository.fromWithdrawnOrgAmong(
    productIds,
    db,
  );
  if (withdrawn.length === 0) return;
  throw new ConflictError(
    withdrawn.length === 1
      ? `${withdrawn[0]} is from a shop that is not currently open for orders.`
      : `${withdrawn.length} items in your order are from shops that are not currently open for orders: ${withdrawn.join(", ")}.`,
  );
}
