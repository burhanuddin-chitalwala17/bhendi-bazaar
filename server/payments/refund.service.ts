import type { Prisma } from "@prisma/client";
import { indiaDay } from "@server/shared/india-time";
import { refundRepository } from "@server/payments/refund.repository";
import type { BuyerRefundView, RefundCause, RefundState } from "@server/payments/refund.types";

/**
 * Refunds owed to buyers (order-fulfilment D16). Payments records the entitlement; checkout computes
 * the amount from the order (Invariant 1) and calls in on the move's transaction. `paymentStatus`
 * is never touched here: a refund owed is not a payment undone.
 */
class RefundService {
  /** What the order's refunds already add up to, under the order lock the caller holds. */
  async owedSoFar(orderId: string, tx: Prisma.TransactionClient): Promise<number> {
    return await refundRepository.owedSoFar(orderId, tx);
  }

  /** Record a parcel's refund owed, once per parcel. Nothing is written for zero. */
  async recordOwed(
    row: { orderId: string; shipmentId: string; cause: RefundCause; amountPaise: number },
    tx: Prisma.TransactionClient,
  ): Promise<boolean> {
    if (row.amountPaise <= 0) return false;
    return await refundRepository.recordOwed(row, tx);
  }

  /** Each parcel's refund on an order, for its buyer. */
  async forOrder(orderId: string): Promise<BuyerRefundView[]> {
    return (await refundRepository.forOrder(orderId)).map((r) => ({
      shipmentId: r.shipmentId,
      amountPaise: r.amountPaise,
      state: r.state as RefundState,
      startedDay: r.startedAt ? indiaDay(r.startedAt) : null,
    }));
  }
}

export const refundService = new RefundService();
