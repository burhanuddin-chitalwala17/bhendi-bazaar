import { indiaDay } from "@server/shared/india-time";
import { refundService } from "@server/payments/refund.service";
import type { RefundCause, RefundState } from "@server/payments/refund.types";
import { parcelRefundContexts } from "@server/shipping/shipment-status.service";
import type { ParcelActor } from "@server/shipping/domain/shipping.types";
import { orderRepository } from "@server/checkout/order.repository";

/** Rows per page (ux.md "admin refunds" Many items). */
export const REFUNDS_PAGE = 50;

/** One refund on the admin's list (TRD UI approach `RefundRow`). */
export interface RefundRow {
  id: string;
  orderId: string;
  orderCode: string;
  /** Null for a payment captured after its order was released (unmatched-payments). */
  parcelCode: string | null;
  amountPaise: number;
  /** The state that made it owed (Q25), and who cancelled when it was a cancel. */
  cause: RefundCause;
  cancelledBy: ParcelActor | null;
  /** A request whose answer never came reads UNCONFIRMED (D17). */
  state: RefundState;
  gatewayRefundId: string | null;
  failureReason: string | null;
  /** The order's Razorpay payment, for "Open in Razorpay". */
  paymentId: string | null;
  /** Whole days since it was owed; amber past 2 (ux.md Stale). */
  owedDays: number;
  /** "3 Nov" once started. */
  startedDay: string | null;
}

const DAY_MS = 86_400_000;

/** One page of the admin's refunds, `page` from 1: not started first, oldest first; then started, newest. */
export async function listRefunds(page = 1, now: Date = new Date()): Promise<RefundRow[]> {
  const skip = (Math.max(1, Math.floor(page)) - 1) * REFUNDS_PAGE;
  const records = await refundService.listForAdmin({ skip, take: REFUNDS_PAGE }, now);
  const [parcels, orders] = await Promise.all([
    parcelRefundContexts(records.flatMap((r) => (r.shipmentId ? [r.shipmentId] : []))),
    orderRepository.refundContextsOf([...new Set(records.map((r) => r.orderId))]),
  ]);
  return records.map((r) => {
    const parcel = r.shipmentId ? parcels.get(r.shipmentId) : undefined;
    const order = orders.get(r.orderId);
    return {
      id: r.id,
      orderId: r.orderId,
      orderCode: parcel?.orderCode ?? order?.code ?? "",
      parcelCode: r.shipmentId ? (parcel?.parcelCode ?? "") : null,
      amountPaise: r.amountPaise,
      cause: r.cause,
      cancelledBy: parcel?.cancelledBy ?? null,
      state: r.state,
      gatewayRefundId: r.gatewayRefundId,
      failureReason: r.failureReason,
      // "Open in Razorpay" shows the payment this row refunds.
      paymentId: r.gatewayPaymentId ?? order?.paymentId ?? null,
      owedDays: Math.floor((now.getTime() - r.createdAt.getTime()) / DAY_MS),
      startedDay: r.startedAt ? indiaDay(r.startedAt) : null,
    };
  });
}

export async function refundCounts(): Promise<{ all: number; notStarted: number }> {
  return await refundService.counts();
}
