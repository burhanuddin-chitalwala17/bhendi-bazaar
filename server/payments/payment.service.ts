/**
 * Server-side Payment Service
 *
 * This service encapsulates all business logic related to payments.
 * It delegates to the appropriate payment gateway repository.
 */

import { razorpayRepository } from "@server/payments/providers/razorpay/razorpay.repository";
import { ORDER_STATUS, PAYMENT_STATUS } from "@server/checkout/order.types";
import type {
  ReleaseOutcome,
  ServerPaymentOrder,
  CreatePaymentOrderInput,
  VerifyPaymentInput,
  PaymentVerificationResult,
  WebhookVerificationResult,
} from "@server/payments/payment.types";
import { ConflictError, DomainError, NotFoundError } from "@server/shared/domain-error";
import { orderService } from "@server/checkout/order.service";
import { orderRepository } from "@server/checkout/order.repository";
import { decideConfirmation } from "@server/payments/confirmation";
import { RAZORPAY_NOTES_ORDER_KEY } from "@server/payments/notes";

/**
 * How long an unpaid order keeps its reservation before any sweep will release it.
 *
 * Short because the release is no longer a guess: the gateway is asked what actually
 * happened first, and an attempt still moving reports `in-flight` and is left alone
 * (checkout-abandonment R2/D1). The old hour existed to compensate for not asking.
 */
export const ABANDONED_HOLD_MINUTES = 15;

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
    if (order.paymentStatus === PAYMENT_STATUS.PAID) {
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
      return { orderId: order.id, paymentStatus: PAYMENT_STATUS.PAID, alreadyConfirmed: true };
    }

    const transitioned = await orderRepository.confirmPaid(order.id, input.paymentId);
    if (!transitioned) {
      // Lost the race to the other trigger. Re-read: the same payment is success.
      const now = await orderService.getOrderById(input.localOrderId);
      if (now.paymentStatus === PAYMENT_STATUS.PAID && now.paymentId === input.paymentId) {
        return { orderId: order.id, paymentStatus: PAYMENT_STATUS.PAID, alreadyConfirmed: true };
      }
      throw new ConflictError("Order is already paid by a different payment");
    }

    // Side effects belong to the transition, so they inherit its idempotency (D3):
    // this line is reached exactly once per order.
    await orderService.onPaymentConfirmed(order.id);

    return { orderId: order.id, paymentStatus: PAYMENT_STATUS.PAID, alreadyConfirmed: false };
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
    if (order.paymentStatus === PAYMENT_STATUS.PAID) {
      return { orderId: order.id, paymentStatus: PAYMENT_STATUS.PAID, alreadyConfirmed: true };
    }

    const transitioned = await orderRepository.confirmPaid(order.id, "free-order");
    if (transitioned) {
      await orderService.onPaymentConfirmed(order.id);
    }
    return { orderId: order.id, paymentStatus: PAYMENT_STATUS.PAID, alreadyConfirmed: !transitioned };
  }

  /**
   * Release an unpaid order's reservation — the one routine behind every abandonment
   * trigger (checkout-abandonment D1/D2). The gateway decides, never the caller: a
   * capture arriving after a release is refused by `confirmPaid`, so releasing on a
   * browser's word would turn a real payment into a manual refund.
   */
  async releaseIfUnpaid(
    localOrderId: string,
    requester?: { userId: string | null }
  ): Promise<{ orderId: string; outcome: ReleaseOutcome }> {
    const order = await orderService.getOrderById(localOrderId); // throws NotFound itself

    // Possession of the order id is authority enough to *ask* (D3) — checkout is open
    // to guests. Where there is an owner, the caller must be it, absent identity
    // included; not-found rather than forbidden, so existence is not leaked.
    if (order.userId !== null && requester !== undefined && requester.userId !== order.userId) {
      throw new NotFoundError("Order not found");
    }

    if (order.paymentStatus === PAYMENT_STATUS.PAID) {
      return { orderId: order.id, outcome: "already-paid" };
    }
    if (order.status === ORDER_STATUS.EXPIRED) {
      return { orderId: order.id, outcome: "already-released" };
    }

    // No gateway order means nothing was ever chargeable, so there is nothing to ask
    // about — the buyer left before a payment order existed.
    if (order.gatewayOrderId) {
      const state = await razorpayRepository.fetchOrderPaymentState(order.gatewayOrderId);

      if (state.kind === "captured") {
        // They did pay, they just did not tell us. Confirm through the same routine
        // every other trigger uses rather than a second transition here.
        await this.confirmPayment({
          localOrderId: order.id,
          gatewayOrderId: order.gatewayOrderId,
          paymentId: state.paymentId,
          amount: state.amount,
        });
        return { orderId: order.id, outcome: "confirmed" };
      }

      if (state.kind === "in-flight") {
        // Money is still moving (R2). Hold the reservation and let a later sweep ask
        // again — an over-held item costs a sale, an over-released one costs a refund
        // and a customer.
        return { orderId: order.id, outcome: "in-flight" };
      }

      // A gateway order takes a fresh attempt after a failed one, so "nothing yet" is not
      // "abandoned" until the hold window has passed — a retry paid then was being refused.
      const heldSince = Date.now() - ABANDONED_HOLD_MINUTES * 60_000;
      if (order.createdAt.getTime() > heldSince) {
        return { orderId: order.id, outcome: "still-payable" };
      }
    }

    const released = await orderRepository.expireAndRestock(order.id);
    return { orderId: order.id, outcome: released ? "released" : "not-released" };
  }

  /**
   * Release abandoned holds standing in the way of a checkout that was just refused
   * (checkout-abandonment D4), and report whether anything actually came back.
   *
   * This is what makes the release timely without depending on a schedule: it runs
   * at the one moment the held stock is demonstrably costing a sale, and spends a
   * gateway call only then. Each candidate still goes through `releaseIfUnpaid`, so
   * a hold with a payment still moving is left exactly where it is.
   */
  async releaseHoldsOnProducts(productIds: readonly string[]): Promise<boolean> {
    const olderThan = new Date(Date.now() - ABANDONED_HOLD_MINUTES * 60_000);
    const candidates = await orderRepository.findAbandonableHoldsForProducts(
      productIds,
      olderThan
    );

    let releasedAny = false;
    for (const candidate of candidates) {
      try {
        const { outcome } = await this.releaseIfUnpaid(candidate.id);
        if (outcome === "released") releasedAny = true;
      } catch (error) {
        // A buyer is waiting on this. One unreachable gateway must not fail their
        // checkout — they get the out-of-stock answer they would have got anyway.
        console.error(`Could not release hold on order ${candidate.id}:`, error);
      }
    }
    return releasedAny;
  }

  /**
   * The backstop (payment-confirmation trd.md D7, R6): ask the gateway about orders
   * stuck unpaid, confirm the ones it says were captured, release the rest. Both
   * outcomes go through `releaseIfUnpaid`, so the sweep has no policy of its own.
   *
   * Not the primary path for either job any more — a buyer who closes the payment
   * window releases their own reservation immediately (D1), and a blocked checkout
   * releases what is in its way (D4). This catches the buyer who closed the laptop
   * lid, and how wide its net is depends on how often the host will run it (D5).
   */
  async reconcileStuckOrders(olderThanMinutes = ABANDONED_HOLD_MINUTES) {
    const threshold = new Date(Date.now() - olderThanMinutes * 60_000);
    const stuck = await orderRepository.findStuckPendingOrders(threshold);

    const results: Array<{ orderId: string; outcome: ReleaseOutcome | "error" }> = [];
    for (const order of stuck) {
      try {
        const { outcome } = await this.releaseIfUnpaid(order.id);
        results.push({ orderId: order.id, outcome });
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

