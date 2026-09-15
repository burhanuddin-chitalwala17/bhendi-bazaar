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

export interface ProductFilter {
  categorySlug?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  offerOnly?: boolean;
  featuredOnly?: boolean;
}
