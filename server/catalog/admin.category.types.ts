import type { CategoryAccent } from "@prisma/client";
/**
 * Admin Category Management Domain Types
 */

export interface AdminCategory {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  description: string;
  heroImage: string;
  accent: CategoryAccent;
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
  name: string;
  /** null/absent = root. Existence and acyclicity are checked in the service. */
  parentId?: string | null;
  description: string;
  heroImage: string;
  accent: CategoryAccent;
  order?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  /** undefined = unchanged, null = detach to root. */
  parentId?: string | null;
  description?: string;
  heroImage?: string;
  accent?: CategoryAccent;
  order?: number;
}


