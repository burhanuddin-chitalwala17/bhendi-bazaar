/**
 * Server-side Payment Repository
 *
 * This repository handles interactions with the Razorpay payment gateway API.
 * It runs ONLY on the server-side and uses secret API keys.
 */

import crypto from "crypto";
import { RAZORPAY_NOTES_ORDER_KEY } from "@server/payments/notes";
import type {
  GatewayPaymentState,
  GatewayRefundResult,
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

/** A refund call that has not answered by now is reported unconfirmed, never retried blind (D17). */
export const REFUND_TIMEOUT_MS = 10_000;

/** Razorpay's refund object, as far as we read it. A `failed` refund moved no money. */
interface RazorpayRefund {
  id: string;
  receipt?: string | null;
  status?: string;
}


/** Constant-time signature equality (trd.md D8) — `===` short-circuits on the first differing byte. */
function signaturesMatch(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Our words, not Razorpay's: the server has no keys, so nothing was sent. */
export const GATEWAY_NOT_CONFIGURED = "Razorpay keys aren't set on this server, so nothing was sent.";
/** Razorpay answered with a refund it had already marked failed. */
export const REFUND_MARKED_FAILED = "This refund is marked failed";

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
            [RAZORPAY_NOTES_ORDER_KEY]: input.localOrderId,
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

      const isValid = signaturesMatch(expectedSignature, input.signature);

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

      const isValid = signaturesMatch(expectedSignature, signature);

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

  /**
   * What the gateway says has happened, reduced to the three answers the store acts
   * on (checkout-abandonment D1). "in-flight" is why this replaced a captured-only
   * lookup: a UPI collect request sits `created` while the buyer approves it in their
   * banking app, long after closing our window — releasing there strands a payment.
   */
  async fetchOrderPaymentState(gatewayOrderId: string): Promise<GatewayPaymentState> {
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");

    const response = await fetch(`${this.apiUrl}/orders/${gatewayOrderId}/payments`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!response.ok) {
      throw new Error(`Razorpay payments lookup failed with ${response.status}`);
    }

    const body = (await response.json()) as {
      items?: Array<{ id: string; status: string; amount: number }>;
    };
    const attempts = body.items ?? [];

    const captured = attempts.find((p) => p.status === "captured");
    if (captured) {
      return { kind: "captured", paymentId: captured.id, amount: captured.amount };
    }
    // Anything not yet resolved one way or the other. `failed` and `refunded` are
    // resolved; everything else the gateway reports is still moving.
    if (attempts.some((p) => p.status !== "failed" && p.status !== "refunded")) {
      return { kind: "in-flight" };
    }
    return { kind: "none" };
  }

  /**
   * Refund `amount` paise of a captured payment (order-fulfilment D17). `receipt` is our refund row's
   * id, which Razorpay treats as the idempotency key per payment. A 4xx is a refusal with its reason;
   * a timeout, a dropped connection or a 5xx is `unknown`, because the money may have moved.
   */
  async createRefund(input: { paymentId: string; amount: number; receipt: string }): Promise<GatewayRefundResult> {
    if (!this.refundsConfigured()) return { kind: "refused", reason: GATEWAY_NOT_CONFIGURED };
    const auth = this.basicAuth();
    let response: Response;
    try {
      response = await fetch(`${this.apiUrl}/payments/${encodeURIComponent(input.paymentId)}/refund`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: input.amount, speed: "normal", receipt: input.receipt }),
        signal: AbortSignal.timeout(REFUND_TIMEOUT_MS),
      });
    } catch (error) {
      console.error("[RazorpayRepository] createRefund got no answer:", error);
      return { kind: "unknown" };
    }
    const body = (await response.json().catch(() => ({}))) as Partial<RazorpayRefund> & { error?: { description?: string } };
    // A replayed receipt can answer 200 with the earlier refund, failed: no money moved (same rule as findRefundByReceipt).
    if (response.ok && typeof body.id === "string" && body.status === "failed") {
      return { kind: "refused", reason: REFUND_MARKED_FAILED };
    }
    if (response.ok && typeof body.id === "string") return { kind: "started", gatewayRefundId: body.id };
    if (response.status >= 400 && response.status < 500) {
      return { kind: "refused", reason: body.error?.description || `Refund refused (${response.status})` };
    }
    return { kind: "unknown" };
  }

  /**
   * The refund a payment already carries under `receipt`, if any: what a retry adopts instead of
   * asking twice (D17). Throws when the gateway cannot be asked, since "none" would invite a second refund.
   */
  async findRefundByReceipt(paymentId: string, receipt: string): Promise<Extract<GatewayRefundResult, { kind: "started" }> | null> {
    const response = await fetch(`${this.apiUrl}/payments/${encodeURIComponent(paymentId)}/refunds?count=100`, {
      headers: { Authorization: `Basic ${this.basicAuth()}` },
      signal: AbortSignal.timeout(REFUND_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Razorpay refunds lookup failed with ${response.status}`);
    const body = (await response.json()) as { items?: RazorpayRefund[] };
    // A failed refund moved no money, so it is not one to adopt.
    const found = (body.items ?? []).find((r) => r.receipt === receipt && r.status !== "failed");
    return found ? { kind: "started", gatewayRefundId: found.id } : null;
  }

  /** Whether a refund can be asked for at all: checked before a row is claimed, so nothing is left REQUESTED. */
  refundsConfigured(): boolean {
    return Boolean(this.keyId && this.keySecret);
  }

  private basicAuth(): string {
    if (!this.keyId || !this.keySecret) {
      throw new Error("Razorpay credentials not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
    }
    return Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
  }

  /**
   * The captured payment against a gateway order, if any — the reconciliation
   * sweep's question (payment-confirmation trd.md D7). Returns null when nothing
   * was captured, which is a normal answer, not an error.
   */
  async fetchCapturedPayment(
    gatewayOrderId: string
  ): Promise<{ paymentId: string; amount: number } | null> {
    const state = await this.fetchOrderPaymentState(gatewayOrderId);
    return state.kind === "captured"
      ? { paymentId: state.paymentId, amount: state.amount }
      : null;
  }
}

export const razorpayRepository = new RazorpayRepository();

