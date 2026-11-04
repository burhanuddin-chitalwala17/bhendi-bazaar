import { LedgerEntryKind } from "@prisma/client";
import { prisma } from "@server/shared/prisma";
import { INDIA_ZONE } from "@server/shared/india-time";
import { ORDER_STATUS, PAYMENT_STATUS } from "@server/checkout/order.types";
import { SHIPMENT_STATUS } from "@server/shipping/domain/shipping.types";
import { SELLING_WINDOW_DAYS } from "@server/analytics/attention.types";

/** [from, to) for the current period and the one before it. */
export interface SalesWindows {
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
}

/**
 * Paid sales, grouped by the database. Analytics is the documented read-only exception to
 * no-cross-domain-reads (CLAUDE.md); the predicates below are PAID_ORDER_WHERE and
 * LIVE_PARCEL_WHERE spelled in SQL, because a day bucket in India time is not expressible in Prisma.
 */
export const salesRepository = {
  /** Both periods' India days in one grouped statement: paise and order count per day. */
  async byDay(w: SalesWindows): Promise<{ day: string; paise: number; orders: number }[]> {
    const rows = await prisma.$queryRaw<{ day: string; paise: bigint; orders: bigint }[]>`
      SELECT to_char((COALESCE(o."paidAt", o."createdAt") AT TIME ZONE 'UTC') AT TIME ZONE ${INDIA_ZONE}, 'YYYY-MM-DD') AS day,
             SUM(o."grandTotal")::bigint AS paise,
             COUNT(*)::bigint AS orders
      FROM "Order" o
      WHERE o."paymentStatus" = ${PAYMENT_STATUS.PAID}
        AND o.status <> ${ORDER_STATUS.CANCELLED}
        AND ((COALESCE(o."paidAt", o."createdAt") >= ${w.from} AND COALESCE(o."paidAt", o."createdAt") < ${w.to})
          OR (COALESCE(o."paidAt", o."createdAt") >= ${w.previousFrom} AND COALESCE(o."paidAt", o."createdAt") < ${w.previousTo}))
      GROUP BY 1
      ORDER BY 1`;
    return rows.map((r) => ({ day: r.day, paise: Number(r.paise), orders: Number(r.orders) }));
  },

  /**
   * What the platform kept (org-payouts D2: goods − both funded discounts − payable, which is
   * commission less campaign cost on a sale and a fee on a cancellation) and how many shops sold,
   * for both periods, in one statement.
   */
  async figures(w: SalesWindows): Promise<{ kept: number; previousKept: number; shops: number; previousShops: number }> {
    const [row] = await prisma.$queryRaw<{ kept: bigint; previousKept: bigint; shops: bigint; previousShops: bigint }[]>`
      WITH kept AS (
        SELECT
          COALESCE(SUM(e."grossItemsPaise" - e."orgFundedDiscountPaise" - e."platformFundedDiscountPaise" - e."payablePaise")
            FILTER (WHERE e."createdAt" >= ${w.from} AND e."createdAt" < ${w.to}), 0)::bigint AS current,
          COALESCE(SUM(e."grossItemsPaise" - e."orgFundedDiscountPaise" - e."platformFundedDiscountPaise" - e."payablePaise")
            FILTER (WHERE e."createdAt" >= ${w.previousFrom} AND e."createdAt" < ${w.previousTo}), 0)::bigint AS previous
        FROM "OrgLedgerEntry" e
        WHERE e."deletedAt" IS NULL
          AND ((e."createdAt" >= ${w.from} AND e."createdAt" < ${w.to}) OR (e."createdAt" >= ${w.previousFrom} AND e."createdAt" < ${w.previousTo}))
      ), sold AS (
        SELECT
          COUNT(DISTINCT s."orgId") FILTER (WHERE COALESCE(o."paidAt", o."createdAt") >= ${w.from} AND COALESCE(o."paidAt", o."createdAt") < ${w.to})::bigint AS current,
          COUNT(DISTINCT s."orgId") FILTER (WHERE COALESCE(o."paidAt", o."createdAt") >= ${w.previousFrom} AND COALESCE(o."paidAt", o."createdAt") < ${w.previousTo})::bigint AS previous
        FROM "Shipment" s JOIN "Order" o ON o.id = s."orderId"
        WHERE o."paymentStatus" = ${PAYMENT_STATUS.PAID}
          AND o.status <> ${ORDER_STATUS.CANCELLED}
          AND s.status <> ${SHIPMENT_STATUS.CANCELLED}
          AND ((COALESCE(o."paidAt", o."createdAt") >= ${w.from} AND COALESCE(o."paidAt", o."createdAt") < ${w.to})
            OR (COALESCE(o."paidAt", o."createdAt") >= ${w.previousFrom} AND COALESCE(o."paidAt", o."createdAt") < ${w.previousTo}))
      )
      SELECT kept.current AS kept, kept.previous AS "previousKept", sold.current AS shops, sold.previous AS "previousShops"
      FROM kept, sold`;
    return {
      kept: Number(row.kept),
      previousKept: Number(row.previousKept),
      shops: Number(row.shops),
      previousShops: Number(row.previousShops),
    };
  },

  /**
   * One shop's sales by India day for both periods, from its payouts ledger (design-system Q34):
   * a SALE is written at payment and a REVERSAL negates a cancelled parcel, so the two net out.
   * Goods less both funded discounts is what the buyer paid for this shop's goods; the payable is
   * what the shop is owed, fees included. One SALE per order and shop, so counting SALEs counts orders.
   */
  async shopByDay(w: SalesWindows, orgId: string): Promise<{ day: string; paise: number; orders: number; payable: number }[]> {
    const rows = await prisma.$queryRaw<{ day: string; paise: bigint; orders: bigint; payable: bigint }[]>`
      SELECT to_char((e."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${INDIA_ZONE}, 'YYYY-MM-DD') AS day,
             COALESCE(SUM(e."grossItemsPaise" - e."orgFundedDiscountPaise" - e."platformFundedDiscountPaise")
               FILTER (WHERE e.kind IN (${LedgerEntryKind.SALE}::"LedgerEntryKind", ${LedgerEntryKind.REVERSAL}::"LedgerEntryKind")), 0)::bigint AS paise,
             COUNT(*) FILTER (WHERE e.kind = ${LedgerEntryKind.SALE}::"LedgerEntryKind")::bigint AS orders,
             COALESCE(SUM(e."payablePaise"), 0)::bigint AS payable
      FROM "OrgLedgerEntry" e
      WHERE e."orgId" = ${orgId}
        AND e."deletedAt" IS NULL
        AND ((e."createdAt" >= ${w.from} AND e."createdAt" < ${w.to}) OR (e."createdAt" >= ${w.previousFrom} AND e."createdAt" < ${w.previousTo}))
      GROUP BY 1
      ORDER BY 1`;
    return rows.map((r) => ({ day: r.day, paise: Number(r.paise), orders: Number(r.orders), payable: Number(r.payable) }));
  },

  /** One shop's paid parcels still packing, and when the longest-waiting buyer paid. */
  async toPack(orgId: string): Promise<{ count: number; oldestPaidAt: Date | null }> {
    const [row] = await prisma.$queryRaw<{ count: bigint; oldest: Date | null }[]>`
      SELECT COUNT(*)::bigint AS count, MIN(COALESCE(o."paidAt", o."createdAt")) AS oldest
      FROM "Shipment" s JOIN "Order" o ON o.id = s."orderId"
      WHERE s."orgId" = ${orgId}
        AND s.status = ${SHIPMENT_STATUS.PACKING}
        AND o."paymentStatus" = ${PAYMENT_STATUS.PAID}
        AND o.status <> ${ORDER_STATUS.CANCELLED}`;
    return { count: Number(row.count), oldestPaidAt: row.oldest };
  },

  /**
   * One shop's on-sale products at or below their own threshold that sold since `since` (Q31), and
   * the days the soonest runs out at its selling rate. Archived is `archivedAt IS NULL` (AVAILABLE).
   */
  async sellingLowStock(orgId: string, since: Date): Promise<{ count: number; soldOut: number; soonestDays: number | null }> {
    const [row] = await prisma.$queryRaw<{ count: bigint; soldOut: bigint; soonestDays: bigint | null }[]>`
      WITH sold AS (
        SELECT oi."productId", SUM(oi.quantity)::bigint AS units
        FROM "OrderItem" oi
        JOIN "Order" o ON o.id = oi."orderId"
        JOIN "Product" p ON p.id = oi."productId"
        WHERE p."orgId" = ${orgId}
          AND p."archivedAt" IS NULL
          AND o."paymentStatus" = ${PAYMENT_STATUS.PAID}
          AND o.status <> ${ORDER_STATUS.CANCELLED}
          AND COALESCE(o."paidAt", o."createdAt") >= ${since}
        GROUP BY oi."productId"
      ), low AS (
        SELECT sold.units, COALESCE(SUM(ps.quantity), 0)::bigint AS stock
        FROM sold
        JOIN "Product" p ON p.id = sold."productId"
        LEFT JOIN "ProductStock" ps ON ps."productId" = sold."productId"
        GROUP BY sold."productId", sold.units, p."lowStockThreshold"
        HAVING COALESCE(SUM(ps.quantity), 0) <= p."lowStockThreshold"
      )
      SELECT COUNT(*)::bigint AS count,
             COUNT(*) FILTER (WHERE stock <= 0)::bigint AS "soldOut",
             MIN((stock * ${SELLING_WINDOW_DAYS}) / units) FILTER (WHERE stock > 0)::bigint AS "soonestDays"
      FROM low
      WHERE units > 0`;
    return {
      count: Number(row.count),
      soldOut: Number(row.soldOut),
      soonestDays: row.soonestDays === null ? null : Number(row.soonestDays),
    };
  },
};
