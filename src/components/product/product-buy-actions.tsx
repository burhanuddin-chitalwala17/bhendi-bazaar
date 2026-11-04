"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { Product } from "@/domain/product";
import { useProductActions } from "@/hooks/product/useProductActions";
import { cn } from "@/lib/utils";

/**
 * Add to bag, and Buy now beside it from a tablet up. Never disabled (ADR-0053): a sold-out or
 * over-the-limit tap says why. Up for bidding, it leads to the auction instead (bidding R29/R30).
 */
export function ProductBuyActions({ product, className }: { product: Product; className?: string }) {
  const { handleAddToCart, handleBuyNow, isAddingToCart, isBuyingNow, justAdded, isOutOfStock } = useProductActions(product);

  if (product.biddingSlug) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <p className="text-caption text-muted-foreground">This piece is up for bidding, so it can&apos;t be bought directly right now.</p>
        <Button asChild size="lg" className="w-full rounded-full">
          <Link href={`/bid/${product.biddingSlug}`}>
            <Icon name="auction" size="sm" />
            Go to bidding
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-2", className)}>
      <Button
        size="lg"
        variant="outline"
        className="hidden flex-1 rounded-full md:inline-flex"
        pending={isBuyingNow}
        aria-disabled={isOutOfStock || undefined}
        onClick={handleBuyNow}
      >
        Buy now
      </Button>
      <Button
        size="lg"
        className="flex-1 rounded-full"
        pending={isAddingToCart}
        aria-disabled={isOutOfStock || undefined}
        onClick={handleAddToCart}
      >
        {!isAddingToCart && <Icon name="bag" size="sm" motion={justAdded} />}
        {isOutOfStock ? "Sold out" : "Add to bag"}
      </Button>
    </div>
  );
}
