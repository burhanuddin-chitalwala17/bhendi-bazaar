/**
 * The platform's side of bidding: the ladder, and recording what happened.
 *
 * Not a separate admin domain — an event list is a query on `bidding`, kept as an
 * `admin.*` file inside it (root CLAUDE.md). This is the only module that hands out a
 * bidder's name and number, and every entry point to it sits behind the platform-admin
 * guard (spec R37).
 *
 * Recording a sale is the one place in this feature where money moves. It is written
 * as a single transaction on purpose: the event's transition to SOLD, the unit leaving
 * stock, the organisation's ledger entry and the audit line either all happen or none
 * of them do. Any subset of those is a worse state than the failure.
 */

import { prisma } from "@server/shared/prisma";
import { biddingRepository } from "@server/bidding/bidding.repository";
import { biddingPhase } from "@server/bidding/bidding-window";
import { productsRepository } from "@server/catalog/product.repository";
import { ledgerService } from "@server/payouts/ledger.service";
import { recordAdminActionIn } from "@server/shared/audit/audit.service";
import { ConflictError, DomainError, NotFoundError } from "@server/shared/domain-error";
import type {
  AdminBiddingDetail,
  ConfirmSaleInput,
  OrgBiddingSummary,
} from "@server/bidding/bidding.types";

export class AdminBiddingService {
  async list(): Promise<(OrgBiddingSummary & { orgName: string })[]> {
    return await biddingRepository.listAll(new Date());
  }

  /** One event with its full ladder — amounts, and who placed them (spec R37). */
  async detail(id: string): Promise<AdminBiddingDetail> {
    const now = new Date();
    const row = await biddingRepository.detailForAdmin(id);
    if (!row) throw new NotFoundError("Bidding event not found");
    const ladder = await biddingRepository.ladder(id);

    return {
      id: row.id,
      slug: row.slug,
      status: row.status,
      phase: biddingPhase(row, now),
      orgId: row.orgId,
      orgName: row.org.name,
      startAt: row.startAt,
      endAt: row.endAt,
      startingBidPaise: row.startingBidPaise,
      maxIncreasePaise: row.maxIncreasePaise,
      quickBidsPaise: row.quickBidsPaise,
      highestBidPaise: row.highestBidPaise,
      bidCount: row.bidCount,
      soldAmountPaise: row.soldAmountPaise,
      soldBidId: row.soldBidId,
      soldReason: row.soldReason,
      settledAt: row.settledAt,
      createdAt: row.createdAt,
      ladder,
      product: {
        id: row.product.id,
        slug: row.product.slug,
        name: row.product.name,
        thumbnail: row.product.thumbnail,
        referencePricePaise: row.referencePricePaise,
        size: row.size,
        color: row.color,
      },
    };
  }

  /** Where a unit could be taken from, for the confirmation form. */
  async stockLocations(eventId: string) {
    const row = await biddingRepository.detailForAdmin(eventId);
    if (!row) throw new NotFoundError("Bidding event not found");
    return await productsRepository.stockByLocation(row.productId);
  }

  /**
   * Record that a bidder bought it, and for how much.
   *
   * The amount is what the organisation is owed and may differ from the bid — a
   * negotiation, a part refund — so a difference requires a reason. Without one the
   * record could not answer, months later, why an organisation was paid on a figure
   * that appears nowhere in the ladder (spec R40/R43).
   */
  async confirmSale(input: ConfirmSaleInput): Promise<void> {
    const now = new Date();
    const event = await biddingRepository.detailForAdmin(input.eventId);
    if (!event) throw new NotFoundError("Bidding event not found");

    if (biddingPhase(event, now) !== "ENDED") {
      throw new ConflictError(
        "A sale can only be recorded once bidding has closed and before an outcome is set"
      );
    }

    const bid = await biddingRepository.findBid(input.bidId, input.eventId);
    if (!bid) throw new NotFoundError("That bid is not on this event");

    if (input.amountPaise <= 0) {
      throw new DomainError("Enter the amount it sold for", { field: "amount" });
    }
    if (input.amountPaise !== bid.amountPaise && !input.reason?.trim()) {
      throw new DomainError(
        "The amount differs from the bid, so say why — the organisation is paid on this figure",
        { field: "reason" }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Guarded on OPEN, so two admins confirming at once produce one sale.
      const sold = await biddingRepository.markSold(
        {
          id: input.eventId,
          bidId: input.bidId,
          amountPaise: input.amountPaise,
          reason: input.reason?.trim() || null,
          adminId: input.adminId,
          now,
        },
        tx
      );
      if (!sold) {
        throw new ConflictError("An outcome has already been recorded for this event");
      }

      // Conditional, in the same transaction (Invariant 6, ADR-0007): recording a sale
      // of something no longer there would leave the ledger owing money for stock the
      // organisation still holds.
      const taken = await productsRepository.takeOneFromLocation(
        event.productId,
        input.orgAddressId,
        tx
      );
      if (!taken) {
        throw new ConflictError(
          "That location has no stock left for this product. Choose another."
        );
      }

      await ledgerService.recordBiddingSale(
        {
          orgId: event.orgId,
          categoryId: event.product.categoryId,
          amountPaise: input.amountPaise,
          note: `Bidding sale — ${event.product.name} (${event.slug})`,
        },
        tx
      );

      // Inside the transaction, so the record of the decision cannot outlive a
      // rolled-back decision or be missing from one that stood (ADR-0021).
      await recordAdminActionIn(tx, {
        adminId: input.adminId,
        action: "BIDDING_SALE_CONFIRMED",
        resource: "BiddingEvent",
        resourceId: input.eventId,
        metadata: {
          bidId: input.bidId,
          bidAmountPaise: bid.amountPaise,
          soldAmountPaise: input.amountPaise,
          orgAddressId: input.orgAddressId,
          reason: input.reason?.trim() || null,
        },
      });
    });
  }

  /**
   * Nobody went through with it (spec R39a).
   *
   * The product returns to sale as though it had never been bid on, and every bid
   * stays on record. An event that drew bids does not oblige a sale.
   */
  async markUnsold(params: {
    eventId: string;
    reason: string | null;
    adminId: string;
  }): Promise<void> {
    const now = new Date();
    const event = await biddingRepository.detailForAdmin(params.eventId);
    if (!event) throw new NotFoundError("Bidding event not found");

    if (biddingPhase(event, now) !== "ENDED") {
      throw new ConflictError(
        "An outcome can only be set once bidding has closed and before one is set"
      );
    }

    await prisma.$transaction(async (tx) => {
      const closed = await biddingRepository.markUnsold(
        {
          id: params.eventId,
          reason: params.reason?.trim() || null,
          adminId: params.adminId,
          now,
        },
        tx
      );
      if (!closed) {
        throw new ConflictError("An outcome has already been recorded for this event");
      }

      await recordAdminActionIn(tx, {
        adminId: params.adminId,
        action: "BIDDING_CLOSED_UNSOLD",
        resource: "BiddingEvent",
        resourceId: params.eventId,
        metadata: {
          bidCount: event.bidCount,
          highestBidPaise: event.highestBidPaise,
          reason: params.reason?.trim() || null,
        },
      });
    });
  }
}

export const adminBiddingService = new AdminBiddingService();
