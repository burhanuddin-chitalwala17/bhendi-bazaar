// src/components/checkoutContainer/hooks/useCheckout.ts

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCartStore } from "@/store/cartStore";
import type { DeliveryAddress } from "@/domain/profile";
import { CartItem } from "@/domain/cart";

interface UseCheckoutProps {
  items: CartItem[];
  isBuyNow: boolean;
}

interface UseCheckoutReturn {
  // Items & Totals
  items: CartItem[];
  totals: {
    subtotal: number;
    discount: number;
    // shipping: number;
    total: number;
  };
  
  // Address
  selectedAddress: DeliveryAddress | null;
  setAddress: (address: DeliveryAddress) => void;
  
  isProcessing: boolean;
  error: string | null;
  setError: (error: string | null) => void;

  canCheckout: boolean;
  validationErrors: string[];
}

export function useCheckout({ items, isBuyNow }: UseCheckoutProps): UseCheckoutReturn {
  const router = useRouter();
  const { data: session } = useSession();
  const clearCart = useCartStore((state) => state.clear);
  
  // Address state
  const [selectedAddress, setSelectedAddress] = useState<DeliveryAddress | null>(null);
  
  // Error state
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Calculate totals
  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => {
        // Use salePrice if available, otherwise price (must match shipping groups calculation)
        const itemPrice = item.salePrice ?? item.price;
        return sum + itemPrice * item.quantity;
      },
      0
    );
    const discount = items.reduce((sum, item) => {
      const savings = item.salePrice
        ? (item.price - item.salePrice) * item.quantity
        : 0;
      return sum + savings;
    }, 0);
    const total = subtotal - discount;
    
    return { subtotal, discount, total };
  }, [items]);
  
  // Address setter
  const setAddress = useCallback((address: DeliveryAddress) => {
    setSelectedAddress(address);
    setError(null);
  }, []);
  
  // Validation
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    
    if (items.length === 0) {
      errors.push("Cart is empty");
    }
    
    if (!selectedAddress) {
      errors.push("Please select a delivery address");
    }
    
    return errors;
  }, [items.length, selectedAddress]);
  
  const canCheckout = validationErrors.length === 0 && !isProcessing;
  
  // Main checkout process
  const processCheckout = useCallback(async (
    paymentMethod: "razorpay",
    notes?: string
  ) => {
    // Final validation
    if (!canCheckout) {
      setError(validationErrors[0] || "Cannot proceed with checkout");
      return;
    }
    
    if (!selectedAddress) {
      setError("Missing required checkout information");
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Step 1: Stock validation
      console.log("📦 Step 1: Validating stock...");
      const stockCheck = await fetch("/api/products/check-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
        }),
      }).then((r) => r.json());
      
      if (!stockCheck.available) {
        const messages = stockCheck.issues
          ?.map((i: { message: string }) => i.message)
          .join(", ");
        throw new Error(
          messages || "Some items are out of stock"
        );
      }
      
      // Step 2: Prepare order data
      console.log("📦 Step 2: Preparing order data...");
      const orderData = {
        items,
        totals,
        address: selectedAddress,
        notes: notes || "",
        paymentMethod,
        paymentStatus: "pending" as const,
        isBuyNow,
      };
      
      // Step 3: Process payment (includes order creation internally)
      console.log("📦 Step 3: Processing payment...");
      
      // Step 4: Clear cart if not buy now
      if (!isBuyNow) {
        if (session?.user) {
          // Clear server cart
          await fetch("/api/cart", { method: "DELETE" });
        }
        clearCart();
      }
      
      // Payment hook handles redirect to order page on success
      
    } catch (err) {
      console.error("Checkout failed:", err);
      setError(err instanceof Error ? err.message : "Checkout failed");
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [
    canCheckout,
    validationErrors,
    selectedAddress,
    items,
    totals,
    isBuyNow,
    session?.user,
    clearCart,
  ]);
  
  return {
    items,
    totals,
    selectedAddress,
    setAddress,
    isProcessing: isProcessing,
    error: error,
    setError,
    canCheckout,
    validationErrors,
  };
}
