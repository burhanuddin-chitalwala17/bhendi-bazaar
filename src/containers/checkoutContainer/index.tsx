// src/components/checkout/checkoutContainer/index.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { Package } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useMultiShippingRates } from "@/hooks/shipping/useMultiShippingRates";
import { useCheckoutPayment } from "./hooks/useCheckoutPayment";
import { CheckoutSummary } from "./components/checkout-summary";
import { MultiShippingSection } from "./components/MultiShippingSection";
import { CheckoutActions } from "./components/CheckoutActions";
import { EmptyState } from "../../components/shared/states/EmptyState";
import { CartItem } from "@/domain/cart";
import { useAddressManager } from "@/hooks/useAddressManager";
import { AuthenticatedAddress } from "./components/AuthenticatedAddress";
import { GuestAddress } from "./components/GuestAddress";
import { useAuth } from "@/lib/auth";
import { DeliveryAddress } from "@/domain/profile";

interface CheckoutContainerProps {
  buyNowProduct?: CartItem;
}

export function CheckoutContainer({ buyNowProduct }: CheckoutContainerProps) {

  // check if user is authenticated
  const { user } = useAuth();

  const [checkoutItems, setCheckoutItems] = useState<CartItem[]>([]);

  const { groups: shippingGroups, totalShippingCost, isLoading: isShippingLoading, allocationError, fetchAllRates, selectRateForGroup } = useMultiShippingRates();

  const { selectedAddress, addresses, addAddress, updateAddress, selectAddress } = useAddressManager({ autoFetch: true });

  // Payment hook
  const { processPaymentWithShipments, isProcessing, error: paymentError, setError: setPaymentError } = useCheckoutPayment();

  const handleGuestAddress = (address: DeliveryAddress) => {
    selectAddress(address);
  }

  // fetching shipping rates
  useEffect(() => {
    if (selectedAddress && checkoutItems.length > 0) {
      fetchAllRates(checkoutItems, selectedAddress.pincode);
    }
  }, [selectedAddress?.pincode, checkoutItems.length, fetchAllRates]);

  // Validation logic - MUST be called before any returns
  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    if (!selectedAddress) {
      errors.push("Please select a delivery address");
    }

    if (shippingGroups.length === 0) {
      errors.push("Loading shipping options...");
    }

    // Check if all groups have a selected rate
    const groupsWithoutRate = shippingGroups.filter(g => !g.selectedRate);
    if (groupsWithoutRate.length > 0) {
      errors.push(`Please select shipping for ${groupsWithoutRate.length} item group(s)`);
    }

    return errors;
  }, [selectedAddress, shippingGroups]);

  const canCheckout = validationErrors.length === 0 && !isProcessing && !isShippingLoading;

  const totals = useMemo(() => {
    // Items total at sale price (what customer actually pays for items)
    const itemsTotal = checkoutItems.reduce(
      (sum, item) => sum + (item.salePrice ?? item.price) * item.quantity,
      0
    );

    // Discount for COUPONS only (set to 0 for now)
    const discount = 0;  // ← Changed from calculating price difference

    // Grand total = items (already at sale price) + shipping - coupon discount
    const grandTotal = itemsTotal + totalShippingCost - discount;

    // Calculate savings for DISPLAY purposes only (not sent to backend)
    const savings = checkoutItems.reduce(
      (sum, item) => {
        if (item.salePrice) {
          return sum + (item.price - item.salePrice) * item.quantity;
        }
        return sum;
      },
      0
    );

    return {
      itemsTotal,      // At sale price
      discount,        // Coupon discount (0 for now)
      grandTotal,      // itemsTotal + shipping - coupon
      savings          // For display only ("You saved ₹X")
    };
  }, [checkoutItems, totalShippingCost]);
  // Handle checkout - MUST be defined before any returns
  const handleCheckout = async () => {
    if (!canCheckout || !selectedAddress) return;

    // Clear any previous errors
    setPaymentError(null);

    try {
      await processPaymentWithShipments({
        shippingGroups: shippingGroups,
        totals: {
          itemsTotal: totals.itemsTotal, // Subtotal before discount
          shippingTotal: totalShippingCost,
          discount: totals.discount,
          grandTotal: totals.grandTotal, // Correct calculation
        },
        address: selectedAddress,
        notes: undefined,
        paymentMethod: "razorpay",
        paymentStatus: "pending",
        isBuyNow: !!buyNowProduct,
      });
    } catch (error) {
      // Error is already set by the hook
      console.error("Checkout failed:", error);
    }
  };

  useEffect(() => {
    const loadItems = async () => {
      if (buyNowProduct) {
        setCheckoutItems([buyNowProduct]);
      } else {
        setCheckoutItems(useCartStore.getState().items);
      }
    };
    loadItems();
  }, [buyNowProduct]);

  if (checkoutItems.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No items to checkout"
        description="Add items to your cart to checkout"
      />
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        {/* Address Form */}

        {user ? (
          <AuthenticatedAddress
            selectedAddress={selectedAddress}
            onAddressChange={selectAddress}
            onAddressAdded={addAddress}
            onAddressUpdated={updateAddress}
            addresses={addresses}
        />
        ) : (
          <GuestAddress
            onAddressChange={handleGuestAddress}
          />
        )}

        {/* Multi-Shipping Section */}
        {selectedAddress && (
          <>
            {allocationError && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {allocationError}
              </div>
            )}
            <MultiShippingSection
              groups={shippingGroups}
              onRateSelect={selectRateForGroup}
              isLoading={isShippingLoading}
            />
          </>
        )}

        {/* Checkout Actions */}
        <CheckoutActions
          canCheckout={canCheckout}
          isProcessing={isProcessing}
          total={totals.grandTotal}
          onCheckout={handleCheckout}
          validationErrors={validationErrors}
          error={paymentError}
        />
      </div>
      <CheckoutSummary
        items={checkoutItems}
        subtotal={totals.itemsTotal}
        discount={totals.discount}
        shipping={totalShippingCost}
        total={totals.grandTotal}
      />
    </div>
  );
}
