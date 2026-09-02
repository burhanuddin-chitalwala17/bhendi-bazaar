// src/components/checkout/checkoutContainer/index.tsx
"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Package } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useMultiShippingRates } from "@/hooks/shipping/useMultiShippingRates";
import { useCheckoutPayment } from "./hooks/useCheckoutPayment";
import { CheckoutSummary } from "./components/checkout-summary";
import { CouponField } from "./components/CouponField";
import { useCheckoutOffers } from "./hooks/useCheckoutOffers";
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

  const handleGuestAddress = useCallback(
    (address: DeliveryAddress) => {
      selectAddress(address);
    },
    [selectAddress],
  );

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

  // What every live offer does to this basket, priced by the server.
  const offers = useCheckoutOffers(checkoutItems);

  const totals = useMemo(() => {
    // List prices, exactly as the server totals them — the reduction is its own
    // figure (ADR-0019). Totalling offer-adjusted prices instead would double-count
    // the moment a coupon applied, because the engine's discount already includes
    // the automatic offers those prices have baked in.
    const itemsTotal = checkoutItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const discount = Math.min(offers.quote.totalDiscountPaise, itemsTotal);
    const grandTotal = itemsTotal + totalShippingCost - discount;

    return { itemsTotal, discount, grandTotal, savings: discount };
  }, [checkoutItems, totalShippingCost, offers.quote.totalDiscountPaise]);
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
        couponCode: offers.appliedCode ?? undefined,
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

      </div>

      {/* On mobile the summary must precede the CTA — a buyer sees the bill before the
          button that commits to it. On md the summary is the right rail spanning both rows. */}
      <div className="md:col-start-2 md:row-start-1 md:row-span-2">
        <CouponField
          quote={offers.quote}
          appliedCode={offers.appliedCode}
          isPricing={offers.isPricing}
          onApply={offers.applyCode}
          onClear={offers.clearCode}
          lineCount={checkoutItems.length}
        />

        <CheckoutSummary
          items={checkoutItems}
          lineDiscounts={offers.quote.lineDiscounts}
          subtotal={totals.itemsTotal}
          discount={totals.discount}
          shipping={totalShippingCost}
          total={totals.grandTotal}
        />
      </div>

      {/* Sticky on mobile: multi-shipment pages run long and the CTA must stay reachable */}
      <div className="sticky bottom-0 z-20 -mx-4 bg-background/95 px-4 py-3 backdrop-blur md:static md:z-auto md:m-0 md:col-start-1 md:row-start-2 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <CheckoutActions
          canCheckout={canCheckout}
          isProcessing={isProcessing}
          total={totals.grandTotal}
          onCheckout={handleCheckout}
          validationErrors={validationErrors}
          error={paymentError}
        />
      </div>
    </div>
  );
}
