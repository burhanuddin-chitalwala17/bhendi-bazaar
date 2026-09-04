// NEW VERSION - product-details.tsx

"use client";

import { useState } from "react";
import type { Product } from "@/domain/product";
import { PriceDisplay } from "@/components/shared/PriceDisplay";
import { StockStatus } from "@/components/shared/StockStatus";
import { ProductActions } from "@/components/shared/button-groups/ProductActions";
import { ShareButton } from "@/components/shared/ShareButton";
import { useProductActions } from "@/hooks/product/useProductActions";

export function ProductDetails(product: Product) {
  const sizes = product.options?.sizes ?? [];
  // Pre-selected when there is nothing to choose between, so a one-size product
  // does not make the shopper tap a control with a single option.
  const [selectedSize, setSelectedSize] = useState<string | undefined>(
    sizes.length === 1 ? sizes[0] : undefined
  );

  const {
    handleAddToCart,
    handleBuyNow,
    isAddingToCart,
    isBuyingNow,
    isOutOfStock,
    currentCartQty
  } = useProductActions(product, selectedSize);
  // console.log("ProductDetails: ", JSON.stringify(product, null, 2));

  return (
    <section className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="space-y-1.5 sm:space-y-2">
        <p className="text-4xs font-semibold uppercase tracking-eyebrow-wide text-muted-foreground/80 sm:text-2xs sm:tracking-display">
          Bhendi Bazaar · {product.categorySlug.replace("-", " ")}
        </p>
        {/* Share sits beside the title rather than with the cart buttons: those dock to
            the bottom bar on a phone, where a third target crowds the primary action. */}
        <div className="flex items-start gap-2">
          <h1 className="min-w-0 flex-1 font-heading text-lg font-semibold leading-tight tracking-tight sm:text-3xl">
            {product.name}
          </h1>
          <ShareButton
            url={`/product/${product.slug}`}
            title={`${product.name} — Bhendi Bazaar`}
            text={`Look at this on Bhendi Bazaar: ${product.name}`}
            variant="ghost"
            size="icon"
            showLabel={false}
            className="shrink-0"
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            {product.rating.toFixed(1)} · {product.reviewsCount} reviews
          </span>
        </div>
      </div>

      {/* Price - Using PriceDisplay component */}
      <PriceDisplay
        price={product.price}
        salePrice={product.salePrice}
        size="lg"
      />

      {/* Stock Status - Using StockStatus component */}
      <StockStatus
        stock={product.stock}
        lowStockThreshold={product.lowStockThreshold}
        cartQuantity={currentCartQty}
      />

      {/* Description */}
      <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
        {product.description}
      </p>

      {/* Sizes (if available) — a choice, not a label: the order line carries the
          size to pack, so these have to be selectable and one has to be picked. */}
      {sizes.length > 0 && (
        <div className="space-y-2">
          <p className="text-3xs font-medium uppercase tracking-eyebrow text-muted-foreground sm:text-xs">
            Size
          </p>
          <div
            role="radiogroup"
            aria-label="Size"
            className="flex flex-wrap gap-2 text-xs"
          >
            {sizes.map((size) => {
              const isSelected = size === selectedSize;
              return (
                <button
                  key={size}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setSelectedSize(size)}
                  className={`inline-flex h-9 min-w-9 items-center justify-center rounded-full border px-3 uppercase tracking-eyebrow transition-colors ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/80 hover:border-foreground/40"
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* One set of buttons, two positions: docked above the tab bar while the shopper
          scrolls the description and reviews, back in the flow from md. Two copies
          would mean two "Add to cart" targets for a screen reader. */}
      <div className="fixed inset-x-0 bottom-tabbar z-30 border-t border-border/60 bg-background/95 px-3 py-2 backdrop-blur md:static md:inset-auto md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
        <ProductActions
          onAddToCart={handleAddToCart}
          onBuyNow={handleBuyNow}
          isOutOfStock={isOutOfStock}
          isAddingToCart={isAddingToCart}
          isBuyingNow={isBuyingNow}
        />
      </div>
    </section>
  );
}
