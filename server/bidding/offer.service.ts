/**
 * The offer chain after an auction ends (winner-offer, ADR-0041).
 *
 * `advance` is the one routine that moves a chain. The end-of-auction job, the hourly sweep,
 * a decline and an admin all call it, and it decides from rows it has locked, so whichever
 * trigger arrives first does the step and the rest find nothing to do (winner-offer D4).
 *
 * Reaches `checkout` to ask about orders on an offer and `payments` to release an abandoned
 * one; what the chain says to people is in `offer-notify.ts` (ADR-0036). Never another
 * domain's repository (ADR-0033).
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@server/shared/prisma";
import { recordAdminActionIn } from "@server/shared/audit/audit.service";
import { ConflictError, NotFoundError } from "@server/shared/domain-error";
import { biddingRepository } from "@server/bidding/bidding.repository";
import { bidOfferRepository, type OfferRecord, type OfferWithItem } from "@server/bidding/bid-offer.repository";
import { isActionable, isOpenStatus, nextStep, offerExpiry } from "@server/bidding/offer-chain";
import { hashOfferToken, OFFER_TOKEN_PATTERN } from "@server/bidding/offer-token";
import { alertStore, sendOfferEmail } from "@server/bidding/offer-notify";
import type { OfferChainEntry, OfferView } from "@server/bidding/bidding.types";
import { orderService } from "@server/checkout/order.service";
import { paymentService } from "@server/payments/payment.service";

/** How many events one sweep moves. The sweep runs hourly; a backlog larger than this is an incident, not a load. */
const SWEEP_LIMIT = 50;

/** An unsent offer younger than this may still be mid-send from the step that opened it; the sweep leaves it alone. */
const RESEND_AFTER_MS = 5 * 60_000;

export type AdvanceOutcome =
  | { kind: "idle" }
  | { kind: "held"; offerId: string }
  | { kind: "offered"; offerId: string }
  | { kind: "exhausted" };

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

export class OfferService {
  /**
   * Take the next step in one event's chain, if one is due.
   *
   * A lapsed offer with an unpaid order still on it is left alone: a payment begun before the
   * deadline may still be captured (winner-offer R13), and the payments sweep resolves that
   * order to paid or released before the next pass here.
   */
  async advance(eventId: string, now: Date = new Date()): Promise<AdvanceOutcome> {
    await this.releaseAbandonedAttempts(eventId, now);

    let outcome: AdvanceOutcome;
    try {
      outcome = await prisma.$transaction(async (tx) => {
        const event = await biddingRepository.lockForChain(eventId, tx);
        if (
          !event ||
          event.status !== "OPEN" ||
          event.claimWindowHours === null ||
          event.bidCount === 0 ||
          now < event.endAt
        ) {
          return { kind: "idle" } as const;
        }

        const offers = await bidOfferRepository.forEvent(eventId, tx);
        const open = offers.find((offer) => isOpenStatus(offer.status));
        if (open) {
          if (isActionable(open, now)) return { kind: "idle" } as const;
          // Unpaid and still moving, or paid and not yet recorded: either way the item may be sold.
          const unpaid = await orderService.openOrdersForOffer(open.id, tx);
          const paid = await orderService.paidOrdersForOffers([open.id]);
          if (unpaid.length > 0 || paid.length > 0) return { kind: "held", offerId: open.id } as const;
          if (!(await bidOfferRepository.lapse(open.id, now, tx))) return { kind: "idle" } as const;
        }

        const ladder = await biddingRepository.chainLadder(eventId, tx);
        const offered = offers.map((offer) => offer.bid);
        let sequence = offers.reduce((max, offer) => Math.max(max, offer.sequence), 0);

        for (;;) {
          const step = nextStep(ladder, offered);
          if (step.kind === "exhausted") {
            await biddingRepository.markUnsold(
              { id: eventId, reason: "No bidder completed the purchase", adminId: null, now },
              tx
            );
            return { kind: "exhausted" } as const;
          }

          sequence += 1;
          if (step.kind === "skip") {
            await bidOfferRepository.insert(
              { eventId, bidId: step.bid.id, sequence, status: "SKIPPED", expiresAt: null },
              tx
            );
            offered.push(step.bid);
            continue;
          }

          const offer = await bidOfferRepository.insert(
            {
              eventId,
              bidId: step.bid.id,
              sequence,
              status: "OFFERED",
              expiresAt: offerExpiry(now, event.claimWindowHours),
            },
            tx
          );
          return { kind: "offered", offerId: offer.id } as const;
        }
      });
    } catch (error) {
      // Another trigger took this step first; the partial unique index said so.
      if (isUniqueViolation(error)) return { kind: "idle" };
      throw error;
    }

    if (outcome.kind === "exhausted") void alertStore(eventId, "no bidder completed the purchase");
    // Sent now, from whichever process took the step — the worker at the auction's end, or the
    // request that declined or withdrew. After the commit, so a failed send never undoes the
    // offer; the sweep resends one that did not go out (winner-offer D10).
    if (outcome.kind === "offered") await this.sendQuietly(outcome.offerId);
    return outcome;
  }

  /**
   * The backstop: chains the end-of-auction job missed, offers past their deadline, and paid
   * orders whose completion did not record. Each is idempotent, so a repeat is a no-op.
   */
  async sweep(now: Date = new Date()): Promise<{ advanced: number; completed: number }> {
    const [unstarted, lapsed] = await Promise.all([
      biddingRepository.awaitingFirstOffer(now, SWEEP_LIMIT),
      bidOfferRepository.eventsWithLapsedOffers(now, SWEEP_LIMIT),
    ]);

    for (const offerId of await bidOfferRepository.unsentOpenOffers(
      new Date(now.getTime() - RESEND_AFTER_MS),
      SWEEP_LIMIT
    )) {
      await this.sendQuietly(offerId);
    }

    let completed = 0;
    const accepted = await bidOfferRepository.acceptedOfferIds(SWEEP_LIMIT);
    for (const order of await orderService.paidOrdersForOffers(accepted)) {
      if (await this.completeFromPaidOrder(order.id, order.bidOfferId, now)) completed += 1;
    }

    let advanced = 0;
    for (const eventId of new Set([...unstarted, ...lapsed])) {
      try {
        const result = await this.advance(eventId, now);
        if (result.kind !== "idle" && result.kind !== "held") advanced += 1;
      } catch (error) {
        // One event's failure must not stop the others; it is retried next hour.
        console.error(`[bidding] advancing ${eventId} failed`, error);
      }
    }
    return { advanced, completed };
  }

  async view(token: string, now: Date = new Date()): Promise<OfferView> {
    const offer = await this.findByToken(token);
    return {
      state: this.stateOf(offer, now),
      closedReason: this.closedReasonOf(offer, now),
      amountPaise: offer.bid.amountPaise,
      expiresAt: offer.expiresAt,
      serverNow: now,
      bidderName: offer.bidderName,
      eventSlug: offer.event.slug,
      product: {
        id: offer.event.product.id,
        slug: offer.event.product.slug,
        name: offer.event.product.name,
        thumbnail: offer.event.product.thumbnail,
      },
      size: offer.event.size,
      color: offer.event.color,
    };
  }

  /**
   * Before a fresh checkout attempt, release this offer's abandoned ones, so a winner whose
   * tab died mid-payment is not blocked by their own attempt (winner-offer R17). The gateway
   * is asked first: a payment still moving is left alone, and a captured one confirms.
   */
  async releaseAttemptsBeforeCheckout(token: string): Promise<void> {
    const offer = await this.findByToken(token);
    for (const order of await orderService.openOrdersForOffer(offer.id)) {
      try {
        await paymentService.releaseIfUnpaid(order.id);
      } catch (error) {
        console.error(`[bidding] could not release order ${order.id} before a new attempt`, error);
      }
    }
  }

  /** Idempotent: accepting an accepted offer is success, so a double tap is not an error. */
  async accept(token: string, now: Date = new Date()): Promise<OfferView> {
    const offer = await this.findByToken(token);
    if (!(await bidOfferRepository.accept(offer.id, now))) {
      const fresh = await this.findByToken(token);
      if (!(fresh.status === "ACCEPTED" && isActionable(fresh, now))) {
        throw new ConflictError("This offer has closed and can no longer be accepted.");
      }
    }
    return await this.view(token, now);
  }

  async decline(token: string, now: Date = new Date()): Promise<OfferView> {
    const offer = await this.findByToken(token);
    await prisma.$transaction(async (tx) => {
      if (!(await bidOfferRepository.decline(offer.id, now, tx))) {
        throw new ConflictError("This offer has already closed.");
      }
      if ((await orderService.openOrdersForOffer(offer.id, tx)).length > 0) {
        throw new ConflictError(
          "A payment for this item is in progress. If you closed the payment window, wait a few minutes and try again."
        );
      }
    });
    await this.advanceQuietly(offer.eventId, now);
    return await this.view(token, now);
  }

  /**
   * The sale completed: the offer is PAID and the event SOLD at the bid. Called after the paid
   * transition (not inside it), so idempotent, and never throws: the money is already taken.
   */
  async completeFromPaidOrder(orderId: string, offerId: string, now: Date = new Date()): Promise<boolean> {
    try {
      const offer = await bidOfferRepository.byId(offerId);
      if (!offer) return false;
      if (offer.status === "PAID") return false;

      const completed = await prisma.$transaction(async (tx) => {
        // The event first, as `advance` takes it, so the two cannot deadlock on each other's rows.
        await biddingRepository.lockForChain(offer.eventId, tx);
        if (!(await bidOfferRepository.markPaid(offerId, now, tx))) return false;
        const sold = await biddingRepository.markSoldFromOffer(
          { id: offer.eventId, bidId: offer.bid.id, amountPaise: offer.bid.amountPaise, now },
          tx
        );
        if (!sold) throw new ConflictError("The auction already has an outcome");
        return true;
      });
      if (!completed) {
        void alertStore(offer.eventId, `order ${orderId} was paid on offer ${offerId}, which had already closed — it needs a refund or a manual sale`);
      }
      return completed;
    } catch (error) {
      console.error(`[bidding] completing offer ${offerId} from order ${orderId} failed; the sweep will retry`, error);
      return false;
    }
  }

  /** The chain as the platform sees it, in order (winner-offer R22). */
  async chainFor(eventId: string, now: Date = new Date()): Promise<OfferChainEntry[]> {
    const offers = await bidOfferRepository.forEvent(eventId);
    return offers.map((offer) => ({
      id: offer.id,
      sequence: offer.sequence,
      status: offer.status,
      isLive: isActionable(offer, now),
      amountPaise: offer.bid.amountPaise,
      bidderName: offer.bidderName,
      bidderEmail: offer.bid.email,
      bidderPhone: offer.bidderPhone,
      expiresAt: offer.expiresAt,
      emailSentAt: offer.emailSentAt,
      respondedAt: offer.respondedAt,
      closedAt: offer.closedAt,
      createdAt: offer.createdAt,
    }));
  }

  /** End the current offer early and move on (winner-offer R23). */
  async withdrawCurrent(eventId: string, adminId: string, now: Date = new Date()): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const event = await biddingRepository.lockForChain(eventId, tx);
      if (!event) throw new NotFoundError("Bidding event not found");
      const open = await this.closeOpenOfferAsAdmin(eventId, adminId, now, tx);
      if (!open) throw new ConflictError("No offer is open on this auction.");
      await recordAdminActionIn(tx, {
        adminId,
        action: "BIDDING_OFFER_WITHDRAWN",
        resource: "BiddingEvent",
        resourceId: eventId,
        metadata: { offerId: open.id, bidId: open.bid.id, sequence: open.sequence },
      });
    });
    await this.advanceQuietly(eventId, now);
  }

  /** Stop the chain and record the auction unsold (winner-offer R23, bidding R39a). */
  async stopChain(eventId: string, adminId: string, reason: string | null, now: Date = new Date()): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const event = await biddingRepository.lockForChain(eventId, tx);
      if (!event) throw new NotFoundError("Bidding event not found");
      const open = await this.closeOpenOfferAsAdmin(eventId, adminId, now, tx);
      if (!(await biddingRepository.markUnsold({ id: eventId, reason, adminId, now }, tx))) {
        throw new ConflictError("An outcome has already been recorded for this event");
      }
      await recordAdminActionIn(tx, {
        adminId,
        action: "BIDDING_CLOSED_UNSOLD",
        resource: "BiddingEvent",
        resourceId: eventId,
        metadata: { withdrawnOfferId: open?.id ?? null, reason },
      });
    });
  }

  private async closeOpenOfferAsAdmin(
    eventId: string,
    adminId: string,
    now: Date,
    tx: Prisma.TransactionClient
  ): Promise<OfferRecord | null> {
    const open = (await bidOfferRepository.forEvent(eventId, tx)).find((offer) => isOpenStatus(offer.status));
    if (!open) return null;
    if ((await orderService.openOrdersForOffer(open.id, tx)).length > 0) {
      throw new ConflictError(
        "The bidder has a payment in progress. Wait for it to finish or be released, then try again."
      );
    }
    if (!(await bidOfferRepository.withdraw(open.id, adminId, now, tx))) {
      throw new ConflictError("That offer has just closed. Reload to see the chain.");
    }
    return open;
  }

  private async findByToken(token: string): Promise<OfferWithItem> {
    const offer = OFFER_TOKEN_PATTERN.test(token)
      ? await bidOfferRepository.byTokenHash(hashOfferToken(token))
      : null;
    if (!offer) throw new NotFoundError("This offer link is not valid");
    return offer;
  }

  private stateOf(offer: OfferRecord, now: Date): OfferView["state"] {
    if (offer.status === "PAID") return "paid";
    if (!isActionable(offer, now)) return "closed";
    return offer.status === "ACCEPTED" ? "accepted" : "open";
  }

  private closedReasonOf(offer: OfferRecord, now: Date): OfferView["closedReason"] {
    switch (offer.status) {
      case "DECLINED":
        return "declined";
      case "WITHDRAWN":
        return "withdrawn";
      case "SKIPPED":
        return "skipped";
      case "LAPSED":
        return "expired";
      case "PAID":
        return null;
      default:
        return isActionable(offer, now) ? null : "expired";
    }
  }

  /**
   * Once an offer's deadline has passed, ask the gateway about each unpaid attempt still on
   * it: captured ones confirm, abandoned ones release, and only a payment genuinely moving
   * keeps holding the chain. Without this an attempt the browser never released would hold
   * the next bidder up until the payments sweep, which runs daily (winner-offer D7).
   */
  private async releaseAbandonedAttempts(eventId: string, now: Date): Promise<void> {
    const open = (await bidOfferRepository.forEvent(eventId)).find((offer) => isOpenStatus(offer.status));
    if (!open || isActionable(open, now)) return;
    for (const order of await orderService.openOrdersForOffer(open.id)) {
      try {
        await paymentService.releaseIfUnpaid(order.id);
      } catch (error) {
        console.error(`[bidding] could not release order ${order.id} on offer ${open.id}`, error);
      }
    }
  }

  private async sendQuietly(offerId: string): Promise<void> {
    try {
      await sendOfferEmail(offerId);
    } catch (error) {
      console.error(`[bidding] offer ${offerId} email failed; the sweep will resend it`, error);
    }
  }

  /** A follow-on step after a decision that has already committed; the sweep catches a failure. */
  private async advanceQuietly(eventId: string, now: Date): Promise<void> {
    try {
      await this.advance(eventId, now);
    } catch (error) {
      console.error(`[bidding] advancing ${eventId} failed; the sweep will retry`, error);
    }
  }
}

export const offerService = new OfferService();
