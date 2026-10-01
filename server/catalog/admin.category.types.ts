import type { CategoryAccent } from "@prisma/client";
import type { ShotList } from "@server/catalog/shot-list";
import type { ProductTypeKey } from "./product-type";
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
  /** This category's own list, null when it inherits (media-library D4). */
  shotList: ShotList | null;
  /** Which listing questions its products are asked, null when it inherits (categories D1a). */
  productType: ProductTypeKey | null;
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
  /** null clears to inheritance; absent leaves it alone. */
  shotList?: ShotList | null;
  productType?: ProductTypeKey | null;
}

export interface UpdateCategoryInput {
  name?: string;
  /** undefined = unchanged, null = detach to root. */
  parentId?: string | null;
  description?: string;
  heroImage?: string;
  accent?: CategoryAccent;
  order?: number;
  shotList?: ShotList | null;
  productType?: ProductTypeKey | null;
}


