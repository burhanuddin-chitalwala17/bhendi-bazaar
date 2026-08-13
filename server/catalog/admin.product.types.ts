import { ProductFlag } from "@server/catalog/product.flags";
import type { ProductMediaInput } from "@server/catalog/media";

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

export interface ProductFormInput {
  name: string;
  description?: string;
  price: number;
  salePrice?: number;
  currency?: string;
  orgId: string;
  categoryId: string;
  tags?: string[];
  flags?: ProductFlag[];
  /**
   * The gallery, in gallery order. Exactly one item carries `isThumbnail` (R15).
   * `thumbnail` is absent deliberately: it is derived from that item and is server-owned,
   * so accepting it would be accepting a value we then overwrite (Invariant 4).
   */
  media: ProductMediaInput[];
  sizes?: string[];
  colors?: string[];
  /** Stock per pickup location (stock-locations R2/R3). Zero rows are dropped. */
  stockLocations: Array<{ orgAddressId: string; quantity: number }>;
  sku?: string;
  lowStockThreshold?: number;
  weight: number;
}