/**
 * What the categories console asks the browser to do.
 *
 * There is no `getCategories`: the listing is read by a server component through
 * `adminCategoriesDAL` ([ADR-0034]). What remains is the form's reads and writes.
 */

import { readApiError } from "@/lib/api-error";
import type {
  AdminCategory,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@/domain/admin";

class AdminCategoryService {
  /**
   * Create new category
   */
  async createCategory(data: CreateCategoryInput): Promise<AdminCategory> {
    const response = await fetch(`/api/admin/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) throw await readApiError(response);

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

    if (!response.ok) throw await readApiError(response);

    return response.json();
  }

  /**
   * Delete category
   */
  async deleteCategory(id: string): Promise<void> {
    const response = await fetch(`/api/admin/categories/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) throw await readApiError(response);
  }
}

export const adminCategoryApiClient = new AdminCategoryService();


