/**
 * Server-side Payment Repository
 *
 * This repository handles interactions with the Razorpay payment gateway API.
 * It runs ONLY on the server-side and uses secret API keys.
 */

import crypto from "crypto";
import type {
  ServerPaymentOrder,
  GatewayOrderRequest,
  VerifyPaymentInput,
  PaymentVerificationResult,
  WebhookVerificationResult,
} from "@server/payments/payment.types";

// Razorpay API configuration
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "";

export class RazorpayRepository {
  private apiUrl = "https://api.razorpay.com/v1";
  private keyId = RAZORPAY_KEY_ID;
  private keySecret = RAZORPAY_KEY_SECRET;
  private webhookSecret = RAZORPAY_WEBHOOK_SECRET;

  /**
   * Create a Razorpay order
   */
  async createOrder(
    input: GatewayOrderRequest
  ): Promise<ServerPaymentOrder> {
    if (!this.keyId || !this.keySecret) {
      throw new Error(
        "Razorpay credentials not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
      );
    }

    try {
      const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString(
        "base64"
      );

      const response = await fetch(`${this.apiUrl}/orders`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: input.amount,
          currency: input.currency,
          receipt: input.localOrderId,
          notes: {
            orderId: input.localOrderId,
            customerName: input.customer?.name || "",
            customerEmail: input.customer?.email || "",
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.description ||
            "Failed to create Razorpay order"
        );
      }

      const data = await response.json();

      return {
        gatewayOrderId: data.id,
        amount: data.amount,
        currency: data.currency,
        provider: "razorpay",
        key: this.keyId, // Public key safe to send to client
      };
    } catch (error) {
      console.error("[RazorpayRepository] createOrder failed:", error);
      throw error;
    }
  }

  /**
   * Verify Razorpay payment signature
   */
  async verifyPayment(
    input: VerifyPaymentInput
  ): Promise<PaymentVerificationResult> {
    try {
      if (!this.keySecret) {
        throw new Error("Razorpay key secret not configured");
      }

      const text = `${input.gatewayOrderId}|${input.paymentId}`;
      const expectedSignature = crypto
        .createHmac("sha256", this.keySecret)
        .update(text)
        .digest("hex");

      const isValid = expectedSignature === input.signature;

      return {
        isValid,
        error: isValid ? undefined : "Invalid payment signature",
      };
    } catch (error) {
      console.error("[RazorpayRepository] verifyPayment failed:", error);
      return {
        isValid: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to verify payment",
      };
    }
  }

  /**
   * Verify Razorpay webhook signature
   */
  async verifyWebhook(
    signature: string,
    rawBody: string
  ): Promise<WebhookVerificationResult> {
    try {
      if (!this.webhookSecret) {
        throw new Error("Razorpay webhook secret not configured");
      }

      const expectedSignature = crypto
        .createHmac("sha256", this.webhookSecret)
        .update(rawBody)
        .digest("hex");

      const isValid = expectedSignature === signature;

      if (!isValid) {
        return {
          isValid: false,
          error: "Invalid webhook signature",
        };
      }

      const payload = JSON.parse(rawBody);

      return {
        isValid: true,
        event: {
          provider: "razorpay",
          eventType: payload.event,
          payload: payload.payload,
          signature,
          rawBody,
        },
      };
    } catch (error) {
      console.error("[RazorpayRepository] verifyWebhook failed:", error);
      return {
        isValid: false,
        error:
          error instanceof Error ? error.message : "Failed to verify webhook",
      };
    }
  }
}

export const razorpayRepository = new RazorpayRepository();

