import type { Prisma } from "@prisma/client";
import { prisma } from "@server/shared/prisma";
import { indiaDay } from "@server/shared/india-time";
import { ConflictError, NotFoundError } from "@server/shared/domain-error";
import { refundRepository } from "@server/payments/refund.repository";
import { GATEWAY_NOT_CONFIGURED, razorpayRepository } from "@server/payments/providers/razorpay/razorpay.repository";
import type { GatewayRefundResult } from "@server/payments/payment.types";
import {
  REFUND_REQUEST_STALE_MS,
  REFUND_STATE,
  shownRefundState,
  type AdminRefundRecord,
  type BuyerRefundView,
  type RefundCause,
  type RefundStartOutcome,
  type RefundState,
} from "@server/payments/refund.types";

export const REFUND_NOT_FOUND = "Refund not found";
/** Our words, not Razorpay's: a paid order with no captured payment cannot be refunded through it (Q38). */
export const NO_GATEWAY_PAYMENT = "This order has no captured Razorpay payment, so it can't be refunded from here.";

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

  /**
   * Start a refund at the gateway (order-fulfilment D17, A9). One press claims the row; a row that
   * was ever sent is first looked up by its receipt, so a retry after a timeout adopts the refund
   * the gateway already made instead of making a second. `onStarted` runs on the transaction that
   * records the start — the buyer's email is written with it (R14).
   */
  async start(
    refundId: string,
    checkout: {
      /** The order's captured gateway payment: checkout owns the order. */
      paymentOf: (orderId: string) => Promise<string | null>;
      /** This press won the row: who pressed is recorded before the gateway is asked. */
      onClaimed?: () => Promise<void>;
      onStarted: (row: { shipmentId: string; amountPaise: number }, tx: Prisma.TransactionClient) => Promise<void>;
    },
    now: Date = new Date(),
  ): Promise<RefundStartOutcome> {
    const row = await refundRepository.findById(refundId);
    if (!row) throw new NotFoundError(REFUND_NOT_FOUND);
    const paymentId = await checkout.paymentOf(row.orderId);
    const sentBefore = row.state !== REFUND_STATE.OWED;
    // Refused before the claim: the row stays as it was, and the reason is ours, not the gateway's (Q38).
    if (!paymentId) throw new ConflictError(NO_GATEWAY_PAYMENT);
    if (!razorpayRepository.refundsConfigured()) throw new ConflictError(GATEWAY_NOT_CONFIGURED);
    if (!(await refundRepository.claim(refundId, now, new Date(now.getTime() - REFUND_REQUEST_STALE_MS)))) return { kind: "already" };
    await checkout.onClaimed?.();

    const answer = await this.ask(refundId, paymentId, row.amountPaise, sentBefore);
    if (answer.kind === "started") {
      const recorded = await prisma.$transaction(async (tx) => {
        const won = await refundRepository.settle(
          refundId, now, { state: REFUND_STATE.STARTED, gatewayRefundId: answer.gatewayRefundId, startedAt: new Date() }, tx,
        );
        if (won) await checkout.onStarted({ shipmentId: row.shipmentId, amountPaise: row.amountPaise }, tx);
        return won;
      });
      return recorded ? { kind: "started", gatewayRefundId: answer.gatewayRefundId, amountPaise: row.amountPaise } : { kind: "already" };
    }
    if (answer.kind === "refused") {
      await refundRepository.settle(refundId, now, { state: REFUND_STATE.FAILED, failureReason: answer.reason });
      return { kind: "refused", reason: answer.reason };
    }
    await refundRepository.settle(refundId, now, { state: REFUND_STATE.UNCONFIRMED });
    return { kind: "unconfirmed" };
  }

  /** Adopt what the gateway already holds under this receipt, else ask once. A failed lookup is unknown. */
  private async ask(refundId: string, paymentId: string, amountPaise: number, sentBefore: boolean): Promise<GatewayRefundResult> {
    if (sentBefore) {
      try {
        const found = await razorpayRepository.findRefundByReceipt(paymentId, refundId);
        if (found) return found;
      } catch (error) {
        console.error("[refund] receipt lookup failed; not asking again blind", { refundId, error });
        return { kind: "unknown" };
      }
    }
    return await razorpayRepository.createRefund({ paymentId, amount: amountPaise, receipt: refundId });
  }

  /** One page of the admin's list, and the counts its heading and pager read. */
  async listForAdmin(page: { skip: number; take: number }, now: Date = new Date()): Promise<AdminRefundRecord[]> {
    return (await refundRepository.listForAdmin(page)).map(({ requestedAt, ...r }) => ({
      ...r,
      cause: r.cause as RefundCause,
      state: shownRefundState(r.state as RefundState, requestedAt, now),
    }));
  }

  async counts(): Promise<{ all: number; notStarted: number }> {
    return await refundRepository.countAll();
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
