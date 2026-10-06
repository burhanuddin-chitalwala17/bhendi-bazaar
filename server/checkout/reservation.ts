/**
 * What the order transaction takes from the catalogue, and the hold it puts on it.
 *
 * Three questions and one command, all on the caller's `tx`: the product facts the order is
 * priced from, the stock rows it allocates across, and the reservation that makes the allocation
 * real. They sit here rather than in `order.service.ts` so catalog is not a reason for that file
 * to change ([ADR-0036](../../docs/adr/0036-a-files-reasons-to-change-are-a-decision.md)), and
 * they go through catalog's services rather than its repositories ([ADR-0033]).
 */

import type { Prisma } from "@prisma/client";

import { productService } from "@server/catalog/product.service";
import { stockService } from "@server/catalog/stock.service";
import { OutOfStockError } from "@server/shared/domain-error";
import { reservationPlan, type AllocatedParcel } from "@server/checkout/allocation";

/** The catalogue rows an order is priced from — read inside the transaction (Invariant 1). */
export async function catalogueFacts(productIds: string[], tx: Prisma.TransactionClient) {
  return await productService.checkoutFacts(productIds, tx);
}

/** Where the stock actually is (active locations only), against the rows this transaction will decrement. */
export async function stockOnHand(productIds: string[], tx: Prisma.TransactionClient) {
  return await stockService.onHandByLocation(productIds, tx);
}

/**
 * Reserve the allocated parcels' stock (Invariant 6, ADR-0007), in `reservationPlan` order so
 * concurrent orders lock rows in one sequence. A miss names the product rather than merely
 * reporting: the caller releases abandoned holds on exactly it and retries once
 * (checkout-abandonment D4).
 */
export async function reserveStock(
  parcels: AllocatedParcel[],
  productNames: ReadonlyMap<string, string>,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const failed = await stockService.reserve(reservationPlan(parcels), tx);
  if (failed === null) return;
  const name = productNames.get(failed) ?? "An item in your order";
  throw new OutOfStockError(
    `"${name}" just sold at its location while you were checking out. Please try again.`,
    [failed],
  );
}
