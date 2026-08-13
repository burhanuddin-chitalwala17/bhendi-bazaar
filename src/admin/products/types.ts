import { ProductFlag, Pagination } from "@/types/shared";
import type { OrgSummary } from "@/domain/org";

// The one ProductFormInput: declared server-side, re-exported here so the two sides
// cannot drift again (CONTRACTS.md — weight was collected and never written).
export type { ProductFormInput } from "@server/catalog/admin.product.types";
import type { ProductMediaDto } from "@server/catalog/media";

export interface ProductFilters {
  search?: string; // Search by name, SKU, tags
  categoryId?: string;
  orgId?: string;
  flags?: ProductFlag[]; // Filter by any flags
  lowStock?: boolean; // Products below lowStockThreshold
  outOfStock?: boolean; // Stock = 0
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
  sortBy?: "name" | "createdAt" | "price" | "stock";
  sortOrder?: "asc" | "desc";
}

export interface ProductListResult {
  products: ProductForTable[];
  pagination: Pagination;
}

export interface ProductForTable {
  id: string;
  name: string;
  flags: ProductFlag[];
  sku?: string;
  price: number;
  salePrice?: number;
  currency: string;
  rating: number;
  stock: number;
  lowStockThreshold: number;
  thumbnail: string;
  createdAt: Date;
  category: { id: string; name: string };
  org: { id: string; name: string; code: string };
}

export interface ProductDetails {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  salePrice?: number;
  currency: string;
  category: { id: string; name: string };
  tags: string[];
  flags: ProductFlag[];
  sku?: string;
  stock: number;
  lowStockThreshold: number;
  weight: number;
  media: ProductMediaDto[];
  thumbnail: string;
  sizes: string[];
  colors: string[];
  org: OrgSummary;
  /** Per-location breakdown (stock-locations R9/A7); `stock` stays the total. */
  stockLocations: Array<{ orgAddressId: string; locationName: string; quantity: number }>;
  createdAt: Date;
}

export interface ProductStats {
  totalProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  featuredProducts: number;
  totalInventoryValue: number;
}

