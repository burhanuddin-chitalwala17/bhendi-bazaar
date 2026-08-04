/**
 * Admin Category Service
 * Business logic for category management
 */

import { adminCategoryRepository } from "@server/catalog/admin.category.repository";
import { adminLogRepository } from "@server/shared/audit/audit.repository";
import type {
  CategoryListFilters,
  CategoryListResult,
  CreateCategoryInput,
  UpdateCategoryInput,
  AdminCategory,
} from "@server/catalog/admin.category.types";

export class AdminCategoryService {
  /**
   * Get paginated list of categories
   */
  async getCategories(
    filters: CategoryListFilters
  ): Promise<CategoryListResult> {
    const { categories, total } = await adminCategoryRepository.getCategories(
      filters
    );

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const totalPages = Math.ceil(total / limit);

    return {
      categories,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get single category by ID
   */
  async getCategoryById(id: string): Promise<AdminCategory | null> {
    return await adminCategoryRepository.getCategoryById(id);
  }

  /**
   * Create new category
   */
  async createCategory(
    adminId: string,
    data: CreateCategoryInput
  ): Promise<AdminCategory> {
    if (!data.name || !data.slug) {
      throw new Error("Name and slug are required");
    }

    const category = await adminCategoryRepository.createCategory(data);

    await adminLogRepository.createLog({
      adminId,
      action: "CATEGORY_CREATED",
      resource: "Category",
      resourceId: category.id,
      metadata: { categoryName: category.name, slug: category.slug },
    });

    return category;
  }

  /**
   * Update category
   */
  async updateCategory(
    id: string,
    adminId: string,
    data: UpdateCategoryInput
  ): Promise<AdminCategory | null> {
    const category = await adminCategoryRepository.updateCategory(id, data);

    if (category) {
      await adminLogRepository.createLog({
        adminId,
        action: "CATEGORY_UPDATED",
        resource: "Category",
        resourceId: id,
        metadata: { changes: data, categoryName: category.name },
      });
    }

    return category;
  }

  /**
   * Delete category
   */
  async deleteCategory(id: string, adminId: string): Promise<void> {
    const category = await adminCategoryRepository.getCategoryById(id);

    if (!category) {
      throw new Error("Category not found");
    }

    if (category.productsCount && category.productsCount > 0) {
      throw new Error(
        `Cannot delete category with ${category.productsCount} products. Please reassign or delete products first.`
      );
    }

    await adminCategoryRepository.deleteCategory(id);

    await adminLogRepository.createLog({
      adminId,
      action: "CATEGORY_DELETED",
      resource: "Category",
      resourceId: id,
      metadata: { categoryName: category.name, slug: category.slug },
    });
  }
}

export const adminCategoryService = new AdminCategoryService();


