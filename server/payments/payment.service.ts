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

    return await razorpayRepository.createOrder({
      amount,
      currency: "INR",
      localOrderId: input.localOrderId,
      customer: input.customer,
    });
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

