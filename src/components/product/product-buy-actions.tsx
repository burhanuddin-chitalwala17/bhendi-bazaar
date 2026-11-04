"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { Product } from "@/domain/product";
import { useProductActions } from "@/hooks/product/useProductActions";
import { cn } from "@/lib/utils";
import { PRODUCT_PAGE_COPY } from "./product-copy";
import { ROUTES } from "@server/shared/routes";
import { BUY_ACTIONS_LABEL_COPY } from "@/components/product/product-copy";

/**
 * Add to bag, and Buy now beside it from a tablet up. Never disabled (ADR-0053): a sold-out or
 * over-the-limit tap says why. Up for bidding, it leads to the auction instead (bidding R29/R30).
 */
export function ProductBuyActions({ product, className }: { product: Product; className?: string }) {
  const { handleAddToCart, handleBuyNow, isAddingToCart, isBuyingNow, justAdded, isOutOfStock } = useProductActions(product);

  if (product.biddingSlug) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <p className="text-caption text-muted-foreground">{PRODUCT_PAGE_COPY.buy.inBidding}</p>
        <Button asChild size="lg" className="w-full rounded-full">
          <Link href={ROUTES.bid(product.biddingSlug)}>
            <Icon name="auction" size="sm" />
            {PRODUCT_PAGE_COPY.buy.goToBidding}
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
        {PRODUCT_PAGE_COPY.buy.buyNow}
      </Button>
      <Button
        size="lg"
        className="flex-1 rounded-full"
        pending={isAddingToCart}
        aria-disabled={isOutOfStock || undefined}
        onClick={handleAddToCart}
      >
        {!isAddingToCart && <Icon name="bag" size="sm" motion={justAdded} />}
        {isOutOfStock ? BUY_ACTIONS_LABEL_COPY.soldOut : BUY_ACTIONS_LABEL_COPY.add}
      </Button>
    </div>
  );
}
