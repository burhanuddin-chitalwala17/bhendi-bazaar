"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMultiShippingRates } from "@/hooks/shipping/useMultiShippingRates";
import { useCheckoutPayment } from "./hooks/useCheckoutPayment";
import { CheckoutSummary } from "./components/checkout-summary";
import { CouponField } from "./components/CouponField";
import { useCheckoutOffers } from "./hooks/useCheckoutOffers";
import { useCheckoutSnapshot } from "./hooks/useCheckoutSnapshot";
import { MultiShippingSection } from "./components/MultiShippingSection";
import { CheckoutActions } from "./components/CheckoutActions";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { SkeletonRows } from "@/components/shared/states/skeletons";
import { Icon } from "@/components/ui/icon";
import { checkoutStepErrors } from "./checkout-steps";
import { CartItem } from "@/domain/cart";
import { useAddressManager } from "@/hooks/useAddressManager";
import { AuthenticatedAddress } from "./components/AuthenticatedAddress";
import { GuestAddress } from "./components/GuestAddress";
import { useAuth } from "@/lib/auth";
import { useAuthSheet } from "@/context/AuthSheetContext";
import { DeliveryAddress } from "@/domain/profile";
import { Button } from "@/components/ui/button";
import { PAYMENT_STATUS } from "@server/checkout/order.types";

interface CheckoutContainerProps {
  buyNowProduct?: CartItem;
}

export function CheckoutContainer({ buyNowProduct }: CheckoutContainerProps) {
  // check if user is authenticated
  const { user } = useAuth();
  const { open: openAuthSheet } = useAuthSheet();

  const { items: checkoutItems, ready: snapshotReady } = useCheckoutSnapshot(buyNowProduct);

  const {
    groups: shippingGroups,
    totalShippingCost,
    isLoading: isShippingLoading,
    allocationError,
    fetchAllRates,
    selectRateForGroup,
  } = useMultiShippingRates();

  const {
    selectedAddress,
    addresses,
    addAddress,
    updateAddress,
    selectAddress,
    clearSelection,
  } = useAddressManager({ autoFetch: !!user });

  // Signing in here swaps the guest form for saved addresses (seamless-sign-in D10).
  // The guest's address has no account id, so it cannot stay selected.
  const previousUserId = useRef(user?.id ?? null);
  useEffect(() => {
    const wasGuest = previousUserId.current === null;
    previousUserId.current = user?.id ?? null;
    if (wasGuest && user?.id) clearSelection();
  }, [user?.id, clearSelection]);

  // Payment hook
  const {
    processPaymentWithShipments,
    isProcessing,
    error: paymentError,
    setError: setPaymentError,
  } = useCheckoutPayment();

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

  // A refused payment may be an expired shipping quote (30 minutes) or a changed price; either
  // way the next attempt needs fresh quotes, or every retry is refused the same way.
  useEffect(() => {
    if (paymentError && selectedAddress && checkoutItems.length > 0) {
      fetchAllRates(checkoutItems, selectedAddress.pincode);
    }
    // Only a new error re-quotes; the basket and address effects above cover the rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentError]);

  // Errors wait for a Pay tap and sit beside the step to fix (design-system Q20).
  const [payTapped, setPayTapped] = useState(false);
  const stepErrors = checkoutStepErrors({
    hasAddress: Boolean(selectedAddress),
    shippingLoading: isShippingLoading,
    groups: shippingGroups,
    allocationError,
  });
  const canCheckout = !stepErrors.address && !stepErrors.delivery && !isProcessing;
  const shown = payTapped ? stepErrors : { address: null, delivery: null };

  // What every live offer does to this basket, priced by the server.
  const offers = useCheckoutOffers(checkoutItems, user?.id ?? null);

  const totals = useMemo(() => {
    // List prices, exactly as the server totals them — the reduction is its own
    // figure (ADR-0019). Totalling offer-adjusted prices instead would double-count
    // the moment a coupon applied, because the engine's discount already includes
    // the automatic offers those prices have baked in.
    const itemsTotal = checkoutItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const discount = Math.min(offers.quote.totalDiscountPaise, itemsTotal);
    const grandTotal = itemsTotal + totalShippingCost - discount;

    return { itemsTotal, discount, grandTotal, savings: discount };
  }, [checkoutItems, totalShippingCost, offers.quote.totalDiscountPaise]);
  const handleCheckout = async () => {
    setPayTapped(true);
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
        paymentStatus: PAYMENT_STATUS.PENDING,
        couponCode: offers.appliedCode ?? undefined,
        isBuyNow: !!buyNowProduct,
      });
    } catch (error) {
      // The hook has already set the message shown under Pay.
      console.error("Checkout failed:", error);
    }
  };

  if (!snapshotReady) return <SkeletonRows count={3} thumbnail={false} />;

  if (checkoutItems.length === 0) {
    return (
      <EmptyState
        title="Nothing to check out"
        description="Your bag is empty. Add a piece or two first."
        action={{ label: "Back to your bag", href: "/cart" }}
      />
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-10">
      <div className="space-y-6">
        <Step number={1} title="Deliver to" error={shown.address}>
          {user ? (
            <AuthenticatedAddress
              selectedAddress={selectedAddress}
              onAddressChange={selectAddress}
              onAddressAdded={addAddress}
              onAddressUpdated={updateAddress}
              addresses={addresses}
            />
          ) : (
            <div className="space-y-3">
              <p className="flex flex-wrap items-center gap-x-1 text-small text-muted-foreground">
                Already have an account?
                <Button
                  variant="link"
                  type="button"
                  onClick={() => openAuthSheet()}
                  className="min-h-10 items-center px-1 font-semibold text-foreground underline underline-offset-4"
                >
                  Sign in
                </Button>
              </p>
              <GuestAddress onAddressChange={handleGuestAddress} />
            </div>
          )}
        </Step>

        <Step
          number={2}
          title={shippingGroups.length > 1 ? `Delivery · ${shippingGroups.length} parcels` : "Delivery"}
          error={shown.delivery}
        >
          {selectedAddress ? (
            <>
              {allocationError && !payTapped && <p className="text-small text-muted-foreground">{allocationError}</p>}
              <MultiShippingSection groups={shippingGroups} onRateSelect={selectRateForGroup} isLoading={isShippingLoading} />
            </>
          ) : (
            <p className="text-small text-muted-foreground">Delivery options appear once you add an address.</p>
          )}
        </Step>

        <Step number={3} title="Pay" error={paymentError}>
          <p className="flex items-start gap-3 text-small text-muted-foreground">
            <Icon name="secure" size="md" tone="primary" />
            Tap Pay to choose UPI, card, net banking or a wallet in Razorpay&apos;s secure window.
          </p>
        </Step>
      </div>

      <div className="space-y-4 md:col-start-2 md:row-span-2 md:row-start-1">
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
        <ul className="grid grid-cols-3 gap-2 text-center text-caption text-muted-foreground">
          <li className="flex flex-col items-center gap-1.5"><Icon name="secure" size="md" />Payments by Razorpay</li>
          <li className="flex flex-col items-center gap-1.5"><Icon name="returns" size="md" />7-day returns</li>
          <li className="flex flex-col items-center gap-1.5"><Icon name="help" size="md" />Help from Account</li>
        </ul>
      </div>

      <div className="md:col-start-1 md:row-start-2">
        <CheckoutActions isProcessing={isProcessing} total={totals.grandTotal} onPay={handleCheckout} />
      </div>
    </div>
  );
}

/** A numbered step, with its error beside it once Pay has been tapped. */
function Step({ number, title, error, children }: { number: number; title: string; error?: string | null; children: ReactNode }) {
  return (
    <section aria-labelledby={`checkout-step-${number}`} className="space-y-3 rounded-card border border-border bg-card p-4" data-invalid={error ? true : undefined}>
      <h2 id={`checkout-step-${number}`} className="flex items-center gap-2 font-heading text-title font-semibold">
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-caption font-semibold text-primary-foreground">{number}</span>
        {title}
      </h2>
      {error && (
        <p role="alert" className="flex items-center gap-2 text-small text-destructive">
          <Icon name="warning" size="sm" />
          {error}
        </p>
      )}
      {children}
    </section>
  );
}
