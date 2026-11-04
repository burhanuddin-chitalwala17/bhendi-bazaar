import { prisma } from "@server/shared/prisma";
import { REFUND_STATE } from "@server/payments/refund.types";
import { SHIPMENT_STATUS } from "@server/shipping/domain/shipping.types";
import type { AdminAttentionCounts } from "@server/analytics/attention.types";

/**
 * The admin's "Needs attention", as one statement (Q31). Each CTE repeats its owner's definition:
 * a refund not yet acted on is the refund queue's (not STARTED, and not a request still in flight,
 * D17); an open courier conflict is one AWB until dismissed, as the conflicts tab folds it; owed is
 * payouts' unclaimed balance (org-payouts D7); a live product is `archivedAt IS NULL` (AVAILABLE)
 * at a trading org (FROM_ACTIVE_ORG).
 */
export const attentionRepository = {
  async adminCounts(at: { requestInFlightAfter: Date; readyBefore: Date; payoutEntryBefore: Date }): Promise<AdminAttentionCounts> {
    const [row] = await prisma.$queryRaw<
      {
        refunds: bigint; refundBuyers: bigint; refundPaise: bigint; refundOldest: Date | null;
        parcels: bigint; parcelOldest: Date | null;
        payoutShops: bigint; payoutPaise: bigint; payoutOldest: Date | null;
        conflicts: bigint; conflictOldest: Date | null;
      }[]
    >`
      WITH r AS (
        SELECT COUNT(*)::bigint AS n, COUNT(DISTINCT "orderId")::bigint AS buyers,
               COALESCE(SUM("amountPaise"), 0)::bigint AS paise, MIN("createdAt") AS oldest
        FROM "Refund"
        WHERE state::text <> ${REFUND_STATE.STARTED}
          AND NOT (state::text = ${REFUND_STATE.REQUESTED} AND "requestedAt" > ${at.requestInFlightAfter})
      ), ready AS (
        SELECT COALESCE(
                 (SELECT MAX(e."createdAt") FROM "ParcelEvent" e
                  WHERE e."shipmentId" = s.id AND e."toStatus" = ${SHIPMENT_STATUS.READY_FOR_PICKUP}),
                 s."updatedAt") AS since
        FROM "Shipment" s
        WHERE s.status = ${SHIPMENT_STATUS.READY_FOR_PICKUP}
      ), p AS (
        SELECT COUNT(*)::bigint AS n, MIN(since) AS oldest FROM ready WHERE since <= ${at.readyBefore}
      ), balance AS (
        SELECT SUM("payablePaise") AS owed, MIN("createdAt") AS oldest
        FROM "OrgLedgerEntry"
        WHERE "deletedAt" IS NULL AND "settlementId" IS NULL
        GROUP BY "orgId"
      ), pay AS (
        SELECT COUNT(*)::bigint AS shops, COALESCE(SUM(owed), 0)::bigint AS paise, MIN(oldest) AS oldest
        FROM balance WHERE owed > 0 AND oldest <= ${at.payoutEntryBefore}
      ), c AS (
        SELECT COUNT(DISTINCT awb)::bigint AS n, MIN("createdAt") AS oldest
        FROM "CourierConflict" WHERE "dismissedAt" IS NULL
      )
      SELECT r.n AS refunds, r.buyers AS "refundBuyers", r.paise AS "refundPaise", r.oldest AS "refundOldest",
             p.n AS parcels, p.oldest AS "parcelOldest",
             pay.shops AS "payoutShops", pay.paise AS "payoutPaise", pay.oldest AS "payoutOldest",
             c.n AS conflicts, c.oldest AS "conflictOldest"
      FROM r, p, pay, c`;
    return {
      refunds: { count: Number(row.refunds), buyers: Number(row.refundBuyers), amountPaise: Number(row.refundPaise), oldestAt: row.refundOldest },
      parcelsToBook: { count: Number(row.parcels), oldestAt: row.parcelOldest },
      payouts: { shops: Number(row.payoutShops), amountPaise: Number(row.payoutPaise), oldestAt: row.payoutOldest },
      courierConflicts: { count: Number(row.conflicts), oldestAt: row.conflictOldest },
    };
  },
};
