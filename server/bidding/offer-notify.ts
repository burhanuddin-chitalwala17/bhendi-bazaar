/**
 * Everything the offer chain says to people: the offer email, the in-app nudge, and the
 * store's alert. Its own file so `offer.service.ts` reaches only checkout and payments
 * (ADR-0036); this one reaches notifications.
 */

import { appUrl } from "@server/shared/app-url";
import { biddingRepository } from "@server/bidding/bidding.repository";
import { bidOfferRepository } from "@server/bidding/bid-offer.repository";
import { isActionable } from "@server/bidding/offer-chain";
import { hashOfferToken, mintOfferToken } from "@server/bidding/offer-token";
import { NOTIFICATION_TYPE } from "@server/notifications/in-app.types";

function optionLabel(size: string | null, color: string | null): string | null {
  const parts = [size ? `Size ${size}` : null, color].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * Email one offer to the bidder's own address — their account's, or the one a guest gave.
 * Called the moment the offer opens. The link token is minted here and only its hash is
 * stored, so the plaintext is in no table (winner-offer D9). Throws on a failed send; the
 * sweep resends, minting a new token, so only the delivered link works.
 */
export async function sendOfferEmail(offerId: string, now: Date = new Date()): Promise<void> {
  const offer = await bidOfferRepository.byId(offerId);
  if (!offer || offer.emailSentAt || !isActionable(offer, now) || !offer.bid.email || !offer.expiresAt) return;
  const event = await biddingRepository.chainEvent(offer.eventId);
  if (!event?.claimWindowHours) return;

  const token = mintOfferToken();
  if (!(await bidOfferRepository.attachToken(offer.id, hashOfferToken(token)))) return;

  const { emailService } = await import("@server/notifications/email.service");
  await emailService.sendBidOfferEmail(offer.bid.email, {
    bidderName: offer.bidderName,
    productName: offer.event.product.name,
    option: optionLabel(offer.event.size, offer.event.color),
    amountPaise: offer.bid.amountPaise,
    expiresAt: offer.expiresAt,
    claimWindowHours: event.claimWindowHours,
    offerUrl: `${appUrl()}/bid-offer/${token}`,
  });
  await bidOfferRepository.markEmailSent(offer.id, new Date());
  console.log(`[bidding] offer ${offerId} emailed`);

  if (offer.bid.userId) {
    // Points at the auction, not the offer: a notification row is no place for the link's token.
    const { inAppNotificationService } = await import("@server/notifications/in-app.service");
    inAppNotificationService
      .notifyUser({
        userId: offer.bid.userId,
        title: "You won — check your email",
        message: `${offer.event.product.name} is yours to buy. The link to accept and pay is in your email.`,
        type: NOTIFICATION_TYPE.BID_OFFER,
        link: `/bid/${offer.event.slug}`,
      })
      .catch((err) => console.error("Failed to send offer in-app notification:", err));
  }
}

/** Tell the store something about an auction needs a person. Never throws: it follows a decision already made. */
export async function alertStore(eventId: string, what: string): Promise<void> {
  try {
    const event = await biddingRepository.chainEvent(eventId);
    const { emailService } = await import("@server/notifications/email.service");
    await emailService.sendBiddingAlert(`auction ${event?.slug ?? eventId}`, [
      `Auction ${event?.slug ?? eventId}: ${what}.`,
      `Review it at ${appUrl()}/admin/bidding/${eventId}`,
    ]);
  } catch (error) {
    console.error(`[bidding] could not alert the store about ${eventId}`, error);
  }
}
