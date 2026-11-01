import Link from "next/link";

import { effectivePrice, hasOffer, percentOff, type Product } from "@/domain/product";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CARD_STYLE, type CardStyle } from "@server/catalog/storefront-themes";
import { storefrontProductHref } from "./section-heading";
import { ThemePhoto } from "./theme-photo";

/** Each style's image shape (spec Theme cards, "Card"). */
export const ASPECT: Record<CardStyle, string> = {
  [CARD_STYLE.TILE]: "aspect-[4/5]",
  [CARD_STYLE.TALL]: "aspect-[3/4]",
  [CARD_STYLE.SQUARE]: "aspect-square",
  [CARD_STYLE.DENSE]: "aspect-square",
};

/**
 * One product card in four styles (D8): the style chooses slots and shape, the theme's tokens
 * do the rest. The figures are the product DTO's, already resolved by the one price function
 * (ADR-0018), and the offer rule is the domain's, so a card cannot price apart from the cart.
 */
export function ThemedProductCard({
  product,
  shopHandle,
  cardStyle,
  sizes,
  categoryName,
}: {
  product: Product;
  /** The shop the card sits in, so the product page keeps its chrome (Q33). */
  shopHandle: string;
  cardStyle: CardStyle;
  sizes: string;
  /** The category's shown name; a slug is never buyer text, so no name means no spec line. */
  categoryName?: string;
}) {
  const price = effectivePrice(product);
  const reduced = hasOffer(product);
  const off = percentOff(product);
  const soldOut = product.stock <= 0;
  const tall = cardStyle === CARD_STYLE.TALL;

  return (
    <Link
      href={storefrontProductHref(product.slug, shopHandle)}
      prefetch={false}
      className={cn(
        "group block h-full overflow-hidden rounded-card bg-card text-card-foreground shadow-tile",
        cardStyle === CARD_STYLE.DENSE && "border border-border",
      )}
    >
      <div className="relative">
        <ThemePhoto
          src={product.thumbnail || null}
          alt={product.name}
          sizes={sizes}
          className={cn(ASPECT[cardStyle], "bg-muted")}
        />
        {/* The badge is the resolved price's own figure, so it is what the cart charges (A3, A6). */}
        {off > 0 && !soldOut && (
          <span
            className={cn(
              "absolute left-2 top-2 rounded-field px-1.5 py-0.5 font-label text-tag uppercase tracking-tag",
              cardStyle === CARD_STYLE.DENSE || cardStyle === CARD_STYLE.SQUARE
                ? "bg-deal text-deal-foreground"
                : "bg-photo-scrim text-on-photo",
            )}
          >
            {off}% off
          </span>
        )}
        {soldOut && (
          <span className="absolute inset-x-0 bottom-0 bg-photo-scrim py-1 text-center font-label text-tag uppercase tracking-tag text-on-photo">
            Sold out
          </span>
        )}
      </div>

      <div className={cn("space-y-1 p-2 sm:p-3", tall && "text-center")}>
        {cardStyle === CARD_STYLE.TILE && categoryName && (
          <p className="font-label text-tag uppercase tracking-tag text-muted-foreground">
            {categoryName}
          </p>
        )}
        <h3
          className={cn(
            "line-clamp-2 break-words text-body",
            tall && "font-display text-tag uppercase tracking-tag",
            cardStyle === CARD_STYLE.DENSE && "font-semibold",
          )}
        >
          {product.name}
        </h3>
        {cardStyle === CARD_STYLE.SQUARE && product.reviewsCount > 0 && (
          <p className="inline-flex rounded-full bg-muted px-2 font-label text-tag text-muted-foreground">
            ★ {product.rating.toFixed(1)} ({product.reviewsCount})
          </p>
        )}
        <p
          className={cn(
            "flex flex-wrap items-baseline gap-x-1.5 tabular-nums",
            tall && "justify-center",
          )}
        >
          <span
            className={cn(
              "text-price",
              cardStyle === CARD_STYLE.TILE && "font-label",
              tall && "tracking-tag",
              cardStyle === CARD_STYLE.DENSE && "font-extrabold",
            )}
          >
            {formatCurrency(price)}
          </span>
          {reduced && (
            <s className="text-tag text-muted-foreground">{formatCurrency(product.price)}</s>
          )}
        </p>
        {product.biddingSlug && (
          <p className="font-label text-tag uppercase tracking-tag text-muted-foreground">In an auction</p>
        )}
      </div>
    </Link>
  );
}
