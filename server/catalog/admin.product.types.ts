import { ProductFlag } from "@server/catalog/product.flags";

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
  images: string[];
  thumbnail: string;
  sizes?: string[];
  colors?: string[];
  stock: number;
  sku?: string;
  lowStockThreshold?: number;
  weight: number;
  shippingFromPincode?: string;
  shippingFromCity?: string;
  shippingFromLocation?: string;
}