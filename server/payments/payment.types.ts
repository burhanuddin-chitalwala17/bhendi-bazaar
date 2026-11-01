/**
 * Server-side domain types for Payment
 *
 * These types are used exclusively on the server-side (services, repositories).
 */

export type PaymentProvider = "razorpay" | "stripe" | "mock";

export interface ServerPaymentOrder {
  gatewayOrderId: string;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  key?: string; // API key for client-side SDK
}

/** What a caller may ask for: the order. The amount is derived, never accepted (ADR-0002). */
export interface CreatePaymentOrderInput {
  localOrderId: string;
  customer?: {
    name?: string;
    email?: string;
    contact?: string;
  };
}

/** What the gateway is told — amount included, because by now the server computed it. */
export interface GatewayOrderRequest {
  amount: number; // paise
  currency: string;
  localOrderId: string;
  customer?: {
    name?: string;
    email?: string;
    contact?: string;
  };
}

export interface VerifyPaymentInput {
  gatewayOrderId: string;
  paymentId: string;
  signature: string;
}

export interface PaymentVerificationResult {
  isValid: boolean;
  error?: string;
}

export interface WebhookEvent {
  provider: PaymentProvider;
  eventType: string;
  payload: unknown;
  signature: string;
  rawBody: string;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  event?: WebhookEvent;
  error?: string;
}


/**
 * What the gateway reports about one order, reduced to the three answers the store
 * acts on (checkout-abandonment D1). Gateway-specific statuses stay inside
 * `providers/razorpay/`; this is the shape business logic is allowed to see.
 */
export type GatewayPaymentState =
  | { kind: "captured"; paymentId: string; amount: number }
  /** An attempt is neither captured nor dead — the buyer may still be approving it. */
  | { kind: "in-flight" }
  | { kind: "none" };

/**
 * What the gateway said to a refund request (order-fulfilment D17), reduced to what the refund row
 * records. `unknown` is a timeout, a dropped connection or a gateway fault: it may have refunded.
 */
export type GatewayRefundResult =
  | { kind: "started"; gatewayRefundId: string }
  | { kind: "refused"; reason: string }
  | { kind: "unknown" };

/** What `releaseIfUnpaid` decided, for the caller to log or report. */
export type ReleaseOutcome =
  | "released"
  | "confirmed"
  | "in-flight"
  | "already-paid"
  | "already-released"
  | "not-released";
