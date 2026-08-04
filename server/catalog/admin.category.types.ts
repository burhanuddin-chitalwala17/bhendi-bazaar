/**
 * Admin Category Management Domain Types
 */

export interface AdminCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  heroImage: string;
  accentColorClass: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  productsCount?: number;
}

export interface CategoryListFilters {
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: "order" | "name" | "createdAt";
  sortOrder?: "asc" | "desc";
}

export interface CategoryListResult {
  categories: AdminCategory[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateCategoryInput {
  slug: string;
  name: string;
  description: string;
  heroImage: string;
  accentColorClass: string;
  order?: number;
}

export interface UpdateCategoryInput {
  slug?: string;
  name?: string;
  description?: string;
  heroImage?: string;
  accentColorClass?: string;
  order?: number;
}


