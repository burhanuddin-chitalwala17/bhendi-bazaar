import { apiRequest } from "@/lib/api-client";
import { ApiError } from "@/lib/api-error";
import type { PaymentGatewayOrder } from "@/domain/payment";

export interface CreatePaymentOrderInput {
  /** The server derives the amount from this order's persisted grandTotal (ADR-0002). */
  localOrderId: string;
  customer?: {
    name?: string;
    email?: string;
    contact?: string;
  };
}

const BASE_URL = "/api/payments";

/** Our side of the payment conversation. The gateway's own modal is `razorpay-checkout.ts`. */
export const paymentGatewayApiClient = {
  async createPaymentOrder(input: CreatePaymentOrderInput): Promise<PaymentGatewayOrder> {
    try {
      return await apiRequest<PaymentGatewayOrder>(`${BASE_URL}/create-order`, { method: "POST", body: input });
    } catch (error) {
      console.error("[paymentGatewayApiClient] createPaymentOrder failed:", error);
      // A reply with no message of its own still says what failed.
      if (error instanceof ApiError && error.message === `Request failed (${error.status})`) {
        throw new ApiError("Failed to create payment order", error.status, error.details);
      }
      throw error;
    }
  },

  /**
   * Confirm the payment with the server — the server verifies the signature against
   * the persisted order and performs the paid transition. This is not optional and
   * not a boolean check: it is how an order becomes paid (ADR-0005).
   */
  confirmPayment(input: {
    localOrderId: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }): Promise<{ orderId: string; paymentStatus: "paid" }> {
    return apiRequest(`${BASE_URL}/verify`, { method: "POST", body: input });
  },

  /**
   * Tell the server the buyer gave up (checkout-abandonment D1). A hint, not a
   * transaction — the server asks the gateway what really happened, and the sweep
   * reaches the same answer if this never arrives, so a failure here is swallowed.
   * `keepalive` because the tab is usually closing as it fires.
   */
  async abandon(localOrderId: string): Promise<void> {
    try {
      await apiRequest(`${BASE_URL}/abandon`, { method: "POST", keepalive: true, body: { localOrderId } });
    } catch (error) {
      console.warn("Could not release the abandoned order:", error);
    }
  },

  /** Zero-total orders: the server checks the persisted total is really zero. */
  confirmFreeOrder(localOrderId: string): Promise<{ orderId: string }> {
    return apiRequest(`${BASE_URL}/confirm-free`, { method: "POST", body: { localOrderId } });
  },
};
