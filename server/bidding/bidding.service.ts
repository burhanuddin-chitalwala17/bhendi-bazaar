/**
 * Opening events, and taking bids.
 *
 * `orgId` is a parameter on every org-facing method and never a field on an input, so
 * a handler physically cannot pass one that arrived in a body — the same discipline
 * `admin.promotion.service.ts` uses.
 *
 * Bid acceptance is deliberately two-layered. The checks here produce a good message;
 * the guarded update in the repository produces the truth. Anything this code decides
 * by reading first is advisory, because the read and the write cannot be one act
 * outside the database (bidding D5).
 */

import { randomBytes } from "node:crypto";
import { prisma } from "@server/shared/prisma";
import { rupeesToPaise } from "@server/shared/money";
import { productsRepository } from "@server/catalog/product.repository";
import { orgMemberRepository } from "@server/catalog/org.member.repository";
import { biddingRepository } from "@server/bidding/bidding.repository";
import { allowedBidRangePaise, biddingPhase } from "@server/bidding/bidding-window";
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
} from "@server/shared/domain-error";
import type {
  BidderIdentity,
  OrgBiddingSummary,
  PublicBiddingView,
} from "@server/bidding/bidding.types";
import type { BiddingFormInput } from "@/lib/validation/schemas/bidding.schema";

/**
 * No 0/O/1/I/l: a bidding link gets read aloud and retyped, and an ambiguous
 * character there costs a bidder rather than a developer.
 */
const SLUG_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const SLUG_LENGTH = 10;

function newSlug(): string {
  const bytes = randomBytes(SLUG_LENGTH);
  return Array.from(bytes, (byte) => SLUG_ALPHABET[byte % SLUG_ALPHABET.length]).join("");
}

export class BiddingService {
  async listForOrg(orgId: string): Promise<OrgBiddingSummary[]> {
    return await biddingRepository.listForOrg(orgId, new Date());
  }

  /**
   * The org's products that could be put up for bidding right now.
   *
   * Products already under a live event are excluded rather than shown and refused:
   * the picker is where an org learns what is available, so offering a choice that
   * cannot be taken is a worse answer than a shorter list (spec R7).
   */
  async pickableProducts(orgId: string, search?: string) {
    const [{ products, total }, locked] = await Promise.all([
      productsRepository.listForPicker({ orgId, search, limit: 30 }),
      biddingRepository.lockedProducts(new Date()),
    ]);
    const lockedIds = new Set(locked.map((lock) => lock.productId));
    const available = products.filter((product) => !lockedIds.has(product.id));
    return { products: available, total: total - (products.length - available.length) };
  }

  /**
   * What the creation form needs about the chosen product: the price to set an opening
   * bid against (spec R3), and the options one of which the event must name (spec R1a).
   */
  async productFacts(orgId: string, productId: string) {
    const facts = await productsRepository.listingFacts(productId, orgId);
    if (!facts) throw new NotFoundError("Product not found");
    const stock = await productsRepository.stockByLocation(productId);
    return {
      id: facts.id,
      name: facts.name,
      pricePaise: facts.price,
      sizes: facts.sizes,
      colors: facts.colors,
      unitsOnHand: stock.reduce((sum, row) => sum + row.quantity, 0),
    };
  }

  /**
   * Open an event.
   *
   * The rupees→paise seam is here rather than in the schema, for the reason
   * `admin.promotion.service.ts` gives: the same schema validates on both sides and a
   * transform would run twice (ADR-0004).
   */
  async create(
    input: BiddingFormInput,
    orgId: string,
    createdById: string
  ): Promise<{ id: string; slug: string }> {
    const facts = await this.productFacts(orgId, input.productId);
    this.assertVariantNamed(facts, input);

    const quickBidsPaise = [...new Set(input.quickBids.map(rupeesToPaise))].sort(
      (a, b) => a - b
    );
    const maxIncreasePaise = rupeesToPaise(input.maxIncrease);
    if (maxIncreasePaise < Math.min(...quickBidsPaise)) {
      throw new DomainError(
        "The most someone may add cannot be less than your smallest quick-bid button",
        { field: "maxIncrease" }
      );
    }

    try {
      return await prisma.$transaction(async (tx) => {
        // Lock this product's stock before deciding anything, so that a checkout
        // reserving the last unit right now either finishes first — and is seen by the
        // count below — or waits behind us and then finds the event already open. The
        // order path takes the same lock when it reserves, which is what makes the two
        // decisions serial rather than merely close together.
        await productsRepository.lockStock(input.productId, tx);

        const stock = await productsRepository.stockByLocation(input.productId, tx);
        const unitsOnHand = stock.reduce((sum, row) => sum + row.quantity, 0);
        if (unitsOnHand < 1) {
          throw new DomainError(
            "There is nothing in stock to auction. Add stock at a location first.",
            { field: "productId" }
          );
        }

        return await biddingRepository.create(
          {
            orgId,
            productId: input.productId,
            createdById,
            size: input.size ?? null,
            color: input.color ?? null,
            startAt: input.startAt,
            endAt: input.endAt,
            startingBidPaise: rupeesToPaise(input.startingBid),
            maxIncreasePaise,
            quickBidsPaise,
            slug: newSlug(),
            // Snapshotted, so repricing the product later cannot rewrite what this
            // event says the item was worth when it opened (spec R4).
            referencePricePaise: facts.pricePaise,
          },
          tx
        );
      });
    } catch (error) {
      // The partial unique index is what actually arbitrates two simultaneous
      // creations; the picker's filtering is only a courtesy (spec R7).
      if (isUniqueViolation(error)) {
        throw new ConflictError("This product is already up for bidding", {
          field: "productId",
        });
      }
      throw error;
    }
  }

  /** An event names exactly one item, so an optioned product cannot leave it open. */
  private assertVariantNamed(
    facts: { sizes: string[]; colors: string[] },
    input: BiddingFormInput
  ) {
    if (facts.sizes.length > 0 && !input.size) {
      throw new DomainError("Choose which size is being auctioned", { field: "size" });
    }
    if (facts.colors.length > 0 && !input.color) {
      throw new DomainError("Choose which colour is being auctioned", { field: "color" });
    }
    if (input.size && !facts.sizes.includes(input.size)) {
      throw new DomainError("That size is not one of this product's options", {
        field: "size",
      });
    }
    if (input.color && !facts.colors.includes(input.color)) {
      throw new DomainError("That colour is not one of this product's options", {
        field: "color",
      });
    }
  }

  /**
   * Call it off. Guarded on OPEN in the repository, so a cancellation cannot land on
   * an event the platform has already settled (spec R11).
   */
  async cancel(id: string, orgId: string): Promise<void> {
    const cancelled = await biddingRepository.cancel(id, orgId);
    if (!cancelled) {
      throw new ConflictError(
        "This event is no longer open, so it cannot be cancelled"
      );
    }
  }

  /** What the public page renders — amounts and counts, never a bidder (spec R16). */
  async publicView(slug: string): Promise<PublicBiddingView> {
    const now = new Date();
    const row = await biddingRepository.findBySlug(slug);
    if (!row) throw new NotFoundError("This bidding link does not exist");

    const range = allowedBidRangePaise(row);
    return {
      id: row.id,
      slug: row.slug,
      phase: biddingPhase(row, now),
      startAt: row.startAt,
      endAt: row.endAt,
      startingBidPaise: row.startingBidPaise,
      maxIncreasePaise: row.maxIncreasePaise,
      quickBidsPaise: row.quickBidsPaise,
      highestBidPaise: row.highestBidPaise,
      bidCount: row.bidCount,
      minBidPaise: range.min,
      maxBidPaise: range.max,
      soldAmountPaise: row.soldAmountPaise,
      // Travels with the page so the countdown runs against the platform's clock and
      // not the visitor's device (bidding D17, spec R17).
      serverNow: now,
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

  /**
   * Place a bid.
   *
   * Everything before the transaction exists to produce a message a bidder can act on.
   * The transaction is what decides: its guard carries the clock and the price
   * together, so a bid that loses a race or arrives after the end is refused by the
   * database rather than by a check that happened to run first (spec R24/R26).
   */
  async placeBid(params: {
    slug: string;
    /** Rupees, as the bidder typed them. Converted once, here (ADR-0004). */
    amount: number;
    expectedHighestBidPaise: number | null;
    bidder: BidderIdentity;
  }): Promise<PublicBiddingView> {
    const now = new Date();
    const amountPaise = rupeesToPaise(params.amount);
    const row = await biddingRepository.findBySlug(params.slug);
    if (!row) throw new NotFoundError("This bidding link does not exist");

    const phase = biddingPhase(row, now);
    if (phase === "SCHEDULED") {
      throw new DomainError("Bidding has not opened yet");
    }
    if (phase !== "LIVE") {
      throw new ConflictError("Bidding has closed on this item");
    }

    if (params.bidder.kind === "user") {
      const membership = await orgMemberRepository.findMembership(
        params.bidder.userId,
        row.orgId
      );
      if (membership) {
        throw new ForbiddenError("You cannot bid on your own organisation's item");
      }
    }

    if (params.expectedHighestBidPaise !== row.highestBidPaise) {
      throw new ConflictError(this.movedMessage(), {
        field: "amount",
      });
    }

    const range = allowedBidRangePaise(row);
    if (amountPaise < range.min || amountPaise > range.max) {
      throw new DomainError(this.rangeMessage(row), { field: "amount" });
    }

    const bidId = await prisma.$transaction(async (tx) => {
      const accepted = await biddingRepository.acceptBid(
        { eventId: row.id, amountPaise, now },
        tx
      );
      if (!accepted) return null;
      const bid = await biddingRepository.insertBid(
        { eventId: row.id, amountPaise, bidder: params.bidder },
        tx
      );
      return bid.id;
    });

    if (bidId === null) {
      const fresh = await biddingRepository.findBySlug(params.slug);
      throw new ConflictError(
        fresh && biddingPhase(fresh, new Date()) === "LIVE"
          ? this.movedMessage()
          : "Bidding has closed on this item",
        { field: "amount" }
      );
    }

    void this.notifyOutbid(row.id, bidId, params.slug);
    return await this.publicView(params.slug);
  }

  /**
   * Messages here name no amounts, deliberately.
   *
   * Money is formatted in exactly one place and it is client-side (`src/lib/format.ts`,
   * Invariant 3) — a rupee string built on the server is both a second formatter and a
   * second `/100`. The page already has the current price and the admissible range in
   * the view it was rendered with, so it can say the numbers better than an error
   * string can, and a rejected bidder reloads to a fresh price (spec R24).
   */
  private movedMessage(): string {
    return "Someone bid before you. Reload to see the current price and bid again.";
  }

  private rangeMessage(row: { highestBidPaise: number | null }): string {
    return row.highestBidPaise === null
      ? "The opening bid is fixed — bid exactly that to start it off."
      : "That amount is outside what one bid may add. Reload and try again.";
  }

  /**
   * Tell whoever just lost the lead. Fire-and-forget with the same reasoning as the
   * purchase confirmation at `order.service.ts:100`: a mail failure must never unwind
   * an accepted bid. A previous leader who gave no email is simply skipped, which is
   * the cost the bid form disclosed to them (spec R28, R22a).
   */
  private async notifyOutbid(eventId: string, newBidId: string, slug: string) {
    try {
      const previous = await biddingRepository.leaderBefore(eventId, newBidId);
      if (!previous?.bidderEmail) return;
      const view = await this.publicView(slug);
      const { emailService } = await import("@server/notifications/email.service");
      await emailService.sendOutbidEmail(previous.bidderEmail, {
        bidderName: previous.bidderName,
        productName: view.product.name,
        theirBidPaise: previous.amountPaise,
        currentBidPaise: view.highestBidPaise ?? previous.amountPaise,
        endAt: view.endAt,
        slug,
      });
    } catch (error) {
      console.error("Failed to send outbid email:", error);
      // A mail failure must not unwind an accepted bid (spec R28).
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

export const biddingService = new BiddingService();
