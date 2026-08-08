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

