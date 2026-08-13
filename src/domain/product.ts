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
}

export interface ProductFilter {
  categorySlug?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  offerOnly?: boolean;
  featuredOnly?: boolean;
}


