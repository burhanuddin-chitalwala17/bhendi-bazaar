// components/shared/PriceDisplay.tsx

import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { OfferBadge } from "./badges/StatusBadge";
import { effectivePrice, hasOffer } from "@/domain/product";

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

  // xs is the dense grid tile: at 3-up on a 360px phone it gets ~105px of width, which
  // has no room for a gap-3 row — so it wraps tightly and grows back at `sm`, where
  // the same tile is twice as wide.
  const sizeClasses = {
    xs: {
      price: "text-xs sm:text-sm",
      original: "text-2xs sm:text-xs",
      row: "flex-wrap gap-x-1.5 gap-y-0",
    },
    sm: {
      price: "text-sm",
      original: "text-xs",
      row: "flex-wrap gap-x-2 gap-y-0.5",
    },
    md: { price: "text-xl", original: "text-sm", row: "gap-3" },
    lg: {
      price: "text-xl sm:text-2xl",
      original: "text-sm sm:text-base",
      row: "gap-3",
    },
  };

  return (
    <div
      className={cn("flex items-baseline", sizeClasses[size].row, className)}
    >
      <span
        className={cn(
          "font-semibold text-primary tabular-nums",
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
          {showBadge && <OfferBadge />}
        </>
      )}
    </div>
  );
}
