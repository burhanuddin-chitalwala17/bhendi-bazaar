// src/components/checkoutContainer/checkout-summary.tsx

import { PriceDisplay } from "@/components/shared/PriceDisplay";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { CartItem } from "@/domain/cart";
import { Truck } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface CheckoutSummaryProps {
  items: CartItem[];
  /** Per-line discount, keyed as the server allocates it. */
  lineDiscounts?: Record<string, number>;
  subtotal: number; // Sum of all original prices
  discount: number; // Total savings
  total: number; // Final total including shipping
  shipping: number;
}
export function CheckoutSummary({
  items,
  lineDiscounts = {},
  subtotal,
  discount,
  total,
  shipping,
}: CheckoutSummaryProps) {
  if (!items.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Your basket is empty. Return to the bazaar to add a few treasures first.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-card/80 p-4 text-sm">
      <SectionHeader overline="Bill" title="Order Summary" />

      {/* Items List */}
      <div className="space-y-2 text-xs">
        {items.map((item) => {
          const itemTotal = item.price * item.quantity;
          const itemSavings =
            lineDiscounts[`${item.productId}::${item.size ?? ""}::${item.color ?? ""}`] ?? 0;

          return (
            <div key={item.id} className="space-y-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="line-clamp-1 text-muted-foreground">
                  {item.productName} × {item.quantity}
                </span>
                <PriceDisplay price={itemTotal} size="sm" />
              </div>

              {/* Show savings for this item if applicable */}
              {itemSavings > 0 && (
                <div className="flex items-baseline justify-between gap-2 text-[0.65rem]">
                  <span className="text-muted-foreground/60">Offer applied</span>
                  <span className="text-success">
                    Save {formatCurrency(itemSavings)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Totals Section */}
      <div className="mt-2 space-y-1 border-t border-dashed border-border/70 pt-2 text-xs">
        {/* Subtotal */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <PriceDisplay price={subtotal} size="sm" />
        </div>

        {/* Discount */}
        {discount > 0 && (
          <div className="flex items-center justify-between text-success">
            <span>Discount</span>
            <span className="font-medium">- {formatCurrency(discount)}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Truck className="h-3 w-3" />
            <span>Shipping</span>
          </div>
          {shipping > 0 ? (
            <span className="font-medium">{formatCurrency(shipping)}</span>
          ) : (
            <span className="text-xs text-muted-foreground">Select method</span>
          )}
        </div>

        {/* Final Total */}
        <div className="mt-2 flex items-center justify-between border-t border-border/70 pt-2 text-sm font-semibold">
          <span>Total</span>
          <PriceDisplay price={total} size="sm" />
        </div>
      </div>

      {/* Update description at bottom (lines 96-99): */}
      {shipping === 0 && (
        <p className="pt-1 text-[0.65rem] text-muted-foreground">
          Shipping charges will be calculated based on your location and selected
          delivery method.
        </p>
      )}
    </div>
  );
}
