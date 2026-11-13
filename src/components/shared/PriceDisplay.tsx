import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { OfferBadge } from "./badges/StatusBadge";
import { effectivePrice, hasOffer, percentOff } from "@/domain/product";

interface PriceDisplayProps {
  price: number;
  salePrice?: number | null;
  currency?: string;
  size?: "xs" | "sm" | "md" | "lg";
  showBadge?: boolean;
  className?: string;
}

export function PriceDisplay({
  price,
  salePrice,
  currency = "INR",
  size = "md",
  showBadge = true,
  className,
}: PriceDisplayProps) {
  // The same rule the listing sorts by (`src/domain/product.ts`), so a reduced
  // item cannot show one price and be ordered by another.
  const offerApplies = hasOffer({ price, salePrice });
  const displayPrice = effectivePrice({ price, salePrice });

  const sizeClasses = {
    xs: { price: "text-caption", original: "text-2xs", row: "flex-wrap gap-x-1.5 gap-y-0" },
    sm: { price: "text-small", original: "text-caption", row: "flex-wrap gap-x-1.5 gap-y-0.5" },
    md: { price: "text-title", original: "text-small", row: "flex-wrap gap-x-2" },
    // Inside a store the product page's price is title size (storefront-look Q2); the layout, not the page, knows.
    lg: { price: "text-headline in-data-theme:text-title", original: "text-body", row: "flex-wrap gap-x-3" },
  };

  return (
    <div
      className={cn("flex items-baseline", sizeClasses[size].row, className)}
    >
      <span
        className={cn(
          "font-semibold text-foreground tabular-nums",
          sizeClasses[size].price,
        )}
      >
        {formatCurrency(displayPrice)}
      </span>
      {offerApplies && (
        <>
          <span
            className={cn(
              "text-muted-foreground line-through",
              sizeClasses[size].original,
            )}
          >
            {formatCurrency(price)}
          </span>
          {showBadge && <OfferBadge percentOff={percentOff({ price, salePrice })} />}
        </>
      )}
    </div>
  );
}
