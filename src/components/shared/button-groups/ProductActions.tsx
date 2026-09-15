// components/shared/button-groups/ProductActions.tsx

import Link from "next/link";
import { Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProductActionsProps {
  onAddToCart: () => void;
  onBuyNow: () => void;
  isOutOfStock: boolean;
  isAddingToCart?: boolean;
  isBuyingNow?: boolean;
  /** Set while the item is up for bidding — the event's public link (bidding R30). */
  biddingSlug?: string;
}

export function ProductActions({
  onAddToCart,
  onBuyNow,
  isOutOfStock,
  isAddingToCart = false,
  isBuyingNow = false,
  biddingSlug,
}: ProductActionsProps) {
  // Buying is suspended, browsing is not: the page stays whole and says why, with the
  // way to take part instead of a dead button (bidding spec R29/R30).
  if (biddingSlug) {
    return (
      <div className="flex flex-col gap-2 md:mt-4">
        <p className="text-2xs leading-relaxed text-muted-foreground sm:text-xs">
          This item is up for bidding, so it cannot be bought directly right now.
        </p>
        <Button
          asChild
          size="lg"
          className="w-full rounded-full text-2xs font-semibold uppercase tracking-label sm:text-xs sm:tracking-eyebrow"
        >
          <Link href={`/bid/${biddingSlug}`}>
            <Gavel className="size-4" aria-hidden />
            Go to bidding
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2 md:mt-4">
      <Button
        size="lg"
        className="flex-1 rounded-full text-2xs font-semibold uppercase tracking-label sm:text-xs sm:tracking-eyebrow"
        variant="outline"
        disabled={isAddingToCart || isOutOfStock}
        onClick={onAddToCart}
      >
        {isOutOfStock
          ? "Out of Stock"
          : isAddingToCart
          ? "Adding..."
          : "Add to cart"}
      </Button>
      <Button
        size="lg"
        className="flex-1 rounded-full text-2xs font-semibold uppercase tracking-label sm:text-xs sm:tracking-eyebrow"
        disabled={isBuyingNow || isOutOfStock}
        onClick={onBuyNow}
      >
        {isOutOfStock
          ? "Unavailable"
          : isBuyingNow
          ? "Loading..."
          : "Buy Now"}
      </Button>
    </div>
  );
}