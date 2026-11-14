import { productAnswersService } from "@server/listing/product-answers.service";
import { Prisma } from "@prisma/client";
import { prisma } from "@server/shared/prisma";

import { uniqueViolationFields } from "@server/shared/constraint";

import { CONNECTION_STATE, isMarketplaceChannel, LINK_SOURCE, LISTING_STATUS, type LeftOffReason, type MarketplaceChannel } from "./channel-connection.types";
import type { ListingAttributes } from "./providers/listing-read";
import { STOCK_SYNC } from "./channel-stock.types";

/** A fill whose read failed is queued again a week later, never daily (marketplace-facts Q36). */
const FILL_RETRY_MS = 7 * 86_400_000;

/**
 * The one way to reach `ChannelListing` (Invariant 5). A read-only mirror of what a marketplace
 * reported, plus one link to the shop's product (channel-import D1). Rows are never deleted.
 */

/** What a marketplace read produces for one listing, before matching. */
export interface ReadListing {
  sku: string;
  skuKey: string;
  externalId: string | null;
  title: string | null;
  imageUrl: string | null;
  status: string | null;
  pricePaise: number | null;
  quantity: number | null;
  parentSku: string | null;
  parentTitle: string | null;
  variationAxis: string | null;
}

const PRODUCT = { select: { id: true, name: true, sku: true, archivedAt: true } } as const;

const ROW = {
  id: true,
  sku: true,
  skuKey: true,
  externalId: true,
  title: true,
  imageUrl: true,
  status: true,
  pricePaise: true,
  quantity: true,
  parentSku: true,
  parentTitle: true,
  variationAxis: true,
  productId: true,
  linkSource: true,
  unlinkedAt: true,
  leftOffAt: true,
  leftOffReason: true,
  goneAt: true,
  photoTotal: true,
  photoDone: true,
  photoFailed: true,
  photoMode: true,
  problems: true,
  suppressed: true,
  product: PRODUCT,
} as const;

export type ListingRow = Prisma.ChannelListingGetPayload<{ select: typeof ROW }>;

/** `notLinked` is the to-do; `leftOff` lists what the owner ruled out (product-merge Q23); `problems`, linked ones the marketplace complains of (publish Q23). */
export type ListingFilter = "linked" | "notLinked" | "leftOff" | "problems";

const PAGE_SIZE = 50;

const filterWhere = (filter: ListingFilter): Prisma.ChannelListingWhereInput =>
  filter === "linked"
    ? { productId: { not: null } }
    : filter === "problems"
      ? { productId: { not: null }, goneAt: null, problemsSince: { not: null } }
    : filter === "leftOff"
      ? { productId: null, leftOffAt: { not: null } }
      : { productId: null, leftOffAt: null };

const searchWhere = (search: string | null): Prisma.ChannelListingWhereInput =>
  search
    ? {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { sku: { contains: search, mode: "insensitive" } },
          { externalId: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

export const channelListingRepository = {
  /**
   * Write what one read saw, keyed on (connection, SKU), so a retried or resumed read writes the same
   * rows (D9). Only the marketplace's facts are updated; links are left to the link commands.
   */
  async upsertSeen(
    connection: { id: string; orgId: string; channel: MarketplaceChannel },
    rows: readonly ReadListing[],
    seenAt: Date,
  ): Promise<void> {
    if (rows.length === 0) return;
    await prisma.$transaction(
      rows.map((row) =>
        prisma.channelListing.upsert({
          where: { connectionId_sku: { connectionId: connection.id, sku: row.sku } },
          create: { ...row, connectionId: connection.id, orgId: connection.orgId, channel: connection.channel, lastSeenAt: seenAt },
          update: { ...row, lastSeenAt: seenAt, goneAt: null },
          select: { id: true },
        }),
      ),
    );
  },

  /** The rows among these SKUs that may link: not linked, not unlinked by the owner (Q5). */
  async linkable(connectionId: string, skuKeys: readonly string[]): Promise<Array<{ id: string; skuKey: string }>> {
    return await prisma.channelListing.findMany({
      where: { connectionId, productId: null, unlinkedAt: null, leftOffAt: null, skuKey: { in: [...skuKeys] } },
      select: { id: true, skuKey: true },
    });
  },

  /**
   * Link rows automatically. Conditional, so a row the owner touched meanwhile is left alone; a
   * product already linked to another listing here is skipped, not a failed batch (product-merge D8).
   */
  async linkBySku(links: ReadonlyArray<{ id: string; productId: string }>, now: Date): Promise<number> {
    let linked = 0;
    for (const link of links) {
      try {
        const result = await prisma.channelListing.updateMany({
          where: { id: link.id, productId: null, unlinkedAt: null, leftOffAt: null },
          data: { productId: link.productId, linkSource: LINK_SOURCE.SKU, linkedAt: now },
        });
        linked += result.count;
      } catch (error) {
        if (uniqueViolationFields(error) === null) throw error;
      }
    }
    return linked;
  },

  /**
   * The owner leaves an unsettled listing off Bhendi Bazaar (product-merge Q9), with why when it is
   * "we have no type for this" (marketplace-facts Q6).
   */
  async leaveOff(id: string, orgId: string, userId: string, now: Date, reason: LeftOffReason | null = null): Promise<boolean> {
    const result = await prisma.channelListing.updateMany({
      where: { id, orgId, productId: null, leftOffAt: null },
      data: { leftOffAt: now, leftOffById: userId, leftOffReason: reason },
    });
    return result.count === 1;
  },

  /** Back to the to-do, where a read may link it by SKU again (Q9). */
  async bringBack(id: string, orgId: string): Promise<boolean> {
    const result = await prisma.channelListing.updateMany({
      where: { id, orgId, leftOffAt: { not: null } },
      data: { leftOffAt: null, leftOffById: null, leftOffReason: null },
    });
    return result.count === 1;
  },

  /** A finished read marks what it did not see as gone (D8). A stopped read never calls this. */
  async markGone(connectionId: string, before: Date, now: Date): Promise<number> {
    const result = await prisma.channelListing.updateMany({
      where: { connectionId, lastSeenAt: { lt: before }, goneAt: null },
      data: { goneAt: now },
    });
    return result.count;
  },

  async find(id: string, orgId: string): Promise<ListingRow & { channel: string; connectionId: string } | null> {
    return await prisma.channelListing.findFirst({
      where: { id, orgId },
      select: { ...ROW, channel: true, connectionId: true },
    });
  },

  /** The owner unlinks: the row returns to Not linked and is never linked again by a read (Q5). */
  async unlink(id: string, orgId: string, userId: string, now: Date): Promise<boolean> {
    const result = await prisma.channelListing.updateMany({
      where: { id, orgId, productId: { not: null } },
      data: { productId: null, linkSource: null, linkedAt: null, unlinkedAt: now, unlinkedById: userId },
    });
    return result.count === 1;
  },

  /** Restore the SKU match the owner removed (Q16): only to the product that SKU names. */
  async linkBack(id: string, orgId: string, productId: string, now: Date): Promise<boolean> {
    const result = await prisma.channelListing.updateMany({
      where: { id, orgId, productId: null, unlinkedAt: { not: null }, leftOffAt: null },
      data: { productId, linkSource: LINK_SOURCE.SKU, linkedAt: now, unlinkedAt: null, unlinkedById: null },
    });
    return result.count === 1;
  },

  async page(
    connectionId: string,
    filter: ListingFilter,
    search: string | null,
    pages: number,
  ): Promise<{ rows: ListingRow[]; hasMore: boolean }> {
    const rows = await prisma.channelListing.findMany({
      where: { connectionId, ...filterWhere(filter), ...searchWhere(search) },
      select: ROW,
      // Variants together under their parent, then the rest by title (Q9).
      orderBy: [{ goneAt: { sort: "asc", nulls: "first" } }, { parentSku: { sort: "asc", nulls: "last" } }, { title: "asc" }, { sku: "asc" }],
      // "Show more" asks for one more page of fifty; the URL holds how many (ux.md "Many items").
      take: pages * PAGE_SIZE + 1,
    });
    return { rows: rows.slice(0, pages * PAGE_SIZE), hasMore: rows.length > pages * PAGE_SIZE };
  },

  /** What each tab lists, gone rows included, so a tab's number matches its rows. */
  async tabCounts(connectionId: string): Promise<{ linked: number; notLinked: number; leftOff: number; problems: number }> {
    const [linked, notLinked, leftOff, problems] = await Promise.all([
      prisma.channelListing.count({ where: { connectionId, ...filterWhere("linked") } }),
      prisma.channelListing.count({ where: { connectionId, ...filterWhere("notLinked") } }),
      prisma.channelListing.count({ where: { connectionId, ...filterWhere("leftOff") } }),
      prisma.channelListing.count({ where: { connectionId, ...filterWhere("problems") } }),
    ]);
    return { linked, notLinked, leftOff, problems };
  },

  /** What is on the marketplace now, for the card: gone rows left out. */
  async counts(connectionId: string): Promise<{ linked: number; toSettle: number; total: number }> {
    const [linked, toSettle, total] = await Promise.all([
      prisma.channelListing.count({ where: { connectionId, productId: { not: null }, goneAt: null } }),
      prisma.channelListing.count({ where: { connectionId, productId: null, leftOffAt: null, goneAt: null } }),
      prisma.channelListing.count({ where: { connectionId, goneAt: null } }),
    ]);
    return { linked, toSettle, total };
  },

  /** The listings a settle names, with what it needs of their connections (product-merge D4). */
  async forSettle(ids: readonly string[], orgId: string) {
    return await prisma.channelListing.findMany({
      where: { id: { in: [...ids] }, orgId },
      select: {
        id: true,
        connectionId: true,
        channel: true,
        sku: true,
        skuKey: true,
        externalId: true,
        title: true,
        imageUrl: true,
        status: true,
        pricePaise: true,
        quantity: true,
        productId: true,
        leftOffAt: true,
        goneAt: true,
        photoMode: true,
        photoTotal: true,
        attributes: true,
        attributesReadAt: true,
        parentSku: true,
        parentTitle: true,
        variationAxis: true,
        product: { select: { name: true } },
        connection: { select: { externalAccountId: true, state: true } },
      },
    });
  },

  /**
   * Lock the listings a settle names, first, while they are still unsettled (product-merge D4). A
   * second settle of the same listings waits here, then finds them taken and is told so, before it
   * makes a product of its own. The count is the verdict.
   */
  async lockUnsettled(tx: Prisma.TransactionClient, ids: readonly string[], orgId: string): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "ChannelListing"
      WHERE id IN (${Prisma.join([...ids])}) AND "orgId" = ${orgId} AND "productId" IS NULL AND "leftOffAt" IS NULL
      FOR UPDATE`;
    return rows.length;
  },

  /**
   * Link the settled listings to their product, in the settle's transaction. Conditional: a row
   * linked or left off meanwhile is not touched, and the short count rolls the settle back (D4).
   */
  async settleLink(
    tx: Prisma.TransactionClient,
    ids: readonly string[],
    orgId: string,
    productId: string,
    now: Date,
  ): Promise<number> {
    const result = await tx.channelListing.updateMany({
      where: { id: { in: [...ids] }, orgId, productId: null, leftOffAt: null },
      data: { productId, linkSource: LINK_SOURCE.OWNER, linkedAt: now, unlinkedAt: null, unlinkedById: null },
    });
    return result.count;
  },

  /** Photos about to be copied from this listing (D6). */
  async startPhotoCopy(
    tx: Prisma.TransactionClient | typeof prisma,
    id: string,
    total: number,
    mode: string | null,
    now: Date,
  ): Promise<void> {
    await tx.channelListing.update({
      where: { id },
      data: { photoTotal: total, photoDone: 0, photoFailed: 0, photoUpdatedAt: now, ...(mode ? { photoMode: mode } : {}) },
      select: { id: true },
    });
  },

  async photoProgress(id: string, done: number, failed: number, now: Date): Promise<void> {
    await prisma.channelListing.update({
      where: { id },
      data: { photoDone: done, photoFailed: failed, photoUpdatedAt: now },
      select: { id: true },
    });
  },

  /** Products already linked to a listing on this connection (product-merge Q22). */
  async productIdsLinkedOn(connectionId: string): Promise<Set<string>> {
    const rows = await prisma.channelListing.findMany({
      where: { connectionId, productId: { not: null } },
      select: { productId: true },
    });
    return new Set(rows.map((row) => row.productId as string));
  },

  /** The product the shop most recently linked by hand: its category starts the next add (D9). */
  async latestOwnerLinkedProductId(orgId: string): Promise<string | null> {
    const row = await prisma.channelListing.findFirst({
      where: { orgId, linkSource: LINK_SOURCE.OWNER, productId: { not: null } },
      orderBy: { linkedAt: "desc" },
      select: { productId: true },
    });
    return row?.productId ?? null;
  },

  /** The shop's unsettled listings on its other marketplaces, for same-item suggestions (product-merge D3). */
  async unsettledElsewhere(orgId: string, connectionId: string) {
    return await prisma.channelListing.findMany({
      where: { orgId, connectionId: { not: connectionId }, productId: null, leftOffAt: null, goneAt: null },
      select: { id: true, connectionId: true, channel: true, sku: true, skuKey: true, title: true, externalId: true, pricePaise: true, quantity: true, status: true },
    });
  },

  /** What a marketplace said about one listing, stored as read (marketplace-facts D6). */
  async saveAttributes(id: string, read: ListingAttributes, now: Date): Promise<void> {
    await prisma.channelListing.update({
      where: { id },
      data: { attributes: read as unknown as Prisma.InputJsonValue, attributesReadAt: now },
      select: { id: true },
    });
  },

  /** Unsettled listings with no marketplace grouping, for same-item suggestions (family-merge D6). */
  async ungroupedUnsettled(connectionId: string) {
    return await prisma.channelListing.findMany({
      where: { connectionId, productId: null, leftOffAt: null, goneAt: null, parentSku: null, familyHintDismissedAt: null },
      select: { id: true, sku: true, title: true },
      orderBy: { title: "asc" },
      take: 300,
    });
  },

  /** "Not one item": these listings are not suggested together again (family-merge Q21). */
  async dismissFamilyHint(ids: readonly string[], orgId: string, now: Date): Promise<number> {
    const result = await prisma.channelListing.updateMany({ where: { id: { in: [...ids] }, orgId }, data: { familyHintDismissedAt: now } });
    return result.count;
  },

  /** Whether any listing here is linked to a product in a family: once one is, the first group stops explaining itself (Q22). */
  async anyInFamily(connectionId: string): Promise<boolean> {
    return (await prisma.channelListing.count({ where: { connectionId, product: { familyId: { not: null } } }, take: 1 })) > 0;
  },

  /** Every live member of these variation groups, in any tab, with their products' families (family-merge D6). */
  async groupsFor(connectionId: string, parentSkus: readonly string[]) {
    if (parentSkus.length === 0) return [];
    return await prisma.channelListing.findMany({
      where: { connectionId, parentSku: { in: [...parentSkus] }, goneAt: null, leftOffAt: null },
      select: { id: true, parentSku: true, productId: true, product: { select: { familyId: true, family: { select: { id: true, name: true } } } } },
      orderBy: [{ title: "asc" }, { sku: "asc" }],
    });
  },

  /**
   * Of these products, the ones some live listing would send a count for: linked, not gone, on a
   * connected marketplace with stock sync on. One read for a whole stock change (inventory-sync Q27);
   * the push itself re-reads under its lock, so this only decides who is worth a push job.
   */
  async productsToPush(productIds: readonly string[]): Promise<Set<string>> {
    if (productIds.length === 0) return new Set();
    const rows = await prisma.channelListing.findMany({
      where: {
        productId: { in: [...productIds] },
        goneAt: null,
        connection: { state: CONNECTION_STATE.CONNECTED, stockSync: STOCK_SYNC.ON },
      },
      select: { productId: true, channel: true },
      distinct: ["productId", "channel"],
    });
    return new Set(rows.filter((r) => r.productId !== null && isMarketplaceChannel(r.channel)).map((r) => r.productId as string));
  },

  /** Every live listing linked to a product, with what a stock push needs (inventory-sync D3). */
  async linkedForPush(productId: string, db: Pick<typeof prisma, "channelListing"> = prisma) {
    return await db.channelListing.findMany({
      where: { productId, goneAt: null },
      select: {
        id: true,
        connectionId: true,
        channel: true,
        sku: true,
        externalId: true,
        attributes: true,
        stockSent: true,
        connection: { select: { state: true, stockSync: true, externalAccountId: true, orgId: true } },
      },
    });
  },

  /** The listings these SKUs name on a connection, for matching an order line to its product (D4). */
  async bySkus(connectionId: string, skus: readonly string[]) {
    return await prisma.channelListing.findMany({ where: { connectionId, sku: { in: [...skus] } }, select: { id: true, sku: true, productId: true } });
  },

  /** Every live linked listing on a connection, for the preview and the daily check (D5, D6). */
  async linkedOn(connectionId: string) {
    return await prisma.channelListing.findMany({
      where: { connectionId, productId: { not: null }, goneAt: null },
      select: { id: true, productId: true, sku: true, externalId: true, title: true, attributes: true, stockSent: true, product: { select: { name: true } } },
      orderBy: { title: "asc" },
    });
  },

  /** Linked listings the marketplace last showed in stock and that we have sent to since: Home's out-of-stock check (inventory-sync Q28). */
  async sentAfterRead(connectionId: string) {
    const rows = await prisma.channelListing.findMany({
      where: { connectionId, productId: { not: null }, goneAt: null, quantity: { gt: 0 }, stockSentAt: { not: null } },
      select: { stockSent: true, stockSentAt: true, lastSeenAt: true },
    });
    return rows.filter((r) => r.stockSentAt! > r.lastSeenAt);
  },

  /**
   * The daily problems look's answer for every account it read, in one statement (marketplace-publish
   * Q23): each listing named gets its problems, kept since it was first seen; a listing on those
   * accounts that had problems and was not named is clean again. Accounts not read are left as they were.
   */
  async recordProblems(
    connectionIds: readonly string[],
    found: ReadonlyArray<{ connectionId: string; sku: string; problems: unknown; suppressed: boolean }>,
    now: Date,
  ): Promise<Array<{ connectionId: string; sku: string; orgId: string; productId: string | null }>> {
    if (connectionIds.length === 0) return [];
    // Returns the rows it marked as having problems, so the caller names their products without a second read (setup-requests D5).
    return await prisma.$queryRaw<Array<{ connectionId: string; sku: string; orgId: string; productId: string | null }>>`
      WITH found AS (
        SELECT * FROM jsonb_to_recordset(${JSON.stringify(found)}::jsonb) AS f("connectionId" text, sku text, problems jsonb, suppressed boolean)
      )
      UPDATE "ChannelListing" c
      SET "problems" = f.problems,
          "problemsSince" = CASE WHEN f.sku IS NULL THEN NULL ELSE COALESCE(c."problemsSince", ${now}) END,
          "suppressed" = COALESCE(f.suppressed, false)
      FROM "ChannelListing" t
      LEFT JOIN found f ON f."connectionId" = t."connectionId" AND f.sku = t.sku
      WHERE c.id = t.id
        AND t."connectionId" = ANY(${[...connectionIds]}::text[])
        AND (f.sku IS NOT NULL OR t."problemsSince" IS NOT NULL)
      RETURNING c."connectionId", c.sku, c."orgId", CASE WHEN f.sku IS NULL THEN NULL ELSE c."productId" END AS "productId"`;
  },

  /** Clean again: a look after a publish found no error on this listing (marketplace-publish Q23). */
  async clearProblems(connectionId: string, sku: string): Promise<void> {
    await prisma.channelListing.updateMany({ where: { connectionId, sku, problemsSince: { not: null } }, data: { problems: Prisma.DbNull, problemsSince: null, suppressed: false } });
  },

  /** Linked listings with problems, per org: Home's line (Q23). */
  async problemCounts(orgId: string): Promise<Array<{ channel: string; problems: number; suppressed: number }>> {
    const rows = await prisma.channelListing.groupBy({
      by: ["channel", "suppressed"],
      where: { orgId, productId: { not: null }, goneAt: null, problemsSince: { not: null } },
      _count: { _all: true },
    });
    const byChannel = new Map<string, { channel: string; problems: number; suppressed: number }>();
    for (const r of rows) {
      const entry = byChannel.get(r.channel) ?? { channel: r.channel, problems: 0, suppressed: 0 };
      entry.problems += r._count._all;
      if (r.suppressed) entry.suppressed += r._count._all;
      byChannel.set(r.channel, entry);
    }
    return [...byChannel.values()];
  },

  /** The live linked mirror rows of these products on a connection: what a listing screen shows as "On Amazon now" (channel-listings D3, D5). */
  async mirrorsFor(connectionId: string, productIds: readonly string[]) {
    return await prisma.channelListing.findMany({
      where: { connectionId, productId: { in: [...productIds] }, goneAt: null },
      // A fixed order, so a product with two live mirrors names the same one to every caller.
      orderBy: [{ lastSeenAt: "desc" }, { id: "asc" }],
      select: { id: true, productId: true, sku: true, externalId: true, title: true, pricePaise: true, status: true, quantity: true, attributes: true, attributesReadAt: true, lastSeenAt: true, problems: true, problemsSince: true, suppressed: true },
    });
  },

  /**
   * The mirror row of a listing we created (marketplace-publish D6), linked to its product at once so
   * stock sync and the next read take it up. Keyed on (connection, SKU) like a read's, so a read that
   * got there first keeps its row and only gains the link where it has none.
   */
  async createLinked(data: { connectionId: string; orgId: string; channel: string; sku: string; productId: string; title: string; pricePaise: number; externalId: string | null }) {
    const now = new Date();
    return await prisma.channelListing.upsert({
      where: { connectionId_sku: { connectionId: data.connectionId, sku: data.sku } },
      create: { ...data, skuKey: data.sku.trim().toLowerCase(), status: LISTING_STATUS.LIVE, linkSource: LINK_SOURCE.OWNER, linkedAt: now, lastSeenAt: now },
      update: {},
      select: { id: true },
    });
  },

  /** A created listing's page id (Amazon's ASIN) once the marketplace names it; one already held stays. */
  async setExternalIdIfNone(connectionId: string, sku: string, externalId: string): Promise<void> {
    await prisma.channelListing.updateMany({ where: { connectionId, sku, externalId: null }, data: { externalId } });
  },

  /** The stored reads of these products' linked listings, for a marketplace's word on a fact (readiness-fix Q6). */
  async readsFor(orgId: string, productIds: readonly string[]) {
    return await prisma.channelListing.findMany({
      where: { orgId, productId: { in: [...productIds] }, goneAt: null, attributesReadAt: { not: null } },
      select: { productId: true, channel: true, attributes: true },
    });
  },

  /** Linked listings on a connection whose attributes were never read, for their one fill (marketplace-facts Q36). */
  async linkedUnread(connectionId: string, now: Date, take = 500): Promise<string[]> {
    const retryBefore = new Date(now.getTime() - FILL_RETRY_MS);
    const rows = await prisma.channelListing.findMany({
      where: { connectionId, productId: { not: null }, goneAt: null, attributesReadAt: null, OR: [{ attributesTriedAt: null }, { attributesTriedAt: { lt: retryBefore } }] },
      select: { id: true },
      take,
    });
    return rows.map((r) => r.id);
  },

  /** Marks a fill queued (Q36), so "Read again" and the same day's pass queue it once between them. */
  async markFillTried(ids: readonly string[], now: Date): Promise<void> {
    if (ids.length > 0) await prisma.channelListing.updateMany({ where: { id: { in: [...ids] } }, data: { attributesTriedAt: now } });
  },

  /** Linked mirror rows on a connection with no `PlatformListing` yet, for seeding (channel-listings D3). */
  async linkedWithoutPlatformListing(connectionId: string, take = 500) {
    return await prisma.channelListing.findMany({
      where: { connectionId, productId: { not: null }, goneAt: null, platformListing: null },
      select: { productId: true },
      take,
    });
  },

  /** What was last sent, or that the marketplace holds this listing's stock itself (FBA, Q5). */
  async recordStockSent(
    id: string,
    sent: { counts?: Array<{ externalId: string; quantity: number }>; heldByMarketplace?: boolean; refused?: boolean },
    now: Date,
    db: Pick<typeof prisma, "channelListing"> = prisma,
  ): Promise<void> {
    await db.channelListing.update({ where: { id }, data: { stockSent: sent as Prisma.InputJsonValue, stockSentAt: now }, select: { id: true } });
  },

  /** A count changed by hand on the marketplace: forget what was sent, so the next push sends again (D5). */
  async forgetStockSent(id: string): Promise<void> {
    await prisma.channelListing.update({ where: { id }, data: { stockSent: Prisma.DbNull }, select: { id: true } });
  },

  /** Turning sync on sends every listing again from scratch, keeping only what the marketplace stocks itself. */
  async resetStockSent(connectionId: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE "ChannelListing" SET "stockSent" = NULL
      WHERE "connectionId" = ${connectionId} AND ("stockSent" IS NULL OR NOT ("stockSent" ? 'heldByMarketplace'))`;
  },

  /** The listings a family page names, with their products and those products' families (family-merge D2). */
  async forFamily(ids: readonly string[], orgId: string) {
    const rows = await prisma.channelListing.findMany({
      where: { id: { in: [...ids] }, orgId },
      select: {
        id: true,
        connectionId: true,
        channel: true,
        sku: true,
        skuKey: true,
        externalId: true,
        title: true,
        imageUrl: true,
        status: true,
        pricePaise: true,
        quantity: true,
        parentSku: true,
        parentTitle: true,
        productId: true,
        leftOffAt: true,
        goneAt: true,
        attributes: true,
        attributesReadAt: true,
        connection: { select: { externalAccountId: true, state: true } },
        product: { select: { id: true, name: true, sku: true, price: true, archivedAt: true, categoryId: true, productType: true, familyId: true, family: { select: { id: true, name: true } } } },
      },
      orderBy: [{ title: "asc" }, { sku: "asc" }],
    });
    // A linked product's answers, from the value rows where they live (listing-model/dynamic-form Q16).
    const answers = await productAnswersService.answersFor(rows.flatMap((r) => (r.product ? [r.product.id] : [])));
    return rows.map((r) => ({ ...r, product: r.product ? { ...r.product, facts: answers.get(r.product.id)?.facts ?? {}, measurements: answers.get(r.product.id)?.measurements ?? {} } : null }));
  },

  /**
   * Lock a family's listings first, while each is unsettled or still linked to the product the
   * page named (family-merge D3). A second save of the same group waits here and finds them taken.
   */
  async lockForFamily(
    tx: Prisma.TransactionClient,
    rows: ReadonlyArray<{ id: string; productId: string | null }>,
    orgId: string,
  ): Promise<number> {
    let locked = 0;
    for (const row of rows) {
      const found = row.productId
        ? await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM "ChannelListing" WHERE id = ${row.id} AND "orgId" = ${orgId} AND "productId" = ${row.productId} FOR UPDATE`
        : await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM "ChannelListing" WHERE id = ${row.id} AND "orgId" = ${orgId} AND "productId" IS NULL AND "leftOffAt" IS NULL FOR UPDATE`;
      locked += found.length;
    }
    return locked;
  },

  /** The marketplace's own type for each parked listing, from its stored read, without the rest of it (Q13). */
  async marketplaceTypes(ids: readonly string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await prisma.$queryRaw<Array<{ id: string; type: string | null }>>`
      SELECT id, attributes->>'type' AS type FROM "ChannelListing" WHERE id IN (${Prisma.join([...ids])})`;
    return new Map(rows.filter((r) => r.type).map((r) => [r.id, r.type as string]));
  },

  /** "Skip for now" on one fact, or asking it again (marketplace-facts D6). */
  async setSkip(id: string, orgId: string, fact: string, skipped: boolean): Promise<boolean> {
    // One statement each, so two quick skips on different facts both stay.
    const count = skipped
      ? await prisma.$executeRaw`
          UPDATE "ChannelListing" SET "attributeSkips" = array_append(array_remove("attributeSkips", ${fact}), ${fact})
          WHERE id = ${id} AND "orgId" = ${orgId}`
      : await prisma.$executeRaw`
          UPDATE "ChannelListing" SET "attributeSkips" = array_remove("attributeSkips", ${fact})
          WHERE id = ${id} AND "orgId" = ${orgId}`;
    return count === 1;
  },

  /** A linked listing as filling and its card need it: where to read it, and what was read. */
  async forFacts(orgId: string, where: { id: string } | { productId: string }) {
    return await prisma.channelListing.findMany({
      where: { orgId, ...where, productId: "productId" in where ? where.productId : { not: null } },
      select: {
        id: true,
        orgId: true,
        channel: true,
        connectionId: true,
        sku: true,
        title: true,
        externalId: true,
        productId: true,
        attributes: true,
        attributesReadAt: true,
        attributeSkips: true,
        goneAt: true,
        connection: { select: { externalAccountId: true, state: true } },
      },
      orderBy: { linkedAt: "desc" },
    });
  },

  /** Where one product is linked, across the shop's connections (R11). */
  async forProduct(orgId: string, productId: string) {
    return await prisma.channelListing.findMany({
      where: { orgId, productId },
      select: {
        id: true,
        connectionId: true,
        externalId: true,
        status: true,
        pricePaise: true,
        quantity: true,
        goneAt: true,
        linkSource: true,
        photoTotal: true,
        photoDone: true,
        photoFailed: true,
        stockSent: true,
        stockSentAt: true,
      },
      // A product has at most one live listing per connection; the newest link wins the block.
      orderBy: { linkedAt: "desc" },
    });
  },
};
