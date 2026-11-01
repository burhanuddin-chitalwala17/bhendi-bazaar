import type { OrgSummary } from "@/domain/org";
/**
 * Client-side domain types for Product
 *
 * These types are used on the client-side (components, hooks).
 * They mirror the API response structure and are used for type safety.
 */

import { ProductFlag } from "@/types/product";
import type { ProductMediaDto } from "@server/catalog/media";

export type { ProductMediaDto };
export type { ProductSuggestion } from "@server/catalog/product.types";

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  salePrice?: number;
  currency: string;
  categorySlug: string;
  tags: string[];
  flags?: ProductFlag[];
  /**
   * Derived from the published reviews on every read, never a stored column
   * (product-reviews R6a). Same shape as before the columns were dropped, different
   * source — the kind of change CONTRACTS.md records because it passes review unseen.
   */
  rating: number;
  reviewsCount: number;
  /** The gallery in the org's order; exactly one item is the cover (product-video R15). */
  media: ProductMediaDto[];
  /** The cover's `ref`, for anywhere one picture stands in for the product (R3/R12). */
  thumbnail: string;
  weight: number;
  stock: number;
  lowStockThreshold: number;
  options?: {
    sizes?: string[];
    colors?: string[];
  };
  /** Indicative origin (largest active holding); allocation decides the real one. */
  shippingFromPincode: string;
  org: OrgSummary;
  facts?: Record<string, string | number | boolean>;
  measurements?: Record<string, number>;
  siblings?: ProductSibling[];
  /**
   * The public link of the bidding event holding this item out of normal sale, or
   * undefined when it can be bought as usual (bidding spec R30).
   *
   * Told to the client rather than inferred by it: the storefront has to disable the
   * buy actions and point at the event, and it cannot work that out from the product's
   * own fields — deliberately, since nothing about the product changes when an event
   * opens (spec R32). This is a display state; the refusal itself lives in the order
   * transaction, so a client that ignores this gains nothing (spec R31).
   */
  biddingSlug?: string;
}

export interface ProductSibling {
  slug: string;
  name: string;
  thumbnail: string;
  price: number;
  salePrice?: number;
  isCurrent: boolean;
}

export interface ProductFilter {
  orgId?: string;
  /** Resolved server-side (a shop's best selling, storefront-themes D9) — never client input. */
  ids?: string[];
  categorySlug?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  offerOnly?: boolean;
  /** With `offerOnly` and `orgId`: only the shop's own offers count (storefront-themes R7, Q12). */
  ownOffersOnly?: boolean;
  featuredOnly?: boolean;
  heroOnly?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * What a shopper is actually asked to pay, in paise.
 *
 * The one rule for "is this on offer" — a sale price that exists, is above zero and is
 * below the list price. Anything looser lets a zero or an inverted sale price through
 * as a discount; a bare `salePrice ?? price` does exactly that, which is the
 * inconsistency the BACKLOG records across eight call sites.
 *
 * Declared here because two things must agree on it and they are far apart: the price
 * a listing *shows* (`PriceDisplay`) and the price a listing *sorts by*. If they use
 * different rules, "price: low to high" puts a reduced item where its old price
 * belongs — which is the whole reason sorting by the database column is not an option
 * (ADR-0018).
 */
export function effectivePrice(product: {
  price: number;
  salePrice?: number | null;
}): number {
  const { price, salePrice } = product;
  return salePrice != null && salePrice > 0 && salePrice < price
    ? salePrice
    : price;
}

/** Whether a reduction is actually in force, by the same rule. */
export function hasOffer(product: {
  price: number;
  salePrice?: number | null;
}): boolean {
  return effectivePrice(product) < product.price;
}

/**
 * The badge's figure: what the resolved price takes off the list price, as a whole percent
 * (storefront-themes A3, A6). Read off the two prices, never off an offer, so a badge says only
 * what the cart will charge; 0 when nothing is reduced.
 */
export function percentOff(product: { price: number; salePrice?: number | null }): number {
  if (!hasOffer(product) || product.price <= 0) return 0;
  // Floored, never rounded: 12.5% off reads "12%", so the badge never promises more than the cart takes.
  return Math.floor(((product.price - effectivePrice(product)) / product.price) * 100);
}
