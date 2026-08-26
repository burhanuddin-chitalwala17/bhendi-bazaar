// create a category dal to get categories and category by slug

import { cache } from "react";
import { categoryRepository } from "@server/catalog/category.repository";
import { categoryService } from "@server/catalog/category.service";
import { Category } from "@/domain/category";

class CategoriesDAL {
    
    getCategories = cache(async (): Promise<Category[]> => {
        const categories = await categoryRepository.list();
        return categories;
    });

    getCategoryById = cache(async (id: string): Promise<Category> => {
        const category = await categoryRepository.findById(id);
        if (!category) {
            throw new Error("Category not found");
        }
        return category;
    });

    getCategoryBySlug = cache(async (slug: string): Promise<Category> => {
        const category = await categoryRepository.findBySlug(slug);
        if (!category) {
            throw new Error("Category not found");
        }
        return category;
    });

    /** Lane tiles for a page — the whole tree on home (`null`), a subtree below it.
     *  Rides the repository's request-memoised read, so no extra round trip. */
    getDescendants = cache(async (slug: string | null): Promise<Category[]> => {
        return await categoryService.getDescendants(slug);
    });

    /** Root-first ancestor trail for the breadcrumb. */
    getAncestors = cache(async (slug: string): Promise<Category[]> => {
        return await categoryService.getAncestors(slug);
    });
}

export const categoriesDAL = new CategoriesDAL();
