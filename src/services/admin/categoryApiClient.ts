/**
 * Admin Category Service (Client-side)
 * Handles API calls for category management
 */

import type {
  AdminCategory,
  CategoryListFilters,
  CategoryListResult,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@/domain/admin";

class AdminCategoryService {
  /**
   * Get paginated list of categories
   */
  async getCategories(
    filters: CategoryListFilters = {}
  ): Promise<CategoryListResult> {
    const params = new URLSearchParams();

    if (filters.search) params.append("search", filters.search);
    if (filters.page) params.append("page", String(filters.page));
    if (filters.limit) params.append("limit", String(filters.limit));
    if (filters.sortBy) params.append("sortBy", filters.sortBy);
    if (filters.sortOrder) params.append("sortOrder", filters.sortOrder);

    const response = await fetch(`/api/admin/categories?${params.toString()}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch categories");
    }

    return response.json();
  }

  /**
   * Get single category by ID
   */
  async getCategoryById(id: string): Promise<AdminCategory> {
    const response = await fetch(`/api/admin/categories/${id}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch category");
    }

    return response.json();
  }

  /**
   * Create new category
   */
  async createCategory(data: CreateCategoryInput): Promise<AdminCategory> {
    const response = await fetch(`/api/admin/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create category");
    }

    return response.json();
  }

  /**
   * Update category
   */
  async updateCategory(
    id: string,
    data: UpdateCategoryInput
  ): Promise<AdminCategory> {
    const response = await fetch(`/api/admin/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update category");
    }

    return response.json();
  }

  /**
   * Delete category
   */
  async deleteCategory(id: string): Promise<void> {
    const response = await fetch(`/api/admin/categories/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete category");
    }
  }
}

export const adminCategoryApiClient = new AdminCategoryService();


