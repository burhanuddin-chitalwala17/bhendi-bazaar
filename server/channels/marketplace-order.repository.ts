import { Prisma } from "@prisma/client";
import { prisma } from "@server/shared/prisma";

import { ORDER_LINE_STATE, type MarketplaceOrderLine } from "./providers/stock";

type Db = Prisma.TransactionClient | typeof prisma;

const ROW = {
  id: true,
  orderId: true,
  lineId: true,
  sku: true,
  productId: true,
  orgAddressId: true,
  quantity: true,
  taken: true,
  oversold: true,
  state: true,
  restockedAt: true,
  amountPaise: true,
  orderedAt: true,
  channel: true,
  locationGuessed: true,
  beforeSync: true,
} as const;

/**
 * The one way to reach `MarketplaceOrder` (Invariant 5): each marketplace order line, recorded once
 * however often it is reported (inventory-sync D4). The unique key is the once-only.
 */
export const marketplaceOrderRepository = {
  /** The line as first seen, or the row already holding it. `created` says which. */
  async claim(
    db: Db,
    input: { connectionId: string; orgId: string; channel: string; line: MarketplaceOrderLine; listingId: string | null; productId: string | null; orgAddressId: string | null; locationGuessed: boolean; beforeSync: boolean },
  ) {
    const { line } = input;
    // Skip-on-conflict rather than catch: a failed insert would abort the caller's transaction.
    const { count } = await db.marketplaceOrder.createMany({
      data: [
        {
          connectionId: input.connectionId,
          orgId: input.orgId,
          channel: input.channel,
          orderId: line.orderId,
          lineId: line.lineId,
          sku: line.sku,
          listingId: input.listingId,
          productId: input.productId,
          locationExternalId: line.locationExternalId,
          orgAddressId: input.orgAddressId,
          locationGuessed: input.locationGuessed,
          beforeSync: input.beforeSync,
          quantity: line.quantity,
          amountPaise: line.amountPaise,
          state: line.state,
          orderedAt: line.orderedAt,
        },
      ],
      skipDuplicates: true,
    });
    const row = await db.marketplaceOrder.findUniqueOrThrow({
      where: { connectionId_orderId_lineId: { connectionId: input.connectionId, orderId: line.orderId, lineId: line.lineId } },
      select: ROW,
    });
    return { row, created: count === 1 };
  },

  /** The lines already recorded for these orders, in one read, so an unchanged one costs nothing (Q23). */
  async known(connectionId: string, orderIds: readonly string[]) {
    if (orderIds.length === 0) return [];
    return await prisma.marketplaceOrder.findMany({ where: { connectionId, orderId: { in: [...orderIds] } }, select: { orderId: true, lineId: true, state: true } });
  },

  async recordTaken(db: Db, id: string, taken: number, oversold: boolean): Promise<void> {
    await db.marketplaceOrder.update({ where: { id }, data: { taken, oversold }, select: { id: true } });
  },

  async setState(db: Db, id: string, state: string): Promise<void> {
    await db.marketplaceOrder.updateMany({ where: { id, state: { not: state } }, data: { state } });
  },

  /** A cancellation before dispatch restocks once: the conditional update is the once-only (Q8). */
  async claimRestock(db: Db, id: string, now: Date): Promise<boolean> {
    const result = await db.marketplaceOrder.updateMany({
      where: { id, restockedAt: null, state: { not: ORDER_LINE_STATE.SHIPPED }, taken: { gt: 0 } },
      data: { restockedAt: now, state: ORDER_LINE_STATE.CANCELLED },
    });
    return result.count === 1;
  },

  /** The shop's marketplace orders, newest first (Q10). */
  async page(orgId: string, pages: number) {
    const rows = await prisma.marketplaceOrder.findMany({ where: { orgId }, select: ROW, orderBy: { orderedAt: "desc" }, take: pages * 50 + 1 });
    return { rows: rows.slice(0, pages * 50), hasMore: rows.length > pages * 50 };
  },

  /** A product's latest oversold line still waiting to ship, for its page's line (Q7); shipped or cancelled, it is settled. */
  async latestOversold(productId: string) {
    return await prisma.marketplaceOrder.findFirst({ where: { productId, oversold: true, state: ORDER_LINE_STATE.OPEN }, select: ROW, orderBy: { orderedAt: "desc" } });
  },
};
