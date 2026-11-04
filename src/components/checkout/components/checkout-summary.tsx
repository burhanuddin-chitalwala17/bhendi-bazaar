import { PriceDisplay } from "@/components/shared/PriceDisplay";
import { CartItem } from "@/domain/cart";
import { Icon } from "@/components/ui/icon";
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
      <p className="text-small text-muted-foreground">Your bag is empty.</p>
    );
  }

  return (
    <div className="space-y-3 rounded-card border border-border bg-card p-4 text-small">
      <h2 className="font-heading text-title font-semibold">
        Order summary · {items.length === 1 ? "1 item" : `${items.length} items`}
      </h2>

      {/* Items List */}
      <div className="space-y-2 text-caption">
        {items.map((item) => {
          const itemTotal = item.price * item.quantity;
          const itemSavings =
            lineDiscounts[
              `${item.productId}::${item.size ?? ""}::${item.color ?? ""}`
            ] ?? 0;

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
                <div className="flex items-baseline justify-between gap-2 text-caption">
                  <span className="text-muted-foreground/60">
                    Offer applied
                  </span>
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
      <div className="mt-2 space-y-1 border-t border-dashed border-border pt-2 text-caption">
        {/* Subtotal */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <PriceDisplay price={subtotal} size="sm" />
        </div>

        {/* Discount */}
        {discount > 0 && (
          <div className="flex items-center justify-between text-success">
            <span>Offers</span>
            <span className="font-medium">- {formatCurrency(discount)}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Icon name="delivery" size="xs" />
            <span>Delivery</span>
          </div>
          {shipping > 0 ? (
            <span className="font-medium">{formatCurrency(shipping)}</span>
          ) : (
            <span className="text-muted-foreground">After your address</span>
          )}
        </div>

        {/* Final Total */}
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-small font-semibold">
          <span>To pay</span>
          <PriceDisplay price={total} size="sm" />
        </div>
      </div>


    </div>
  );
}
