import { PriceDisplay } from "@/components/shared/PriceDisplay";
import { CartItem } from "@/domain/cart";
import { Icon } from "@/components/ui/icon";
import { formatCurrency } from "@/lib/format";
import { CHECKOUT_SUMMARY_COPY } from "../checkout-copy";

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
      <p className="text-small text-muted-foreground">{CHECKOUT_SUMMARY_COPY.empty}</p>
    );
  }

  const title = CHECKOUT_SUMMARY_COPY.title(items.length);
  const lines = (
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
                  <span className="text-muted-foreground/60">{CHECKOUT_SUMMARY_COPY.offerApplied}</span>
                  <span className="text-success">{CHECKOUT_SUMMARY_COPY.save(formatCurrency(itemSavings))}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
  );

  return (
    <div className="space-y-3 rounded-card border border-border bg-card p-4 text-small">
      {/* StoreCheckout: folded on a phone, where the total is what matters; open beside the steps from a tablet. */}
      <details className="group md:hidden">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2">
          <h2 className="font-heading text-title font-semibold">{title}</h2>
          <Icon name="expand" size="sm" className="transition-transform duration-fast ease-standard group-open:rotate-180" />
        </summary>
        <div className="pt-2">{lines}</div>
      </details>
      <div className="hidden space-y-3 md:block">
        <h2 className="font-heading text-title font-semibold">{title}</h2>
        {lines}
      </div>

      {/* Totals Section */}
      <div className="mt-2 space-y-1 border-t border-dashed border-border pt-2 text-caption">
        {/* Subtotal */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{CHECKOUT_SUMMARY_COPY.subtotal}</span>
          <PriceDisplay price={subtotal} size="sm" />
        </div>

        {/* Discount */}
        {discount > 0 && (
          <div className="flex items-center justify-between text-success">
            <span>{CHECKOUT_SUMMARY_COPY.offers}</span>
            <span className="font-medium">- {formatCurrency(discount)}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Icon name="delivery" size="xs" />
            <span>{CHECKOUT_SUMMARY_COPY.delivery}</span>
          </div>
          {shipping > 0 ? (
            <span className="font-medium">{formatCurrency(shipping)}</span>
          ) : (
            <span className="text-muted-foreground">{CHECKOUT_SUMMARY_COPY.afterAddress}</span>
          )}
        </div>

        {/* Final Total */}
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-small font-semibold">
          <span>{CHECKOUT_SUMMARY_COPY.toPay}</span>
          <PriceDisplay price={total} size="sm" />
        </div>
      </div>


    </div>
  );
}
