import type { OrgSummary } from "@/domain/org";
/**
 * Client-side domain types for Product
 *
 * These types are used on the client-side (components, hooks).
 * They mirror the API response structure and are used for type safety.
 */

import { ProductFlag } from "@/types/product";

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
  images: string[];
  thumbnail: string;
  weight: number;
  stock: number;
  lowStockThreshold: number;
  options?: {
    sizes?: string[];
    colors?: string[];
  };
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


