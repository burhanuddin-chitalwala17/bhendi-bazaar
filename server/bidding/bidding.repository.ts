/**
 * The only module that touches `prisma.biddingEvent` and `prisma.bid` (ADR-0003).
 *
 * Two things here are load-bearing rather than incidental. `acceptBid` is a guarded
 * conditional update whose affected-row count is the whole verdict — the clock test
 * and the price test are one atomic act on the contested row, which is what makes
 * simultaneous bids safe without a lock the application has to remember to take
 * (bidding D5, ADR-0007). And the org-facing selects name no bidder column at all,
 * so spec R16 and R36 hold whatever a caller does downstream (bidding D19).
 */

import { prisma } from "@server/shared/prisma";
import type { Prisma } from "@prisma/client";
import type {
  BidLadderEntry,
  BidderIdentity,
  CreateBiddingEventInput,
  OrgBiddingSummary,
} from "@server/bidding/bidding.types";
import { biddingPhase } from "@server/bidding/bidding-window";

/**
 * Anything that can run these queries — the client, or a transaction handle. Named so
 * callers inside `$transaction` pass `tx` and get the same guarantees.
 */
export type BiddingDb = Pick<typeof prisma, "biddingEvent" | "bid">;
type Db = BiddingDb;

/** No bidder column: the org and the public share this select (bidding D19). */
const EVENT_SELECT = {
  id: true,
  slug: true,
  status: true,
  /// Not bidder identity: the owning org is what tells a bid whether the bidder is one
  /// of its own members (spec R25), so it travels with every read.
  orgId: true,
  size: true,
  color: true,
  startAt: true,
  endAt: true,
  startingBidPaise: true,
  maxIncreasePaise: true,
  quickBidsPaise: true,
  referencePricePaise: true,
  highestBidPaise: true,
  bidCount: true,
  soldAmountPaise: true,
  settledAt: true,
  createdAt: true,
  product: { select: { id: true, slug: true, name: true, thumbnail: true } },
} satisfies Prisma.BiddingEventSelect;

const LADDER_SELECT = {
  id: true,
  amountPaise: true,
  createdAt: true,
  userId: true,
  guestName: true,
  guestPhone: true,
  guestEmail: true,
  user: { select: { name: true, email: true, mobile: true } },
} satisfies Prisma.BidSelect;

type EventRow = Prisma.BiddingEventGetPayload<{ select: typeof EVENT_SELECT }>;
type LadderRow = Prisma.BidGetPayload<{ select: typeof LADDER_SELECT }>;

function toSummary(row: EventRow, now: Date): OrgBiddingSummary {
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    phase: biddingPhase(row, now),
    startAt: row.startAt,
    endAt: row.endAt,
    startingBidPaise: row.startingBidPaise,
    maxIncreasePaise: row.maxIncreasePaise,
    quickBidsPaise: row.quickBidsPaise,
    highestBidPaise: row.highestBidPaise,
    bidCount: row.bidCount,
    soldAmountPaise: row.soldAmountPaise,
    settledAt: row.settledAt,
    createdAt: row.createdAt,
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

function toLadderEntry(row: LadderRow): BidLadderEntry {
  return {
    id: row.id,
    amountPaise: row.amountPaise,
    placedAt: row.createdAt,
    // A signed-in bidder's details are read through the relation so they cannot go
    // stale; a guest's were snapshotted because there is nothing to read them from.
    bidderName: row.user?.name ?? row.guestName ?? "Unnamed bidder",
    bidderPhone: row.user?.mobile ?? row.guestPhone,
    bidderEmail: row.user?.email ?? row.guestEmail,
    isRegistered: row.userId !== null,
  };
}

/** A product held out of normal sale, and the event holding it (spec R30). */
export interface BiddingLock {
  productId: string;
  slug: string;
}

export class BiddingRepository {
  /**
   * Every product currently suspended from sale, in one query.
   *
   * This sits on the storefront's read path, so it is deliberately one small indexed
   * read of the whole locked set rather than a question asked per product (bidding
   * D8). Live events are coarse and few, so the set stays tiny.
   *
   * The clause is the SQL of `suspendsPurchase`: still running, or finished with bids
   * and therefore awaiting an outcome. An event that expired with no bids drops out
   * on its own, which is why spec R33 needs no cleanup step.
   */
  async lockedProducts(now: Date, db: Db = prisma): Promise<BiddingLock[]> {
    return await db.biddingEvent.findMany({
      where: {
        status: "OPEN",
        OR: [{ endAt: { gt: now } }, { bidCount: { gt: 0 } }],
      },
      select: { productId: true, slug: true },
    });
  }

  /**
   * The same question as `lockedProducts`, narrowed to a named set.
   *
   * This is the authoritative check, run inside the order transaction where the
   * request-memoised set would be stale (bidding D8). Narrow because an order names a
   * handful of products and the whole locked set is irrelevant to it.
   */
  async lockedAmong(
    productIds: string[],
    now: Date,
    db: Db = prisma
  ): Promise<BiddingLock[]> {
    if (productIds.length === 0) return [];
    return await db.biddingEvent.findMany({
      where: {
        productId: { in: productIds },
        status: "OPEN",
        OR: [{ endAt: { gt: now } }, { bidCount: { gt: 0 } }],
      },
      select: { productId: true, slug: true },
    });
  }

  async findBySlug(slug: string, db: Db = prisma): Promise<EventRow | null> {
    return await db.biddingEvent.findUnique({
      relationLoadStrategy: "join",
      where: { slug },
      select: EVENT_SELECT,
    });
  }

  async summaryBySlug(
    slug: string,
    now: Date,
    db: Db = prisma
  ): Promise<OrgBiddingSummary | null> {
    const row = await this.findBySlug(slug, db);
    return row ? toSummary(row, now) : null;
  }

  async listForOrg(
    orgId: string,
    now: Date,
    db: Db = prisma
  ): Promise<OrgBiddingSummary[]> {
    const rows = await db.biddingEvent.findMany({
      relationLoadStrategy: "join",
      where: { orgId },
      select: EVENT_SELECT,
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => toSummary(row, now));
  }

  /** Platform-wide, newest first — the queue the platform works from (spec R37). */
  async listAll(now: Date, db: Db = prisma): Promise<(OrgBiddingSummary & { orgName: string })[]> {
    const rows = await db.biddingEvent.findMany({
      relationLoadStrategy: "join",
      select: { ...EVENT_SELECT, org: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => ({ ...toSummary(row, now), orgName: row.org.name }));
  }

  async findForOrg(
    id: string,
    orgId: string,
    db: Db = prisma
  ): Promise<EventRow | null> {
    return await db.biddingEvent.findFirst({
      relationLoadStrategy: "join",
      where: { id, orgId },
      select: EVENT_SELECT,
    });
  }

  async detailForAdmin(id: string, db: Db = prisma) {
    return await db.biddingEvent.findUnique({
      relationLoadStrategy: "join",
      where: { id },
      select: {
        ...EVENT_SELECT,
        soldBidId: true,
        soldReason: true,
        org: { select: { name: true } },
        productId: true,
        // The category decides the commission rate the sale settles at (bidding D11).
        product: { select: { id: true, slug: true, name: true, thumbnail: true, categoryId: true } },
      },
    });
  }

  async ladder(eventId: string, db: Db = prisma): Promise<BidLadderEntry[]> {
    const rows = await db.bid.findMany({
      relationLoadStrategy: "join",
      where: { eventId },
      select: LADDER_SELECT,
      orderBy: { amountPaise: "desc" },
    });
    return rows.map(toLadderEntry);
  }

  /**
   * The bid that led before this one landed — who the outbid notice goes to (spec R28).
   * Returns null when the new bid is the first, or when the previous leader left no
   * email, which the caller treats as nobody to tell rather than as a failure.
   */
  async leaderBefore(
    eventId: string,
    newBidId: string,
    db: Db = prisma
  ): Promise<BidLadderEntry | null> {
    const row = await db.bid.findFirst({
      relationLoadStrategy: "join",
      where: { eventId, id: { not: newBidId } },
      select: LADDER_SELECT,
      orderBy: { amountPaise: "desc" },
    });
    return row ? toLadderEntry(row) : null;
  }

  async create(
    input: CreateBiddingEventInput & { slug: string; referencePricePaise: number },
    db: Db = prisma
  ): Promise<{ id: string; slug: string }> {
    return await db.biddingEvent.create({
      data: {
        slug: input.slug,
        productId: input.productId,
        orgId: input.orgId,
        createdById: input.createdById,
        size: input.size,
        color: input.color,
        startAt: input.startAt,
        endAt: input.endAt,
        startingBidPaise: input.startingBidPaise,
        maxIncreasePaise: input.maxIncreasePaise,
        quickBidsPaise: input.quickBidsPaise,
        referencePricePaise: input.referencePricePaise,
      },
      select: { id: true, slug: true },
    });
  }

  /**
   * Accept a bid, or refuse it — decided entirely by the database (bidding D5).
   *
   * The guard carries every precondition at once: the event is still open, its window
   * contains `now`, and the offer genuinely beats the stored high. Two bidders racing
   * serialise on this row, so the loser sees the winner's amount already in place and
   * gets `count === 0` — never a second bid at the same figure, and never a bid landing
   * a millisecond after the clock (closes H1 and H2 together).
   *
   * `null` is the "no bids yet" case and must be matched explicitly: a comparison
   * against NULL is never true, so `lt` alone would refuse every opening bid.
   */
  async acceptBid(
    params: { eventId: string; amountPaise: number; now: Date },
    db: Db = prisma
  ): Promise<boolean> {
    const accepted = await db.biddingEvent.updateMany({
      where: {
        id: params.eventId,
        status: "OPEN",
        startAt: { lte: params.now },
        endAt: { gt: params.now },
        OR: [
          { highestBidPaise: null },
          { highestBidPaise: { lt: params.amountPaise } },
        ],
      },
      data: {
        highestBidPaise: params.amountPaise,
        bidCount: { increment: 1 },
      },
    });
    return accepted.count === 1;
  }

  async insertBid(
    params: { eventId: string; amountPaise: number; bidder: BidderIdentity },
    db: Db = prisma
  ): Promise<{ id: string }> {
    const identity =
      params.bidder.kind === "user"
        ? { userId: params.bidder.userId }
        : {
            guestName: params.bidder.name,
            guestPhone: params.bidder.phone,
            guestEmail: params.bidder.email,
          };
    return await db.bid.create({
      data: { eventId: params.eventId, amountPaise: params.amountPaise, ...identity },
      select: { id: true },
    });
  }

  async findBid(id: string, eventId: string, db: Db = prisma) {
    return await db.bid.findFirst({
      where: { id, eventId },
      select: { id: true, amountPaise: true },
    });
  }

  /**
   * Cancel while open. Guarded so a cancellation cannot land on an event that has
   * already been settled by someone else in the meantime (spec R11).
   */
  async cancel(id: string, orgId: string, db: Db = prisma): Promise<boolean> {
    const cancelled = await db.biddingEvent.updateMany({
      where: { id, orgId, status: "OPEN" },
      data: { status: "CANCELLED", settledAt: new Date() },
    });
    return cancelled.count === 1;
  }

  /** Record the sale. Guarded on OPEN, so an outcome is recorded exactly once. */
  async markSold(
    params: {
      id: string;
      bidId: string;
      amountPaise: number;
      reason: string | null;
      adminId: string;
      now: Date;
    },
    db: Db = prisma
  ): Promise<boolean> {
    const sold = await db.biddingEvent.updateMany({
      where: { id: params.id, status: "OPEN" },
      data: {
        status: "SOLD",
        soldBidId: params.bidId,
        soldAmountPaise: params.amountPaise,
        soldReason: params.reason,
        settledById: params.adminId,
        settledAt: params.now,
      },
    });
    return sold.count === 1;
  }

  async markUnsold(
    params: { id: string; reason: string | null; adminId: string; now: Date },
    db: Db = prisma
  ): Promise<boolean> {
    const closed = await db.biddingEvent.updateMany({
      where: { id: params.id, status: "OPEN" },
      data: {
        status: "UNSOLD",
        soldReason: params.reason,
        settledById: params.adminId,
        settledAt: params.now,
      },
    });
    return closed.count === 1;
  }

}

export const biddingRepository = new BiddingRepository();
