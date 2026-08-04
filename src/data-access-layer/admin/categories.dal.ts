// DATA ACCESS LAYER FOR CATEGORIES

import { cache } from "react";
import type { AdminCategory, CategoryListResult } from "@/domain/admin";
// SERVER-SIDE CATEGORIES SERVICE
import { adminCategoryRepository } from "@server/catalog/admin.category.repository";
class CategoriesDAL {
    getCategories = cache(async (): Promise<CategoryListResult> => {
        const { categories, total } = await adminCategoryRepository.getCategories({ limit: 100 });
        return { categories, total, page: 1, limit: 100, totalPages: Math.ceil(total / 100) };
    });

    getCategoryById = cache(async (id: string): Promise<AdminCategory> => {
        const category = await adminCategoryRepository.getCategoryById(id);
        if (!category) {
            throw new Error("Category not found");
        }
        return category;
    });
}

export const adminCategoriesDAL = new CategoriesDAL();