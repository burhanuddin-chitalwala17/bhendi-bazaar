import type { OrgSummary } from "@server/catalog/org.types";
/**
 * Server-side domain types for Product
 *
 * These types are used exclusively on the server-side (services, repositories).
 */

import { ProductFlag } from "@server/catalog/product.flags";

export interface ServerProduct {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  salePrice: number | null;
  currency: "INR";
  categorySlug: string;
  tags: string[];
  flags: ProductFlag[];
  rating: number;
  reviewsCount: number;
  images: string[];
  thumbnail: string;
  sizes: string[];
  colors: string[];
  stock: number;
  lowStockThreshold: number;
  weight: number;
  createdAt: Date;
  updatedAt: Date;
  org: OrgSummary;
  shippingFromPincode: string;
}

export interface ProductFilter {
  categorySlug?: string;
  /** Resolved server-side from categorySlug's subtree — never client input. */
  categoryIds?: string[];
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  offerOnly?: boolean;
  featuredOnly?: boolean;
  limit?: number;
  offset?: number;
}

