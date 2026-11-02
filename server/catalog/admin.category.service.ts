/**
 * Admin Category Service
 * Business logic for category management
 */

import { adminCategoryRepository } from "@server/catalog/category.repository";
import { categoryRepository } from "@server/catalog/category.read.repository";
import { orgStorefrontSlotRepository } from "@server/catalog/org-storefront-slot.repository";
import { collectSubtreeIds, wouldCreateCycle } from "@server/catalog/category.tree";
import { adminProductsRepository } from "@server/catalog/product.repository";
import { resolveProductType } from "@server/listing/product-type";
import { recordAdminAction } from "@server/shared/audit/audit.service";
import type {
  CategoryListFilters,
  CategoryListResult,
  CreateCategoryInput,
  UpdateCategoryInput,
  AdminCategory,
} from "@server/catalog/admin.category.types";
import { DomainError, NotFoundError } from "@server/shared/domain-error";

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
    if (!data.name) {
      throw new DomainError("Name is required");
    }

    if (data.parentId) {
      // Friendlier than the FK violation the database would raise.
      const tree = await categoryRepository.listTree();
      if (!tree.some((node) => node.id === data.parentId)) {
        throw new DomainError("Parent category not found", { field: "parentId" });
      }
    }

    const category = await adminCategoryRepository.createCategory(data);

    await recordAdminAction({
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
    if (data.parentId) {
      // The rule the database cannot express: a category must never become its
      // own ancestor (category-tree TRD D2). Self-parenting is the same walk.
      const tree = await categoryRepository.listTree();
      if (!tree.some((node) => node.id === data.parentId)) {
        throw new DomainError("Parent category not found", { field: "parentId" });
      }
      if (wouldCreateCycle(tree, id, data.parentId)) {
        throw new DomainError(
          "A category cannot be nested under itself or one of its subcategories",
          { field: "parentId" }
        );
      }
    }

    const category = await adminCategoryRepository.updateCategory(id, data);

    // A category given a type: its products with none take it, so readiness and listing see them.
    // Within its subtree, only categories that now resolve to this type (a child with its own keeps it).
    // Categories are the platform's, so this reaches every shop's untyped products in them; safe,
    // since an untyped product holds no type's answers, and the count is recorded (categories R7).
    let typedProducts = 0;
    if (category && data.productType) {
      const tree = await categoryRepository.listTree();
      const reached = collectSubtreeIds(tree, id).filter((cid) => resolveProductType(cid, tree) === data.productType);
      typedProducts = await adminProductsRepository.adoptTypeWhereNone(reached, data.productType);
    }

    if (category) {
      await recordAdminAction({
        adminId,
        action: "CATEGORY_UPDATED",
        resource: "Category",
        resourceId: id,
        metadata: { changes: data, categoryName: category.name, typedProducts },
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
      throw new NotFoundError("Category not found");
    }

    if (category.productsCount && category.productsCount > 0) {
      throw new DomainError(`Cannot delete category with ${category.productsCount} products. Please reassign or delete products first.`);
    }

    // Friendlier than the RESTRICT violation the database would raise — and the
    // database raising it is the guarantee, not this message.
    const childCount = (await categoryRepository.listTree()).filter(
      (node) => node.parentId === id
    ).length;
    if (childCount > 0) {
      throw new DomainError(
        `Cannot delete a category with ${childCount} subcategor${childCount === 1 ? "y" : "ies"}. Move or delete them first.`
      );
    }

    // A shop's collection slot restricts the delete (storefront-themes D13); name it rather than raise P2003.
    const shops = await orgStorefrontSlotRepository.countShopsShowingCategory(id);
    if (shops > 0) {
      throw new DomainError(
        `Cannot delete a category ${shops} shop${shops === 1 ? "" : "s"} show${shops === 1 ? "s" : ""} as a collection on their storefront. Ask them to pick another first.`
      );
    }

    await adminCategoryRepository.deleteCategory(id);

    await recordAdminAction({
      adminId,
      action: "CATEGORY_DELETED",
      resource: "Category",
      resourceId: id,
      metadata: { categoryName: category.name, slug: category.slug },
    });
  }
}

export const adminCategoryService = new AdminCategoryService();


