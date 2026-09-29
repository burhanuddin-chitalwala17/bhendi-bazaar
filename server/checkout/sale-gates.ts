import type { Prisma } from "@prisma/client";

import { assertNotUnderBidding } from "@server/bidding/bidding-lock";
import type { OfferClaim } from "@server/bidding/bidding.types";

/**
 * The accepted auction offer an order buys, locked for this transaction (ADR-0041). Reached
 * through here, where checkout already meets bidding, so the order service gains no domain.
 */
export { claimOfferForCheckout } from "@server/bidding/offer-claim";
import { assertNotArchived } from "@server/catalog/product.sale-gate";
import { assertOrgNotWithdrawn } from "@server/catalog/org.sale-gate";

/**
 * Every reason a product may not be bought right now, asked as one question.
 *
 * The three refusals arrived separately — bidding ([ADR-0023]), archiving
 * ([ADR-0029]) and org withdrawal ([ADR-0030]) — and each was added to the order
 * transaction where the previous one sat. They are one concept: *is this line still
 * saleable at the instant we are about to take the money.* Naming it here is what lets
 * `order.service.ts` stop importing two other domains to ask it, and what gives the next
 * such rule an obvious home instead of another line in a 400-line method.
 *
 * **Call this after the stock reservation, never before.** The reservation takes the row
 * lock on the product's stock, and opening a bidding event takes the same lock — so
 * asking afterwards means a competing event is either already visible here and refused,
 * or still blocked behind our lock and will see the stock we just took. Asking first
 * leaves a window where both succeed and an item sells while it is under auction.
 *
 * This is also the *only* point that can refuse. Filtering a listing is presentation and
 * removing a button is not a control: a cart filled before the withdrawal, a page
 * rendered a minute ago, or a request typed by hand all arrive here regardless.
 */
export async function assertLinesAreSaleable(
  productIds: string[],
  now: Date,
  tx: Prisma.TransactionClient,
  /** An accepted auction offer this order buys; lets that auction's own winner through (ADR-0041 D3). */
  claim?: Pick<OfferClaim, "eventId">,
): Promise<void> {
  await assertNotUnderBidding(productIds, now, tx, claim);
  await assertNotArchived(productIds, tx);
  await assertOrgNotWithdrawn(productIds, tx);
}
