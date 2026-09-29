import type { Prisma } from "@prisma/client";
import { ConflictError } from "@server/shared/domain-error";
import { bidOfferRepository } from "@server/bidding/bid-offer.repository";
import { hashOfferToken, OFFER_TOKEN_PATTERN } from "@server/bidding/offer-token";
import type { OfferClaim } from "@server/bidding/bidding.types";

/**
 * Claim an accepted offer inside the order transaction — the only way an order line is
 * priced from anything but the catalogue (ADR-0041 D2).
 *
 * The offer row is locked here, so two checkout attempts on one offer take turns, and the
 * clock is in the lock's `where`: an offer past its deadline claims nothing (winner-offer R13).
 * Its own file, importing only the repository, because `order.service.ts` imports it and the
 * offer service imports checkout.
 */
export async function claimOfferForCheckout(
  token: string,
  now: Date,
  tx: Prisma.TransactionClient
): Promise<OfferClaim> {
  const locked = OFFER_TOKEN_PATTERN.test(token)
    ? await bidOfferRepository.lockForCheckout(hashOfferToken(token), now, tx)
    : null;
  const offer = locked ? await bidOfferRepository.byId(locked.id, tx) : null;
  if (!offer) {
    throw new ConflictError(
      "This offer can no longer be paid for. It may have expired or been declined — check the offer link."
    );
  }
  return {
    offerId: offer.id,
    eventId: offer.eventId,
    productId: offer.event.product.id,
    size: offer.event.size,
    color: offer.event.color,
    amountPaise: offer.bid.amountPaise,
  };
}
