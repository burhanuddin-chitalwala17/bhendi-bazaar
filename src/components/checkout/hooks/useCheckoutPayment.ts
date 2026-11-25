import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { paymentGatewayApiClient } from "@/components/checkout/paymentGatewayApiClient";
import { openRazorpayCheckout } from "@/components/checkout/razorpay-checkout";
import { orderApiClient } from "@/components/order/orderApiClient";
import { stockApiClient } from "@/components/product/stockApiClient";
import { useCartStore } from "@/store/cartStore";

import type { CartItem, CartTotals } from "@/domain/cart";
import type { ShippingGroup } from "@/domain/shipping";
import { DeliveryAddress } from "@/domain/profile";
import { ApiError } from "@/lib/api-error";
import { ROUTES } from "@server/shared/routes";
import { CHECKOUT_PAYMENT_ERROR_COPY } from "@/components/checkout/checkout-copy";

interface ProcessPaymentInput {
  items: CartItem[];
  totals: CartTotals;
  address: DeliveryAddress;
  notes?: string;
  paymentMethod: string;
  paymentStatus: string;
  isBuyNow: boolean;
}

interface ProcessPaymentWithShipmentsInput {
  shippingGroups: ShippingGroup[];
  /** The code the buyer typed, if any — a string, never an amount (Invariant 1). */
  couponCode?: string;
  totals: {
    itemsTotal: number;
    shippingTotal: number;
    discount: number;
    grandTotal: number;
  };
  address: DeliveryAddress;
  notes?: string;
  paymentMethod: string;
  paymentStatus: string;
  isBuyNow: boolean;
}

export function useCheckoutPayment() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Stock check, then a pending order, then Razorpay; the server confirms payment (ADR-0005). */
  const processPaymentWithShipments = async (
    orderData: ProcessPaymentWithShipmentsInput,
  ) => {
    setError(null);
    setIsProcessing(true);

    try {
      const allItems = orderData.shippingGroups.flatMap((group) => group.items);
      const stockCheck = await stockApiClient.check(
        allItems.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      );

      if (!stockCheck.available) {
        const outOfStock = stockCheck.items.filter((i) => !i.available);
        throw new Error(
          `${outOfStock[0].name} has just sold out. Remove it from your bag to carry on.`,
        );
      }

      const order = await orderApiClient.createOrderWithShipments({
        // Lines carry product + quantity only; the server prices them from the
        // catalogue and refuses if its total differs from the one displayed below.
        shippingGroups: orderData.shippingGroups.map((group) => {
          if (!group.selectedRate) {
            throw new Error(
              CHECKOUT_PAYMENT_ERROR_COPY.noRate,
            );
          }
          return {
            groupId: group.groupId,
            orgId: group.orgId,
            orgName: group.orgName,
            fromPincode: group.fromPincode,
            fromCity: group.fromCity,
            fromState: group.fromState,
            // The chosen size/colour ride along — without them the order cannot
            // say which variant to pack (order-and-cart-lines D5).
            items: group.items.map(
              (item: {
                productId: string;
                quantity: number;
                size?: string;
                color?: string;
                fromLinkId?: string;
              }) => ({
                productId: item.productId,
                quantity: item.quantity,
                size: item.size || undefined,
                color: item.color || undefined,
                // Which chat this line came from, for attribution only (checkout-links D5).
                fromLinkId: item.fromLinkId || undefined,
              }),
            ),
            selectedRate: { quote: group.selectedRate.quote },
          };
        }),
        displayedGrandTotal: orderData.totals.grandTotal,
        couponCode: orderData.couponCode,
        address: orderData.address,
        notes: orderData.notes,
        paymentMethod: orderData.paymentMethod,
      });

      // The server's own total — computed from the catalogue, already in paise.
      const amountInMinorUnit = order.grandTotal;

      // Free order case — the server checks the persisted total is zero and
      // performs the transition itself; the browser asserts nothing.
      if (amountInMinorUnit <= 0) {
        await paymentGatewayApiClient.confirmFreeOrder(order.id);
        useCartStore.getState().removeLines(allItems);
        router.push(ROUTES.order(order.id));
        return order;
      }

      const paymentOrder = await paymentGatewayApiClient.createPaymentOrder({
        localOrderId: order.id,
        customer: {
          name: orderData.address.fullName,
          email: orderData.address.email,
          contact: orderData.address.mobile,
        },
      });

      // No release on `pagehide`: a phone hides the page to open the UPI or wallet app, so it
      // fired mid-payment. A tab really closed is released by the sweep (checkout-abandonment R1).
      await openRazorpayCheckout(paymentOrder, {
        onSuccess: async (response) => {
          try {
            // The server verifies the signature against the persisted order and
            // writes the paid state — the browser reports, it does not decide
            // (ADR-0005). The webhook is the second, independent trigger.
            await paymentGatewayApiClient.confirmPayment({
              localOrderId: order.id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            // The server removed the bought lines inside the order transaction
            // (inventory-reservation R6); the local store drops the same ones. Buy Now
            // included — anything else in the cart stays (seamless-sign-in D12).
            useCartStore.getState().removeLines(allItems);

            router.push(ROUTES.order(order.id));
          } catch (error) {
            console.error("Failed to process after payment:", error);
            setError(
              `Your payment went through, but we couldn't finish up here. Your order ${order.code} is saved — check Your orders.`,
            );
          }
        },
        onFailure: async (error) => {
          console.error("Payment failed:", error);
          // The gateway records the failure itself; this releases what the order is
          // holding, and only after the gateway confirms nothing was captured
          // (checkout-abandonment D1/D2).
          void paymentGatewayApiClient.abandon(order.id);
          // No state write from here: the gateway's own failure webhook records it,
          // and a failure signal must never be able to overwrite a captured payment.
          const description = (
            error as { error?: { description?: string } } | null
          )?.error?.description;
          setError(description || "The payment didn't go through. Nothing was charged; try again.");
          setIsProcessing(false);
        },
        onDismiss: () => {
          // The common case, not the exception: most people who open a payment window
          // close it. The goods go back on sale now rather than at the next sweep
          // (checkout-abandonment R1).
          void paymentGatewayApiClient.abandon(order.id);
          setIsProcessing(false);
        },
      });

      return order;
    } catch (error) {
      console.error("Checkout error:", error);

      // A refused payload names its fields — show them, or the buyer sees only
      // "Validation failed" with nothing to act on.
      if (error instanceof ApiError && error.details.length > 0) {
        setError(
          error.details
            .map((d) => (d.path ? `${d.path}: ${d.message}` : d.message))
            .join(" · "),
        );
        setIsProcessing(false);
        return;
      }

      // Check if it's a rate limit error
      if (error instanceof Error && error.message.includes("Too many")) {
        setError(error.message);
      } else {
        setError(error instanceof Error ? error.message : CHECKOUT_PAYMENT_ERROR_COPY.failed);
      }

      setIsProcessing(false);
      throw error;
    }
  };

  return {
    processPaymentWithShipments,
    isProcessing,
    error,
    setError,
  };
}
