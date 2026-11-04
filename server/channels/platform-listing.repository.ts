import { Prisma } from "@prisma/client";

import { prisma } from "@server/shared/prisma";

import { PUBLISH_STATE, type ListingIssue, type ListingOverrides } from "./platform-listing.types";

/**
 * The one writer of `PlatformListing` (channel-listings D1, ADR-0003): a product's listing on one
 * marketplace as the shop means it, and its publish.
 */

const ROW = {
  id: true,
  orgId: true,
  channel: true,
  connectionId: true,
  productId: true,
  familyId: true,
  channelListingId: true,
  overrides: true,
  sent: true,
  sentAt: true,
  version: true,
  publishState: true,
  pending: true,
  publishedAt: true,
  checkCount: true,
  nextCheckAt: true,
  checkedAt: true,
  issues: true,
  showing: true,
  live: true,
  createMode: true,
  targetExternalId: true,
  marketplaceType: true,
  sku: true,
} satisfies Prisma.PlatformListingSelect;

export type PlatformListingRow = Prisma.PlatformListingGetPayload<{ select: typeof ROW }>;

type Db = Prisma.TransactionClient | typeof prisma;
const json = (value: unknown) => value as Prisma.InputJsonValue;

export const platformListingRepository = {
  async forProducts(connectionId: string, productIds: readonly string[], db: Db = prisma): Promise<PlatformListingRow[]> {
    return await db.platformListing.findMany({ where: { connectionId, productId: { in: [...productIds] } }, select: ROW });
  },

  async forProduct(orgId: string, productId: string): Promise<PlatformListingRow[]> {
    return await prisma.platformListing.findMany({ where: { orgId, productId }, select: ROW });
  },

  async find(id: string, orgId: string, db: Db = prisma): Promise<PlatformListingRow | null> {
    return await db.platformListing.findFirst({ where: { id, orgId }, select: ROW });
  },

  async byIds(orgId: string, ids: readonly string[]): Promise<PlatformListingRow[]> {
    return await prisma.platformListing.findMany({ where: { orgId, id: { in: [...ids] } }, select: ROW });
  },

  async onConnection(connectionId: string): Promise<PlatformListingRow[]> {
    return await prisma.platformListing.findMany({ where: { connectionId }, select: ROW });
  },

  /**
   * Make each row with what is live (D3), doing nothing where one exists, so two openings at once
   * or the maintain pass beside a screen make one row.
   */
  async seed(
    rows: ReadonlyArray<{
      orgId: string;
      channel: string;
      connectionId: string;
      productId: string;
      channelListingId: string | null;
      overrides: ListingOverrides;
      sent: ListingOverrides | null;
    }>,
    now: Date,
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const { count } = await prisma.platformListing.createMany({
      data: rows.map((r) => ({ ...r, overrides: json(r.overrides), sent: r.sent === null ? undefined : json(r.sent), sentAt: r.sent ? now : null })),
      skipDuplicates: true,
    });
    return count;
  },

  /** A save compared on the version the screen opened at (D4); false when another save got there first. */
  async saveOverrides(id: string, orgId: string, seenVersion: number, overrides: ListingOverrides): Promise<boolean> {
    const { count } = await prisma.platformListing.updateMany({
      where: { id, orgId, version: seenVersion },
      data: { overrides: json(overrides), version: { increment: 1 } },
    });
    return count === 1;
  },

  /** The mirror row the listing now has, when a read or a create links one. */
  async attachMirror(id: string, channelListingId: string, db: Db = prisma): Promise<void> {
    await db.platformListing.updateMany({ where: { id, channelListingId: null }, data: { channelListingId } });
  },

  /**
   * `claimPublish` for many listings in one statement (bulk send, design-system Q29): each claimed
   * only at the version it was read at and only from a state a send may start from. Returns the
   * ids claimed; one that moved or is already sending is left out.
   */
  async claimPublishMany(
    orgId: string,
    items: ReadonlyArray<{ id: string; seenVersion: number; pending: ListingOverrides }>,
    now: Date,
    db: Db,
  ): Promise<string[]> {
    if (items.length === 0) return [];
    const rows = await db.$queryRaw<Array<{ id: string }>>`
      UPDATE "PlatformListing" pl
      SET pending = v.pending, "publishState" = ${PUBLISH_STATE.SENT}, "publishedAt" = ${now}, "checkCount" = 0,
        "nextCheckAt" = NULL, issues = '[]'::jsonb, version = pl.version + 1, "updatedAt" = ${now}
      FROM unnest(${items.map((i) => i.id)}::text[], ${items.map((i) => i.seenVersion)}::int[], ${items.map((i) => JSON.stringify(i.pending))}::text[]::jsonb[])
        AS v(id, seen, pending)
      WHERE pl.id = v.id AND pl."orgId" = ${orgId} AND pl.version = v.seen
        AND pl."publishState" IN (${PUBLISH_STATE.IDLE}, ${PUBLISH_STATE.ATTENTION}, ${PUBLISH_STATE.UNANSWERED})
      RETURNING pl.id`;
    return rows.map((row) => row.id);
  },

  /**
   * Claim a reviewed listing for a publish (marketplace-publish D3): only at the version reviewed and
   * with nothing in flight. Records what is being sent; bumps the version so a later edit is new.
   */
  async claimPublish(
    id: string,
    orgId: string,
    seenVersion: number,
    pending: ListingOverrides,
    now: Date,
    db: Db,
  ): Promise<boolean> {
    const { count } = await db.platformListing.updateMany({
      where: { id, orgId, version: seenVersion, publishState: { in: [PUBLISH_STATE.IDLE, PUBLISH_STATE.ATTENTION, PUBLISH_STATE.UNANSWERED] } },
      data: { pending: json(pending), publishState: PUBLISH_STATE.SENT, publishedAt: now, checkCount: 0, nextCheckAt: null, issues: json([]), version: { increment: 1 } },
    });
    return count === 1;
  },

  /**
   * Record a marketplace's answer (D3, D9). `onlyIf` guards on the state the caller read, so an answer
   * landing after the listing moved on (a newer publish, another look) changes nothing; false then.
   */
  async recordAnswer(
    id: string,
    answer: {
      sent: ListingOverrides | null;
      publishState: string;
      issues: ListingIssue[];
      nextCheckAt: Date | null;
      checkCount?: number;
      live?: boolean | null;
      showing?: { title: string | null; mainImageUrl: string | null } | null;
      keepPending?: boolean;
    },
    now: Date,
    db: Db = prisma,
    onlyIf?: readonly string[],
  ): Promise<boolean> {
    const { count } = await db.platformListing.updateMany({
      where: { id, ...(onlyIf ? { publishState: { in: [...onlyIf] } } : {}) },
      data: {
        ...(answer.sent ? { sent: json(answer.sent), sentAt: now } : {}),
        publishState: answer.publishState,
        issues: json(answer.issues),
        nextCheckAt: answer.nextCheckAt,
        checkedAt: now,
        ...(answer.checkCount === undefined ? {} : { checkCount: answer.checkCount }),
        ...(answer.live === undefined ? {} : { live: answer.live }),
        ...(answer.showing === undefined ? {} : { showing: answer.showing === null ? Prisma.DbNull : json(answer.showing) }),
        ...(answer.keepPending ? {} : { pending: Prisma.DbNull }),
      },
    });
    return count === 1;
  },

  /** Sends the queue gave up on (busy past its retries, D4): they wait for the shop instead of reading "Sent" for ever. */
  async expireStuckSends(before: Date, issue: ListingIssue, now: Date): Promise<number> {
    const { count } = await prisma.platformListing.updateMany({
      where: { publishState: PUBLISH_STATE.SENT, publishedAt: { lt: before } },
      data: { publishState: PUBLISH_STATE.ATTENTION, issues: json([issue]), pending: Prisma.DbNull, checkedAt: now },
    });
    return count;
  },

  /** Listings whose next check is due, claimed by moving the time on so a second chain finds none (D5). */
  async claimDueChecks(now: Date, until: Date, take = 50): Promise<string[]> {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE "PlatformListing" SET "nextCheckAt" = ${until}
      WHERE id IN (
        SELECT id FROM "PlatformListing"
        WHERE "publishState" IN (${PUBLISH_STATE.SENT}, ${PUBLISH_STATE.CHECKING}) AND "nextCheckAt" <= ${now}
        ORDER BY "nextCheckAt" LIMIT ${take} FOR UPDATE SKIP LOCKED
      )
      RETURNING id`;
    return rows.map((r) => r.id);
  },

  /** A draft for a product not yet on the marketplace (marketplace-publish D6). */
  async createDraft(
    data: {
      orgId: string;
      channel: string;
      connectionId: string;
      productId: string | null;
      familyId: string | null;
      createMode: string;
      targetExternalId: string | null;
      marketplaceType: string | null;
      sku: string;
    },
    db: Db = prisma,
  ): Promise<PlatformListingRow> {
    const where = data.productId
      ? { connectionId_productId: { connectionId: data.connectionId, productId: data.productId } }
      : { connectionId_familyId: { connectionId: data.connectionId, familyId: data.familyId as string } };
    return await db.platformListing.upsert({
      where,
      create: { ...data, overrides: json({}) },
      update: { createMode: data.createMode, targetExternalId: data.targetExternalId, marketplaceType: data.marketplaceType, version: { increment: 1 } },
      select: ROW,
    });
  },

  async forFamily(connectionId: string, familyId: string): Promise<PlatformListingRow | null> {
    return await prisma.platformListing.findFirst({ where: { connectionId, familyId }, select: ROW });
  },

  async orgOf(id: string, db: Db = prisma): Promise<string | null> {
    return (await db.platformListing.findUnique({ where: { id }, select: { orgId: true } }))?.orgId ?? null;
  },

  /**
   * When the next look falls due across every listing still waiting, or null when none waits: the
   * check runs again only then (D5, marketplace-publish Q22), not on a fixed short interval.
   */
  async nextDueAt(): Promise<Date | null> {
    const { _min } = await prisma.platformListing.aggregate({
      where: { publishState: { in: [PUBLISH_STATE.SENT, PUBLISH_STATE.CHECKING] }, nextCheckAt: { not: null } },
      _min: { nextCheckAt: true },
    });
    return _min.nextCheckAt;
  },

  /** The listings a check just claimed, across every shop, in one read: the worker's, never a shop's. */
  async claimedRows(ids: readonly string[]): Promise<PlatformListingRow[]> {
    if (ids.length === 0) return [];
    return await prisma.platformListing.findMany({ where: { id: { in: [...ids] } }, select: ROW });
  },

  /** The daily look (D5): every listing still waiting, or not answered, is due now. */
  async dueAllWaiting(now: Date): Promise<number> {
    const { count } = await prisma.platformListing.updateMany({
      where: { OR: [{ publishState: PUBLISH_STATE.UNANSWERED }, { publishState: PUBLISH_STATE.CHECKING }] },
      data: { publishState: PUBLISH_STATE.CHECKING, nextCheckAt: now },
    });
    return count;
  },

  /** Counts per state across a connection, for the Listings page bar (marketplace-publish ux.md). */
  async inFlight(connectionId: string): Promise<number> {
    return await prisma.platformListing.count({ where: { connectionId, publishState: { in: [PUBLISH_STATE.SENT, PUBLISH_STATE.CHECKING] } } });
  },
};
