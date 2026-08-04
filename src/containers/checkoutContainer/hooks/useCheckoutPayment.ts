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
        const outOfStock = stockCheck.items.filter((i: any) => !i.available);
        throw new Error(
          `Sorry, ${outOfStock[0].name} is out of stock. Please update your cart.`
        );
      }

      // Step 1: Create order with shipments (pending payment & fulfillment)
      console.log('📦 Creating order with shipments...');
      const order = await orderApiClient.createOrderWithShipments({
        shippingGroups: orderData.shippingGroups,
        totals: orderData.totals,
        address: orderData.address,
        notes: orderData.notes,
        paymentMethod: orderData.paymentMethod,
        paymentStatus: orderData.paymentStatus,
      });

      const amountInMinorUnit = Math.round(orderData.totals.grandTotal * 100);

      // Free order case
      if (amountInMinorUnit <= 0) {
        await orderApiClient.updateOrder(order.id, { paymentStatus: "paid", status: "confirmed" });
        console.log('✅ Free order confirmed! Manual fulfillment required.');
        router.push(`/order/${order.id}`);
        return order;
      }

      // Step 2: Create payment gateway order
      console.log('💳 Creating Razorpay payment order...');
      const paymentOrder = await paymentGatewayService.createPaymentOrder({
        amount: amountInMinorUnit,
        currency: "INR",
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
            console.log('✅ Payment successful! Updating order...');

            // Step 4: Update order with payment info
            await orderApiClient.updateOrder(order.id, {
              paymentStatus: "paid",
              paymentMethod: "razorpay",
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });

            console.log('✅ Order confirmed! Awaiting manual fulfillment.');
            // Step 6: Clear cart
            if (!orderData.isBuyNow) {
              console.log('🧹 Clearing cart...');
              if (session?.user) {
                await cartApiClient.clearCart();
              }
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
          await orderApiClient.updateOrder(order.id, {
            paymentStatus: "failed",
            status: "failed",
          });
          setError(
            error?.error?.description || "Payment failed. Please try again."
          );
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