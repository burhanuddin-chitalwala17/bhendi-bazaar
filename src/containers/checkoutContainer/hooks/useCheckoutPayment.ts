// hooks/checkout/useCheckoutPayment.ts

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { paymentGatewayService } from "@/services/paymentGatewayService";
import { orderApiClient } from "@/services/orderApiClient";
import { cartApiClient } from "@/services/cartApiClient";
import { useCartStore } from "@/store/cartStore";

import type { CartItem, CartTotals } from "@/domain/cart";
import type { ShippingGroup } from "@/domain/shipping";
import { DeliveryAddress } from "@/domain/profile";
import { ApiError } from "@/lib/api-error";

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


  /**
   * NEW: Process payment with multiple shipments
   * Production-ready flow with post-payment fulfillment
   * 
   * Flow:
   * 1. Validate stock
   * 2. Create order (pending_payment)
   * 3. Create payment
   * 4. On payment success:
   *    - Update order (paid)
   *    - Fulfill order (create with providers)
   *    - Clear cart
   *    - Redirect
   */
  const processPaymentWithShipments = async (
    orderData: ProcessPaymentWithShipmentsInput
  ) => {
    setError(null);
    setIsProcessing(true);

    try {
      console.log('🛒 Starting checkout with multiple shipments...');

      // Step 0: Validate stock for all items across all groups
      const allItems = orderData.shippingGroups.flatMap((group) => group.items);
      const stockCheck = await fetch("/api/products/check-stock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: allItems.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
        }),
      }).then((r) => r.json());

      if (!stockCheck.available) {
        const outOfStock = stockCheck.items.filter((i: { available: boolean; name: string }) => !i.available);
        throw new Error(
          `Sorry, ${outOfStock[0].name} is out of stock. Please update your cart.`
        );
      }

      // Step 1: Create order with shipments (pending payment & fulfillment)
      console.log('📦 Creating order with shipments...');
      const order = await orderApiClient.createOrderWithShipments({
        // Lines carry product + quantity only; the server prices them from the
        // catalogue and refuses if its total differs from the one displayed below.
        shippingGroups: orderData.shippingGroups.map((group) => {
          if (!group.selectedRate) {
            throw new Error("Select a shipping option for every parcel before paying.");
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
              (item: { productId: string; quantity: number; size?: string; color?: string }) => ({
                productId: item.productId,
                quantity: item.quantity,
                size: item.size || undefined,
                color: item.color || undefined,
              })
            ),
            selectedRate: group.selectedRate,
          };
        }),
        displayedGrandTotal: orderData.totals.grandTotal,
        address: orderData.address,
        notes: orderData.notes,
        paymentMethod: orderData.paymentMethod,
      });

      // The server's own total — computed from the catalogue, already in paise.
      const amountInMinorUnit = order.grandTotal;

      // Free order case — the server checks the persisted total is zero and
      // performs the transition itself; the browser asserts nothing.
      if (amountInMinorUnit <= 0) {
        await paymentGatewayService.confirmFreeOrder(order.id);
        router.push(`/order/${order.id}`);
        return order;
      }

      // Step 2: Create payment gateway order
      console.log('💳 Creating Razorpay payment order...');
      const paymentOrder = await paymentGatewayService.createPaymentOrder({
        localOrderId: order.id,
        customer: {
          name: orderData.address.fullName,
          email: orderData.address.email,
          contact: orderData.address.mobile,
        },
      });

      // Step 3: Open Razorpay checkout
      console.log('🔐 Opening Razorpay checkout modal...');
      await paymentGatewayService.openCheckout(paymentOrder, {
        onSuccess: async (response) => {
          try {
            // The server verifies the signature against the persisted order and
            // writes the paid state — the browser reports, it does not decide
            // (ADR-0005). The webhook is the second, independent trigger.
            await paymentGatewayService.confirmPayment({
              localOrderId: order.id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            // The server cleared the persisted cart inside the order transaction
            // (inventory-reservation R6); only the local store remains to clear.
            if (!orderData.isBuyNow) {
              useCartStore.getState().clear();
            }

            // Step 7: Redirect to order page
            console.log('🎉 Redirecting to order page...');
            router.push(`/order/${order.id}`);

          } catch (error) {
            console.error("Failed to process after payment:", error);
            setError(
              "Payment succeeded but post-payment processing failed. Your order is saved. Order ID: " + order.code
            );
          }
        },
        onFailure: async (error) => {
          console.error("❌ Payment failed:", error);
          // No state write from here: the gateway's own failure webhook records it,
          // and a failure signal must never be able to overwrite a captured payment.
          const description = (error as { error?: { description?: string } } | null)
            ?.error?.description;
          setError(description || "Payment failed. Please try again.");
          setIsProcessing(false);
        },
        onDismiss: () => {
          console.log('⚠️  Payment modal dismissed');
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
            .join(" · ")
        );
        return;
      }

      // Check if it's a rate limit error
      if (error instanceof Error && error.message.includes("Too many")) {
        setError(error.message);
      } else {
        setError(error instanceof Error ? error.message : "Checkout failed");
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