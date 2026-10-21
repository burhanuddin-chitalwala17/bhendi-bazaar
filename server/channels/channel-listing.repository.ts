import type { Prisma } from "@prisma/client";
import { prisma } from "@server/shared/prisma";

import { LINK_SOURCE, type MarketplaceChannel } from "./channel-connection.types";

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
  goneAt: true,
  product: PRODUCT,
} as const;

export type ListingRow = Prisma.ChannelListingGetPayload<{ select: typeof ROW }>;

export type ListingFilter = "linked" | "notLinked";

const PAGE_SIZE = 50;

const filterWhere = (filter: ListingFilter): Prisma.ChannelListingWhereInput =>
  filter === "linked" ? { productId: { not: null } } : { productId: null };

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
      where: { connectionId, productId: null, unlinkedAt: null, skuKey: { in: [...skuKeys] } },
      select: { id: true, skuKey: true },
    });
  },

  /** Link rows automatically. Conditional, so a row the owner touched meanwhile is left alone. */
  async linkBySku(links: ReadonlyArray<{ id: string; productId: string }>, now: Date): Promise<number> {
    let linked = 0;
    for (const link of links) {
      const result = await prisma.channelListing.updateMany({
        where: { id: link.id, productId: null, unlinkedAt: null },
        data: { productId: link.productId, linkSource: LINK_SOURCE.SKU, linkedAt: now },
      });
      linked += result.count;
    }
    return linked;
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
      where: { id, orgId, productId: null, unlinkedAt: { not: null } },
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
  async tabCounts(connectionId: string): Promise<{ linked: number; notLinked: number }> {
    const [linked, all] = await Promise.all([
      prisma.channelListing.count({ where: { connectionId, productId: { not: null } } }),
      prisma.channelListing.count({ where: { connectionId } }),
    ]);
    return { linked, notLinked: all - linked };
  },

  /** What is on the marketplace now, for the card: gone rows left out. */
  async counts(connectionId: string): Promise<{ linked: number; notLinked: number; total: number }> {
    const [linked, total] = await Promise.all([
      prisma.channelListing.count({ where: { connectionId, productId: { not: null }, goneAt: null } }),
      prisma.channelListing.count({ where: { connectionId, goneAt: null } }),
    ]);
    return { linked, notLinked: total - linked, total };
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
      },
      // A product has at most one live listing per connection; the newest link wins the block.
      orderBy: { linkedAt: "desc" },
    });
  },
};
