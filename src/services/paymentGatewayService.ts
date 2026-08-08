/**
 * Client-side Payment Gateway Service
 *
 * This service handles payment gateway interactions on the client side.
 * It manages the Razorpay SDK and provides a clean interface for checkout.
 */

import type { PaymentGatewayOrder } from "@/domain/payment";

// The SDK attaches itself to window; declaring it once beats casting at every use.
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open(): void;
      on(event: string, handler: (error: unknown) => void): void;
    };
  }
}

export interface CreatePaymentOrderInput {
  /** The server derives the amount from this order's persisted grandTotal (ADR-0002). */
  localOrderId: string;
  customer?: {
    name?: string;
    email?: string;
    contact?: string;
  };
}

export interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface PaymentGatewayOptions {
  onSuccess: (response: RazorpayPaymentResponse) => void;
  onFailure: (error: unknown) => void;
  onDismiss?: () => void;
}

/**
 * Payment Gateway Service
 *
 * Abstracts payment gateway operations (Razorpay SDK)
 */
class PaymentGatewayService {
  private baseUrl = "/api/payments";
  private sdkLoaded = false;

  /**
   * Load Razorpay SDK
   */
  async loadSDK(): Promise<void> {
    if (this.sdkLoaded || typeof window === "undefined") {
      return;
    }

    return new Promise((resolve, reject) => {
      const scriptId = "razorpay-checkout-js";
      
      // Check if script already exists
      if (document.getElementById(scriptId)) {
        this.sdkLoaded = true;
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      
      script.onload = () => {
        this.sdkLoaded = true;
        resolve();
      };
      
      script.onerror = () => {
        reject(new Error("Failed to load Razorpay SDK"));
      };

      document.body.appendChild(script);
    });
  }

  /**
   * Create a payment order
   */
  async createPaymentOrder(
    input: CreatePaymentOrderInput
  ): Promise<PaymentGatewayOrder> {
    try {
      const response = await fetch(`${this.baseUrl}/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(input),
      });

      if (response.status === 429) {
        const error = await response.json();
        throw new Error(
          error.error || "Too many payment requests. Please try again later."
        );
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || "Failed to create payment order"
        );
      }

      return response.json();
    } catch (error) {
      console.error("[PaymentGatewayService] createPaymentOrder failed:", error);
      throw error;
    }
  }

  /**
   * Open payment checkout modal
   */
  async openCheckout(
    paymentOrder: PaymentGatewayOrder,
    options: PaymentGatewayOptions
  ): Promise<void> {
    // Ensure SDK is loaded
    await this.loadSDK();

    if (typeof window === "undefined" || !window.Razorpay) {
      throw new Error("Razorpay SDK not loaded");
    }

    const razorpayOptions = {
      key: paymentOrder.key || "",
      amount: paymentOrder.amount,
      currency: paymentOrder.currency,
      name: "Bhendi Bazaar",
      description: "Order Payment",
      order_id: paymentOrder.gatewayOrderId,
      handler: options.onSuccess,
      modal: {
        ondismiss: options.onDismiss || (() => {}),
      },
      theme: {
        color: "#0f766e",
      },
    };

    const razorpay = new window.Razorpay(razorpayOptions);

    // Handle payment failures
    razorpay.on("payment.failed", options.onFailure);

    // Open the checkout modal
    razorpay.open();
  }

  /**
   * Verify payment signature (optional client-side verification)
   */
  async verifyPayment(input: {
    gatewayOrderId: string;
    paymentId: string;
    signature: string;
  }): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.verified === true;
    } catch (error) {
      console.error("[PaymentGatewayService] verifyPayment failed:", error);
      return false;
    }
  }
}

export const paymentGatewayService = new PaymentGatewayService();

