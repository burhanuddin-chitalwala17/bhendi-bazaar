import Link from "next/link";
import type { Product } from "@/domain/product";
import { Card } from "@/components/ui/card";
import { PriceDisplay } from "./PriceDisplay";
import { StockStatus } from "./StockStatus";

// The phone tile is 3-up at ~105px wide (ADR-0016), so everything here is sized for
// that first and grows at `sm`. Anything that cannot survive 105px — the tracked-out
// category overline, the "SALE" word badge — is dropped below `sm` rather than
// truncated, and the discount is carried by the corner chip instead.
export function ProductCard(product: Product) {
  const { price, salePrice } = product;
  const hasOffer =
    price > 0 && salePrice != null && salePrice > 0 && salePrice < price;
  const discountPercent = hasOffer
    ? Math.round(((price - salePrice) / price) * 100)
    : 0;

  return (
    // Prefetch off: the grid puts up to 12 of these in view at once, and with every
    // storefront route dynamic, Next's staleTimes.dynamic of 0 discards each payload.
    <Link href={`/product/${product.slug}`} className="block" prefetch={false}>
      {/* py-0/gap-0 override Card's defaults so the image bleeds to the card edge */}
      <Card className="group h-full gap-0 overflow-hidden rounded-lg py-0 transition-all sm:rounded-xl md:hover:-translate-y-1 md:hover:shadow-lifted">
        <div className="relative aspect-[3/4] overflow-hidden bg-muted">
          <img
            src={product.thumbnail}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform md:group-hover:scale-105"
          />

          {discountPercent > 0 && product.stock > 0 && (
            <span className="absolute left-1 top-1 rounded bg-destructive px-1 py-0.5 text-4xs font-bold leading-none text-primary-foreground sm:left-2 sm:top-2 sm:px-1.5 sm:py-1 sm:text-3xs">
              {discountPercent}% OFF
            </span>
          )}

          {product.stock === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-scrim/60">
              <span className="text-3xs font-semibold uppercase tracking-wide text-primary-foreground sm:text-sm sm:tracking-normal">
                Out of Stock
              </span>
            </div>
          )}
        </div>

        <div className="space-y-1 p-2 sm:space-y-2 sm:p-4">
          <p className="hidden text-2xs font-semibold uppercase tracking-eyebrow-wide text-muted-foreground/80 sm:block">
            {product.categorySlug?.replace("-", " ")}
          </p>
          <h3 className="line-clamp-2 font-heading text-2xs font-semibold leading-snug tracking-tight sm:text-sm">
            {product.name}
          </h3>

          <PriceDisplay
            price={product.price}
            salePrice={product.salePrice}
            size="xs"
            showBadge={false}
          />

          <StockStatus
            stock={product.stock}
            lowStockThreshold={product.lowStockThreshold}
            size="xs"
            variant="warn-only"
          />
        </div>
      </Card>
    </Link>
  );
}
