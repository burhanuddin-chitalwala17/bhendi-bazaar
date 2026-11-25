import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PriceDisplay } from "@/components/shared/PriceDisplay";
import { formatCurrency } from "@/lib/format";
import type { CartItem } from "@/domain/cart";
import type { CheckoutLinkNote } from "@server/cart/checkout-link.types";
import { CHECKOUT_LINK_GROUP_COPY } from "../checkout-copy";

interface CheckoutLinkGroupsProps {
  items: CartItem[];
  notes: CheckoutLinkNote[];
  onRemove: (item: CartItem) => void;
}

/**
 * What came from a chat and what was already in the bag, so nothing is paid for unseen
 * (checkout-links R3, R4, D4). Renders nothing for a checkout no link added to.
 */
export function CheckoutLinkGroups({ items, notes, onRemove }: CheckoutLinkGroupsProps) {
  const linkIds = [...new Set(items.flatMap((item) => (item.fromLinkId ? [item.fromLinkId] : [])))];
  if (linkIds.length === 0) return null;
  const others = items.filter((item) => !item.fromLinkId);

  return (
    <div className="space-y-4">
      {linkIds.map((linkId) => {
        const lines = items.filter((item) => item.fromLinkId === linkId);
        const note = notes.find((n) => n.linkId === linkId);
        return (
          <section key={linkId} className="space-y-3 rounded-card border border-border bg-card p-4" aria-labelledby={`link-${linkId}`}>
            <h2 id={`link-${linkId}`} className="font-heading text-title font-semibold">
              {CHECKOUT_LINK_GROUP_COPY.fromChatWith(note?.shopName ?? lines[0].org.name)}
            </h2>
            {note && note.leftOut.length > 0 && (
              <div role="status" className="space-y-1 rounded-field border border-warning/40 bg-warning/10 px-3 py-2 text-small text-foreground">
                {note.leftOut.map((item) => (
                  <p key={item.productId}>{CHECKOUT_LINK_GROUP_COPY.leftOut(item.productName)}</p>
                ))}
              </div>
            )}
            <ul className="divide-y divide-border">
              {lines.map((item) => {
                const change = note?.priceChanges.find((c) => c.productId === item.productId);
                return (
                  <li key={item.id} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0 space-y-1">
                      <p className="line-clamp-2 text-small">{item.productName} × {item.quantity}</p>
                      <Badge variant="secondary">{CHECKOUT_LINK_GROUP_COPY.fromChat}</Badge>
                    </div>
                    {change ? (
                      <p className="text-right text-small font-medium">
                        {CHECKOUT_LINK_GROUP_COPY.priceChanged(formatCurrency(change.nowPaise), formatCurrency(change.wasPaise))}
                      </p>
                    ) : (
                      <PriceDisplay price={item.price} salePrice={item.salePrice} size="sm" />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {others.length > 0 && (
        <section className="space-y-3 rounded-card border border-border bg-card p-4" aria-labelledby="already-in-cart">
          <h2 id="already-in-cart" className="font-heading text-title font-semibold">{CHECKOUT_LINK_GROUP_COPY.alreadyInCart}</h2>
          <ul className="divide-y divide-border">
            {others.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                <p className="line-clamp-2 min-w-0 text-small">{item.productName} × {item.quantity}</p>
                <div className="flex items-center gap-2">
                  <PriceDisplay price={item.price} salePrice={item.salePrice} size="sm" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={CHECKOUT_LINK_GROUP_COPY.removeItem(item.productName)}
                    onClick={() => onRemove(item)}
                  >
                    {CHECKOUT_LINK_GROUP_COPY.remove}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
