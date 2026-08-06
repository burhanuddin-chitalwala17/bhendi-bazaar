import { ProductFlag, Pagination } from "@/types/shared";

export interface ProductFilters {
  search?: string; // Search by name, SKU, tags
  categoryId?: string;
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
  seller: { id: string; name: string; code: string };
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
  images: string[];
  thumbnail: string;
  sizes: string[];
  colors: string[];
  seller: { id: string; name: string; code: string; defaultPincode: string; defaultCity: string; defaultState: string; defaultAddress: string };
  shippingFromPincode: string;
  shippingFromCity: string;
  shippingFromLocation: string;
  createdAt: Date;
}

export interface ProductStats {
  totalProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  featuredProducts: number;
  totalInventoryValue: number;
}

export interface ProductFormInput {
  name: string;
  description?: string;
  price: number;
  salePrice?: number;
  currency?: string;
  sellerId: string;
  categoryId: string;
  tags?: string[];
  flags?: ProductFlag[];
  images: string[];
  thumbnail: string;
  weight: number;
  sizes?: string[];
  colors?: string[];
  stock: number;
  sku?: string;
  lowStockThreshold?: number;
  shippingFromPincode?: string;
  shippingFromCity?: string;
  shippingFromLocation?: string;
}