// DATA ACCESS LAYER FOR CATEGORIES

import { cache } from "react";
import type { AdminCategory, CategoryListFilters, CategoryListResult } from "@/domain/admin";
// SERVER-SIDE CATEGORIES SERVICE
import { adminCategoryRepository } from "@server/catalog/category.repository";
import { productTypeRepository } from "@server/listing/product-type.repository";
class CategoriesDAL {
    getCategories = cache(async (): Promise<CategoryListResult> => {
        const { categories, total } = await adminCategoryRepository.getCategories({ limit: 100 });
        return { categories, total, page: 1, limit: 100, totalPages: Math.ceil(total / 100) };
    });

    /**
     * The product types a category may point at. `cache` so a page rendering the form and the
     * breadcrumb reads them once (product-types D5); they are tens of rows and change rarely,
     * which is why two indexed reads do not earn a caching layer this project does not have.
     */
    getProductTypeOptions = cache(async (): Promise<Array<{ key: string; label: string }>> => {
        return productTypeRepository.options();
    });

    /**
     * The console's filtered, paged read — distinct from `getCategories` above, which fetches a
     * flat 100 for pickers and forms. Kept apart on purpose: a picker wants every category and a
     * console wants one page of them, and one method serving both ends up doing neither well.
     */
    list = cache(async (filters: CategoryListFilters): Promise<CategoryListResult> => {
        const { categories, total } = await adminCategoryRepository.getCategories(filters);
        const limit = filters.limit ?? 10;
        return {
            categories,
            total,
            page: filters.page ?? 1,
            limit,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        };
    });

    /** Null rather than a throw: the page turns a missing row into a 404, not a 500. */
    getCategoryById = cache(async (id: string): Promise<AdminCategory | null> => {
        return adminCategoryRepository.getCategoryById(id);
    });
}

export const adminCategoriesDAL = new CategoriesDAL();