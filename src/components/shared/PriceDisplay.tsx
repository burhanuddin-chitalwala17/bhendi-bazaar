// components/shared/PriceDisplay.tsx

import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { OfferBadge } from "./badges/StatusBadge";

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
  const hasOffer = salePrice != null && salePrice > 0 && salePrice < price;
  const displayPrice = hasOffer ? salePrice : price;

  // xs is the dense grid tile: at 3-up on a 360px phone it gets ~105px of width, which
  // has no room for a gap-3 row — so it wraps tightly and grows back at `sm`, where
  // the same tile is twice as wide.
  const sizeClasses = {
    xs: {
      price: "text-xs sm:text-sm",
      original: "text-2xs sm:text-xs",
      row: "flex-wrap gap-x-1.5 gap-y-0",
    },
    sm: { price: "text-sm", original: "text-xs", row: "flex-wrap gap-x-2 gap-y-0.5" },
    md: { price: "text-xl", original: "text-sm", row: "gap-3" },
    lg: { price: "text-xl sm:text-2xl", original: "text-sm sm:text-base", row: "gap-3" },
  };

  return (
    <div className={cn("flex items-baseline", sizeClasses[size].row, className)}>
      <span
        className={cn(
          "font-semibold text-primary tabular-nums",
          sizeClasses[size].price
        )}
      >
        {formatCurrency(displayPrice)}
      </span>
      {hasOffer && (
        <>
          <span
            className={cn(
              "text-muted-foreground line-through",
              sizeClasses[size].original
            )}
          >
            {formatCurrency(price)}
          </span>
          {showBadge && <OfferBadge />}
        </>
      )}
    </div>
  );
}