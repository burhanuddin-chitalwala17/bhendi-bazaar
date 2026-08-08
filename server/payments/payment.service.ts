/**
 * Server-side Payment Service
 *
 * This service encapsulates all business logic related to payments.
 * It delegates to the appropriate payment gateway repository.
 */

import { razorpayRepository } from "@server/payments/providers/razorpay/razorpay.repository";
import type {
  ServerPaymentOrder,
  CreatePaymentOrderInput,
  VerifyPaymentInput,
  PaymentVerificationResult,
  WebhookVerificationResult,
} from "@server/payments/payment.types";
import { ConflictError, DomainError } from "@server/shared/domain-error";
import { orderService } from "@server/checkout/order.service";
import { orderRepository } from "@server/checkout/order.repository";
import { decideConfirmation } from "@server/payments/confirmation";
import { RAZORPAY_NOTES_ORDER_KEY } from "@server/payments/notes";

export class PaymentService {
  /**
   * Create a payment order
   */
  async createPaymentOrder(
    input: CreatePaymentOrderInput
  ): Promise<ServerPaymentOrder> {
    // The amount is read from the persisted order, never from the request — the
    // order's grandTotal was itself computed from the catalogue inside the creation
    // transaction (ADR-0002). checkout is called through its public surface.
    const order = await orderService.getOrderById(input.localOrderId); // throws NotFound itself
    if (order.paymentStatus === "paid") {
      throw new ConflictError("This order is already paid");
    }

    const amount = order.grandTotal;
    this.validateDerivedAmount(amount);

    const gatewayOrder = await razorpayRepository.createOrder({
      amount,
      currency: "INR",
      localOrderId: input.localOrderId,
      customer: input.customer,
    });

    // The confirmation matches against this persisted linkage — a signal for some
    // other gateway order then proves nothing about this order.
    await orderRepository.attachGatewayOrder(input.localOrderId, gatewayOrder.gatewayOrderId);

    return gatewayOrder;
  }

  /**
   * The one confirmation routine (trd.md D1), reached by both triggers: the browser's
   * post-payment return (with a signature to verify) and the gateway webhook (whose
   * body signature the route already verified). Verify what arrived, load the
   * persisted order, decide, and let the conditional write race safely.
   */
  async confirmPayment(input: {
    localOrderId: string;
    gatewayOrderId: string;
    paymentId: string;
    /** Browser-return trigger: the per-payment signature. Absent for webhook calls. */
    signature?: string;
    /** Webhook trigger: the captured amount in paise. */
    amount?: number;
  }) {
    if (input.signature !== undefined) {
      const verification = await razorpayRepository.verifyPayment({
        gatewayOrderId: input.gatewayOrderId,
        paymentId: input.paymentId,
        signature: input.signature,
      });
      if (!verification.isValid) {
        throw new DomainError("Payment could not be verified", { status: 400 });
      }
    }

    const order = await orderService.getOrderById(input.localOrderId);

    const decision = decideConfirmation(
      {
        paymentStatus: order.paymentStatus,
        paymentId: order.paymentId,
        grandTotal: order.grandTotal,
        gatewayOrderId: order.gatewayOrderId,
      },
      {
        paymentId: input.paymentId,
        gatewayOrderId: input.gatewayOrderId,
        amount: input.amount,
      }
    );

    if (decision.kind === "reject") {
      throw new ConflictError(decision.reason);
    }
    if (decision.kind === "already-confirmed") {
      return { orderId: order.id, paymentStatus: "paid" as const, alreadyConfirmed: true };
    }

    const transitioned = await orderRepository.confirmPaid(order.id, input.paymentId);
    if (!transitioned) {
      // Lost the race to the other trigger. Re-read: the same payment is success.
      const now = await orderService.getOrderById(input.localOrderId);
      if (now.paymentStatus === "paid" && now.paymentId === input.paymentId) {
        return { orderId: order.id, paymentStatus: "paid" as const, alreadyConfirmed: true };
      }
      throw new ConflictError("Order is already paid by a different payment");
    }

    // Side effects belong to the transition, so they inherit its idempotency (D3):
    // this line is reached exactly once per order.
    await orderService.onPaymentConfirmed(order.id);

    return { orderId: order.id, paymentStatus: "paid" as const, alreadyConfirmed: false };
  }

  /**
   * A webhook `payment.captured` event, reduced to a confirmation. Throws on anything
   * unmatched, so the route answers non-2xx and the gateway retries loudly (D5).
   */
  async confirmFromWebhookEvent(entity: {
    id?: string;
    order_id?: string;
    amount?: number;
    notes?: Record<string, unknown>;
  }) {
    const localOrderId = entity.notes?.[RAZORPAY_NOTES_ORDER_KEY];
    if (typeof localOrderId !== "string" || !localOrderId) {
      throw new DomainError(
        `Webhook payment has no ${RAZORPAY_NOTES_ORDER_KEY} note to match an order by`,
        { status: 422 }
      );
    }
    if (!entity.id || !entity.order_id || typeof entity.amount !== "number") {
      throw new DomainError("Webhook payment entity is missing id, order_id or amount", {
        status: 422,
      });
    }

    return await this.confirmPayment({
      localOrderId,
      gatewayOrderId: entity.order_id,
      paymentId: entity.id,
      amount: entity.amount,
    });
  }

  /** The failure signal — recorded, but never over a captured payment. */
  async markFailedFromWebhookEvent(entity: { notes?: Record<string, unknown> }) {
    const localOrderId = entity.notes?.[RAZORPAY_NOTES_ORDER_KEY];
    if (typeof localOrderId !== "string" || !localOrderId) {
      throw new DomainError(
        `Webhook payment has no ${RAZORPAY_NOTES_ORDER_KEY} note to match an order by`,
        { status: 422 }
      );
    }
    await orderRepository.markPaymentFailed(localOrderId);
  }

  /**
   * A zero-total order has nothing for a gateway to verify; the server checks the
   * only fact there is — that the persisted total really is zero.
   */
  async confirmFreeOrder(localOrderId: string) {
    const order = await orderService.getOrderById(localOrderId);
    if (order.grandTotal !== 0) {
      throw new ConflictError("This order has an amount due and needs payment");
    }
    if (order.paymentStatus === "paid") {
      return { orderId: order.id, paymentStatus: "paid" as const, alreadyConfirmed: true };
    }

    const transitioned = await orderRepository.confirmPaid(order.id, "free-order");
    if (transitioned) {
      await orderService.onPaymentConfirmed(order.id);
    }
    return { orderId: order.id, paymentStatus: "paid" as const, alreadyConfirmed: !transitioned };
  }

  /**
   * The backstop for a missed webhook (trd.md D7, R6): ask the gateway about orders
   * stuck pending, and confirm the ones it says were captured — through the same
   * checks and the same transition as every other trigger. Not the primary path;
   * the primary paths are fast, this one is merely certain.
   */
  async reconcileStuckOrders(olderThanMinutes = 30) {
    const threshold = new Date(Date.now() - olderThanMinutes * 60_000);
    const stuck = await orderRepository.findStuckPendingOrders(threshold);

    const results: Array<{ orderId: string; outcome: string }> = [];
    for (const order of stuck) {
      try {
        const captured = await razorpayRepository.fetchCapturedPayment(order.gatewayOrderId!);
        if (!captured) {
          // Nothing captured and past the hold window: the reservation is released
          // (inventory-reservation R4). 60 minutes — double the sweep threshold, so
          // an order the gateway could still tell us about is never released first.
          const holdExpired = order.createdAt < new Date(Date.now() - 60 * 60_000);
          if (holdExpired) {
            const expired = await orderRepository.expireAndRestock(order.id);
            results.push({ orderId: order.id, outcome: expired ? "expired-released" : "still-unpaid" });
          } else {
            results.push({ orderId: order.id, outcome: "still-unpaid" });
          }
          continue;
        }
        const confirmation = await this.confirmPayment({
          localOrderId: order.id,
          gatewayOrderId: order.gatewayOrderId!,
          paymentId: captured.paymentId,
          amount: captured.amount,
        });
        results.push({
          orderId: order.id,
          outcome: confirmation.alreadyConfirmed ? "already-confirmed" : "recovered",
        });
      } catch (error) {
        // One order's failure must not stop the sweep; it stays pending and is
        // retried next run. The error is the finding.
        console.error(`Reconciliation failed for order ${order.id}:`, error);
        results.push({ orderId: order.id, outcome: "error" });
      }
    }
    return results;
  }

  /**
   * Verify a payment signature
   */
  async verifyPayment(
    input: VerifyPaymentInput
  ): Promise<PaymentVerificationResult> {
    if (!input.gatewayOrderId || !input.paymentId || !input.signature) {
      return {
        isValid: false,
        error: "Missing required verification parameters",
      };
    }

    return await razorpayRepository.verifyPayment(input);
  }

  /**
   * Verify webhook signature and parse event
   */
  async verifyWebhook(
    signature: string,
    rawBody: string
  ): Promise<WebhookVerificationResult> {
    if (!signature || !rawBody) {
      return {
        isValid: false,
        error: "Missing webhook signature or body",
      };
    }

    return await razorpayRepository.verifyWebhook(signature, rawBody);
  }

  /**
   * Validate payment order creation input
   */
  /** Sanity bounds on the amount we ourselves derived — a guard against our own bugs, not against callers. */
  private validateDerivedAmount(amount: number): void {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new DomainError("Order total must be a positive amount");
    }

    if (amount > 100000000) {
      // 1 crore paise = 10 lakh rupees
      throw new ConflictError("Amount exceeds maximum limit");
    }
  }
}

export const paymentService = new PaymentService();

