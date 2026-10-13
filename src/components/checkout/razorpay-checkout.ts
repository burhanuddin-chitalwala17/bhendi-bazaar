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

export interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayCheckoutOptions {
  onSuccess: (response: RazorpayPaymentResponse) => void;
  onFailure: (error: unknown) => void;
  onDismiss?: () => void;
}

const SCRIPT_ID = "razorpay-checkout-js";
let sdkLoaded = false;

/**
 * Appends Razorpay's checkout.js at runtime, which is why the CSP allowlists its host rather
 * than relying on a nonce (src/lib/security-headers.ts).
 */
function loadSDK(): Promise<void> {
  if (sdkLoaded || typeof window === "undefined") return Promise.resolve();

  return new Promise((resolve, reject) => {
    if (document.getElementById(SCRIPT_ID)) {
      sdkLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      sdkLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
    document.body.appendChild(script);
  });
}

/** Open the gateway's payment modal for an order the server has already created. */
export async function openRazorpayCheckout(
  paymentOrder: PaymentGatewayOrder,
  options: RazorpayCheckoutOptions,
): Promise<void> {
  await loadSDK();

  if (typeof window === "undefined" || !window.Razorpay) {
    throw new Error("Razorpay SDK not loaded");
  }

  const razorpay = new window.Razorpay({
    key: paymentOrder.key || "",
    amount: paymentOrder.amount,
    currency: paymentOrder.currency,
    name: "Bhendi Bazaar",
    description: "Order Payment",
    order_id: paymentOrder.gatewayOrderId,
    handler: options.onSuccess,
    modal: { ondismiss: options.onDismiss || (() => {}) },
    theme: { color: "#0f766e" },
  });

  razorpay.on("payment.failed", options.onFailure);
  razorpay.open();
}
