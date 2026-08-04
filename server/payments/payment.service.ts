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

export class PaymentService {
  /**
   * Create a payment order
   */
  async createPaymentOrder(
    input: CreatePaymentOrderInput
  ): Promise<ServerPaymentOrder> {
    // Validate input
    this.validateCreateOrderInput(input);

    // Create order using Razorpay
    return await razorpayRepository.createOrder(input);
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
  private validateCreateOrderInput(input: CreatePaymentOrderInput): void {
    if (!input.amount || input.amount <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    if (input.amount > 100000000) {
      // 1 crore paise = 10 lakh rupees
      throw new Error("Amount exceeds maximum limit");
    }

    if (!input.currency || input.currency !== "INR") {
      throw new Error("Only INR currency is supported");
    }

    if (!input.localOrderId) {
      throw new Error("Local order ID is required");
    }
  }
}

export const paymentService = new PaymentService();

