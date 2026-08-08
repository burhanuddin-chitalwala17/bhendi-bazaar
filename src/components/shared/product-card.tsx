// components/shared/product-card.tsx - REFACTORED VERSION

import Link from "next/link";
import type { Product } from "@/domain/product";
import { Card } from "@/components/ui/card";
import { PriceDisplay } from "./PriceDisplay";
import { StockStatus } from "./StockStatus";

export function ProductCard(product: Product) {
  return (
    <Link href={`/product/${product.slug}`}>
      <Card className="group overflow-hidden transition-all hover:-translate-y-1 hover:shadow-md">
        {/* Image */}
        <div className="relative aspect-[3/4] overflow-hidden bg-muted">
          <img
            src={product.thumbnail}
            alt={product.name}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
          {product.stock === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-scrim/50">
              <span className="text-sm font-semibold text-primary-foreground">
                Out of Stock
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="space-y-2 p-4">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground/80">
            {product.categorySlug?.replace("-", " ")}
          </p>
          <h3 className="line-clamp-2 font-heading text-sm font-semibold tracking-tight">
            {product.name}
          </h3>

          <PriceDisplay
            price={product.price}
            salePrice={product.salePrice}
            size="sm"
          />

          <StockStatus
            stock={product.stock}
            lowStockThreshold={product.lowStockThreshold}
            size="sm"
          />
        </div>
      </Card>
    </Link>
  );
}
