/**
 * What the categories console asks the browser to do. There is no `getCategories`: the
 * listing is read by a server component through `adminCategoriesDAL` ([ADR-0034]).
 */

import { apiRequest } from "@/lib/api-client";
import type { AdminCategory, CreateCategoryInput, UpdateCategoryInput } from "@/domain/admin";

export const adminCategoryApiClient = {
  createCategory(data: CreateCategoryInput): Promise<AdminCategory> {
    return apiRequest("/api/admin/categories", { method: "POST", body: data });
  },

  updateCategory(id: string, data: UpdateCategoryInput): Promise<AdminCategory> {
    return apiRequest(`/api/admin/categories/${id}`, { method: "PATCH", body: data });
  },

  deleteCategory(id: string): Promise<void> {
    return apiRequest(`/api/admin/categories/${id}`, { method: "DELETE" });
  },
};
