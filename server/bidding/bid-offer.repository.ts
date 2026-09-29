/**
 * The only module that touches `prisma.bidOffer` (ADR-0003).
 *
 * Every transition is a guarded `updateMany` whose affected-row count is the verdict, as
 * `acceptBid` is: an accept carries the clock in its `where`, so an accept and the sweep
 * racing at the deadline cannot both win (winner-offer D1, R13).
 */

import { prisma } from "@server/shared/prisma";
import type { BidOfferStatus, Prisma } from "@prisma/client";
import { OPEN_OFFER_STATUSES, type ChainBid } from "@server/bidding/offer-chain";

export type BidOfferDb = Pick<typeof prisma, "bidOffer">;
type Db = BidOfferDb;

const OPEN = { in: [...OPEN_OFFER_STATUSES] };

const BID_SELECT = {
  id: true,
  amountPaise: true,
  userId: true,
  guestName: true,
  guestPhone: true,
  guestEmail: true,
  user: { select: { name: true, email: true, mobile: true } },
} satisfies Prisma.BidSelect;

const OFFER_SELECT = {
  id: true,
  eventId: true,
  sequence: true,
  status: true,
  expiresAt: true,
  emailSentAt: true,
  respondedAt: true,
  closedAt: true,
  createdAt: true,
  bid: { select: BID_SELECT },
} satisfies Prisma.BidOfferSelect;

type OfferRow = Prisma.BidOfferGetPayload<{ select: typeof OFFER_SELECT }>;

/** An offer with the person it was made to. Only bidding's own services and the platform's surfaces receive this. */
export interface OfferRecord {
  id: string;
  eventId: string;
  sequence: number;
  status: BidOfferStatus;
  expiresAt: Date | null;
  emailSentAt: Date | null;
  respondedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  bid: ChainBid;
  bidderName: string;
  bidderPhone: string | null;
}

function toRecord(row: OfferRow): OfferRecord {
  const { bid } = row;
  return {
    id: row.id,
    eventId: row.eventId,
    sequence: row.sequence,
    status: row.status,
    expiresAt: row.expiresAt,
    emailSentAt: row.emailSentAt,
    respondedAt: row.respondedAt,
    closedAt: row.closedAt,
    createdAt: row.createdAt,
    bid: {
      id: bid.id,
      amountPaise: bid.amountPaise,
      userId: bid.userId,
      guestPhone: bid.guestPhone,
      email: bid.user?.email ?? bid.guestEmail,
    },
    bidderName: bid.user?.name ?? bid.guestName ?? "Unnamed bidder",
    bidderPhone: bid.user?.mobile ?? bid.guestPhone,
  };
}

/** What the offer page and the email need about the item, read through the offer. */
const PAGE_SELECT = {
  ...OFFER_SELECT,
  event: {
    select: {
      id: true,
      slug: true,
      size: true,
      color: true,
      product: { select: { id: true, slug: true, name: true, thumbnail: true, weight: true } },
    },
  },
} satisfies Prisma.BidOfferSelect;

type PageRow = Prisma.BidOfferGetPayload<{ select: typeof PAGE_SELECT }>;

export interface OfferWithItem extends OfferRecord {
  event: PageRow["event"];
}

function toWithItem(row: PageRow): OfferWithItem {
  return { ...toRecord(row), event: row.event };
}

export class BidOfferRepository {
  async forEvent(eventId: string, db: Db = prisma): Promise<OfferRecord[]> {
    const rows = await db.bidOffer.findMany({
      relationLoadStrategy: "join",
      where: { eventId },
      select: OFFER_SELECT,
      orderBy: { sequence: "asc" },
    });
    return rows.map(toRecord);
  }

  async byId(id: string, db: Db = prisma): Promise<OfferWithItem | null> {
    const row = await db.bidOffer.findUnique({
      relationLoadStrategy: "join",
      where: { id },
      select: PAGE_SELECT,
    });
    return row ? toWithItem(row) : null;
  }

  async byTokenHash(tokenHash: string, db: Db = prisma): Promise<OfferWithItem | null> {
    const row = await db.bidOffer.findUnique({
      relationLoadStrategy: "join",
      where: { tokenHash },
      select: PAGE_SELECT,
    });
    return row ? toWithItem(row) : null;
  }

  async insert(
    data: {
      eventId: string;
      bidId: string;
      sequence: number;
      status: Extract<BidOfferStatus, "OFFERED" | "SKIPPED">;
      expiresAt: Date | null;
    },
    db: Db = prisma
  ): Promise<{ id: string }> {
    return await db.bidOffer.create({ data, select: { id: true } });
  }

  /**
   * Store the hash of a freshly minted link, only while the email is still unsent. A retried
   * send mints a new token and replaces the hash, so only the link actually delivered works.
   */
  async attachToken(id: string, tokenHash: string, db: Db = prisma): Promise<boolean> {
    const result = await db.bidOffer.updateMany({
      where: { id, emailSentAt: null, status: OPEN },
      data: { tokenHash },
    });
    return result.count === 1;
  }

  async markEmailSent(id: string, now: Date, db: Db = prisma): Promise<void> {
    await db.bidOffer.updateMany({ where: { id, emailSentAt: null }, data: { emailSentAt: now } });
  }

  async accept(id: string, now: Date, db: Db = prisma): Promise<boolean> {
    const result = await db.bidOffer.updateMany({
      where: { id, status: "OFFERED", expiresAt: { gt: now } },
      data: { status: "ACCEPTED", respondedAt: now },
    });
    return result.count === 1;
  }

  /** A bidder may decline after accepting, until the deadline, unless a payment is moving (checked by the caller). */
  async decline(id: string, now: Date, db: Db = prisma): Promise<boolean> {
    const result = await db.bidOffer.updateMany({
      where: { id, status: OPEN, expiresAt: { gt: now } },
      data: { status: "DECLINED", respondedAt: now, closedAt: now },
    });
    return result.count === 1;
  }

  /** Only once the deadline has passed: this guard is what keeps the sweep from closing a live offer. */
  async lapse(id: string, now: Date, db: Db = prisma): Promise<boolean> {
    const result = await db.bidOffer.updateMany({
      where: { id, status: OPEN, expiresAt: { lte: now } },
      data: { status: "LAPSED", closedAt: now },
    });
    return result.count === 1;
  }

  async withdraw(id: string, adminId: string, now: Date, db: Db = prisma): Promise<boolean> {
    const result = await db.bidOffer.updateMany({
      where: { id, status: OPEN },
      data: { status: "WITHDRAWN", closedAt: now, closedById: adminId },
    });
    return result.count === 1;
  }

  /**
   * The sale completed. From ACCEPTED only, and with no clock: a payment begun before the
   * deadline may finish after it (winner-offer R13), and nothing lapses an offer while an
   * unpaid order on it could still be captured.
   */
  async markPaid(id: string, now: Date, db: Db = prisma): Promise<boolean> {
    const result = await db.bidOffer.updateMany({
      where: { id, status: "ACCEPTED" },
      data: { status: "PAID", closedAt: now },
    });
    return result.count === 1;
  }

  /**
   * Lock an accepted, unexpired offer for the order transaction, or find none.
   *
   * `FOR UPDATE` so two checkout attempts on one offer serialise here, and the second sees
   * the first one's order when it asks whether a payment is already moving (winner-offer D7).
   */
  async lockForCheckout(
    tokenHash: string,
    now: Date,
    tx: Prisma.TransactionClient
  ): Promise<{ id: string } | null> {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "BidOffer"
      WHERE "tokenHash" = ${tokenHash} AND "status" = 'ACCEPTED' AND "expiresAt" > ${now}
      FOR UPDATE`;
    return rows[0] ?? null;
  }

  /** Events whose open offer has run past its deadline: the sweep's worklist. */
  async eventsWithLapsedOffers(now: Date, limit: number, db: Db = prisma): Promise<string[]> {
    const rows = await db.bidOffer.findMany({
      where: { status: OPEN, expiresAt: { lte: now } },
      select: { eventId: true },
      orderBy: { expiresAt: "asc" },
      take: limit,
    });
    return [...new Set(rows.map((row) => row.eventId))];
  }

  /** Every accepted offer, for the sweep to check none of them has a paid order it missed. */
  async acceptedOfferIds(limit: number, db: Db = prisma): Promise<string[]> {
    const rows = await db.bidOffer.findMany({
      where: { status: "ACCEPTED" },
      select: { id: true },
      take: limit,
    });
    return rows.map((row) => row.id);
  }
}

export const bidOfferRepository = new BidOfferRepository();
